import type { GitCommitID, GitGraphCommit, GitGraphRef, GitGraphSnapshot } from "../domain/contract"
import { backupLabel } from "../domain/contract"

export type GraphPoint = { readonly x: number; readonly y: number }

export type CommitLabelKind = "local" | "remote" | "tag"

export type CommitLabel = {
  readonly name: string
  readonly kind: CommitLabelKind
}

export type EdgeKind = "continue" | "fork" | "merge"

export type LaidOutCommit = {
  readonly id: GitCommitID
  readonly label: string
  readonly lines: readonly string[]
  readonly parents: readonly GitCommitID[]
  readonly lane: number
  readonly row: number
  readonly x: number
  readonly y: number
  readonly cardLeft: number
  readonly cardTop: number
  readonly cardWidth: number
  readonly cardHeight: number
  readonly branches: readonly string[]
  readonly labels: readonly CommitLabel[]
  readonly committerAt: number
}

export type LaidOutEdge = {
  readonly key: string
  readonly from: GitCommitID
  readonly to: GitCommitID
  readonly kind: EdgeKind
  readonly points: readonly GraphPoint[]
  readonly lane: number
  readonly colorLane: number
  readonly selectable: boolean
}

export type LaidOutRef = {
  readonly name: string
  readonly kind: GitGraphRef["kind"]
  readonly commitID: GitCommitID
  readonly x: number
  readonly y: number
  readonly remote?: string
  readonly stackIndex: number
}

export type GraphLayout = {
  readonly commits: readonly LaidOutCommit[]
  readonly edges: readonly LaidOutEdge[]
  readonly refs: readonly LaidOutRef[]
  readonly width: number
  readonly height: number
  readonly rowHeight: number
  readonly laneWidth: number
  readonly cardWidth: number
  readonly verticals: readonly StemRun[]
  readonly horizontals: readonly StemRun[]
}

export type StemRun = {
  readonly at: number
  readonly from: number
  readonly to: number
}

export type LayoutOptions = {
  readonly cardWidth?: number
  readonly laneGap?: number
  readonly paddingX?: number
  readonly paddingY?: number
  readonly gapY?: number
  readonly lineHeight?: number
  readonly fontSize?: number
  readonly padX?: number
  readonly padY?: number
}

export const DEFAULT_CARD_WIDTH = 260
export const DEFAULT_CARD_HEIGHT = 40

type Measured = {
  commit: GitGraphCommit
  lane: number
  label: string
  lines: string[]
  labels: CommitLabel[]
  branches: string[]
  cardHeight: number
}

/**
 * Per-lane packed layout:
 * - Vertical thread = same branch, newest at the top
 * - An older thread's newest backup sits lower, beside same-time backups
 * - Merge is a new backup on the target thread with a second incoming link
 */
export function layoutGraph(snapshot: GitGraphSnapshot, options: LayoutOptions = {}): GraphLayout {
  const cardWidth = options.cardWidth ?? DEFAULT_CARD_WIDTH
  const laneGap = options.laneGap ?? 56
  const paddingX = options.paddingX ?? 32
  const paddingY = options.paddingY ?? 32
  const gapY = options.gapY ?? 28
  const fontSize = options.fontSize ?? 12
  const padX = options.padX ?? 14
  const textWidth = cardWidth - padX * 2
  const lanePitch = cardWidth + laneGap

  const commits = orderCommits(snapshot.commits)
  const laneByCommit = allocateLanes(commits, snapshot.head.commitID)
  const labelsByCommit = labelsByCommitID(snapshot.refs)
  const maxLane = Math.max(0, ...laneByCommit.values(), 0)

  const measured: Measured[] = commits.map((commit) => {
    const label = backupLabel(commit)
    const labels = labelsByCommit.get(commit.id) ?? []
    const branches = labels.filter((item) => item.kind === "local").map((item) => item.name)
    return {
      commit,
      lane: laneByCommit.get(commit.id) ?? 0,
      label,
      lines: [truncateLabel(label, textWidth, fontSize)],
      labels,
      branches,
      cardHeight: DEFAULT_CARD_HEIGHT,
    }
  })

  const byLane = new Map<number, Measured[]>()
  for (const item of measured) {
    const list = byLane.get(item.lane) ?? []
    list.push(item)
    byLane.set(item.lane, list)
  }

  const placed = new Map<GitCommitID, LaidOutCommit>()
  let rowCounter = 0

  const placeItem = (item: Measured, lane: number, x: number, cardLeft: number, cardTop: number) => {
    placed.set(item.commit.id, {
      id: item.commit.id,
      label: item.label,
      lines: item.lines,
      parents: item.commit.parents,
      lane,
      row: rowCounter++,
      x,
      y: cardTop + item.cardHeight / 2,
      cardLeft,
      cardTop,
      cardWidth,
      cardHeight: item.cardHeight,
      branches: item.branches,
      labels: item.labels,
      committerAt: item.commit.committerAt,
    })
  }

  const placeLane = (lane: number) => {
    const items = byLane.get(lane)
    if (!items || items.length === 0) return
    if (items.every((item) => placed.has(item.commit.id))) return

    const newestFirst = items
    const x = paddingX + lane * lanePitch + cardWidth / 2
    const cardLeft = x - cardWidth / 2
    let cursorY = paddingY
    if (placed.size > 0) {
      cursorY = tipTopBesidePlaced(placed, tipTime(newestFirst[0]!), gapY)
    }
    for (const item of newestFirst) {
      if (placed.has(item.commit.id)) continue
      placeItem(item, lane, x, cardLeft, cursorY)
      cursorY += item.cardHeight + gapY
    }
  }

  for (let lane = 0; lane <= maxLane; lane++) placeLane(lane)
  for (const item of measured) {
    if (placed.has(item.commit.id)) continue
    placeLane(item.lane)
  }

  const labelClearance = 28
  const minTop = Math.min(...[...placed.values()].map((commit) => commit.cardTop), paddingY)
  const targetTop = paddingY + labelClearance
  if (minTop < targetTop) {
    const shift = targetTop - minTop
    for (const [id, commit] of placed) {
      placed.set(id, { ...commit, y: commit.y + shift, cardTop: commit.cardTop + shift })
    }
  }

  const laidOut = [...placed.values()].sort((a, b) => {
    if (a.cardTop !== b.cardTop) return a.cardTop - b.cardTop
    return a.lane - b.lane
  })

  const neighborBelow = new Map<GitCommitID, GitCommitID>()
  const placedByLane = new Map<number, LaidOutCommit[]>()
  for (const commit of laidOut) {
    const list = placedByLane.get(commit.lane) ?? []
    list.push(commit)
    placedByLane.set(commit.lane, list)
  }
  for (const list of placedByLane.values()) {
    const ordered = [...list].sort((a, b) => a.cardTop - b.cardTop)
    for (let index = 0; index < ordered.length - 1; index++) {
      neighborBelow.set(ordered[index]!.id, ordered[index + 1]!.id)
    }
  }

  const pending = laidOut.flatMap((commit) =>
    commit.parents.flatMap((parentID, index) => {
      const parent = placed.get(parentID)
      if (!parent) return []
      const kind = edgeKind(commit, parent, index)
      if (kind === "continue" && neighborBelow.get(commit.id) !== parent.id) return []
      return [{ child: commit, parent, kind }]
    }),
  )
  const columnByLane = packColumns(laidOut, snapshot.head.commitID)
  const packed = laidOut.map((commit) => {
    const lane = columnByLane.get(commit.lane) ?? 0
    const cardLeft = paddingX + lane * lanePitch
    return { ...commit, lane, cardLeft, x: cardLeft + cardWidth / 2 }
  })
  const packedById = new Map(packed.map((commit) => [commit.id, commit]))
  const packedPending = pending.map((item) => ({
    child: packedById.get(item.child.id)!,
    parent: packedById.get(item.parent.id)!,
    kind: item.kind,
  }))
  const displayLanes = Math.max(0, ...packed.map((commit) => commit.lane))
  const ports = assignPorts(packedPending)
  const planned = planGutterTracks(packedPending, ports)
  const gaps = corridorGaps(planned.tracks, displayLanes, laneGap)
  const placedCommits = shiftLanes(packed, paddingX, cardWidth, gaps)
  const placedById = new Map(placedCommits.map((commit) => [commit.id, commit]))
  const routed = packedPending.map((item) => ({
    child: placedById.get(item.child.id)!,
    parent: placedById.get(item.parent.id)!,
    kind: item.kind,
  }))
  const gutterByKey = guttersFromPlan(planned.tracks, placedById, cardWidth)
  const occupied = { h: new Map<number, StemRun[]>(), v: new Map<number, StemRun[]>() }
  const continues = routed.filter((item) => item.kind === "continue")
  const detours = routed
    .filter((item) => item.kind !== "continue")
    .sort((left, right) => Math.abs(left.child.y - left.parent.y) - Math.abs(right.child.y - right.parent.y))

  const edges: LaidOutEdge[] = [
    ...continues.map((item) => {
      const points = routeContinue(item.child, item.parent)
      occupyPath(occupied, points)
      return makeEdge(item, points)
    }),
    ...detours.map((item) => {
      const key = edgeKey(item.child.id, item.parent.id)
      const points = routeForkMerge(
        item.child,
        item.parent,
        ports.startY.get(key) ?? item.parent.y,
        ports.endY.get(key) ?? item.child.y,
        gutterByKey.get(key)?.start,
        occupied,
      )
      occupyPath(occupied, points)
      return makeEdge(item, points)
    }),
  ]

  const stems = collectStems(edges)
  const bottom = Math.max(paddingY, ...placedCommits.map((commit) => commit.cardTop + commit.cardHeight))
  const right = Math.max(paddingX, ...placedCommits.map((commit) => commit.cardLeft + commit.cardWidth))
  return {
    commits: placedCommits,
    edges,
    refs: [],
    width: right + paddingX,
    height: bottom + paddingY,
    rowHeight: gapY,
    laneWidth: cardWidth + laneGap,
    cardWidth,
    verticals: stems.verticals,
    horizontals: stems.horizontals,
  }
}

function tipTime(item: Measured) {
  return item.commit.committerAt
}

/** Sit this thread's newest backup next to same-time backups already placed — not at the top by default. */
function tipTopBesidePlaced(placed: Map<GitCommitID, LaidOutCommit>, time: number, gapY: number) {
  const commits = [...placed.values()]
  const olderOrEqual = commits
    .filter((commit) => commit.committerAt <= time)
    .sort((a, b) => b.committerAt - a.committerAt)
  const match = olderOrEqual[0]
  if (match) return match.cardTop
  const oldest = commits.reduce((current, commit) => (commit.committerAt < current.committerAt ? commit : current))
  return oldest.cardTop + oldest.cardHeight + gapY
}

function edgeKind(child: LaidOutCommit, parent: LaidOutCommit, parentIndex: number): EdgeKind {
  if (child.lane === parent.lane) return "continue"
  if (parentIndex > 0 || child.parents.length > 1) return "merge"
  return "fork"
}

export function pathKey(childID: GitCommitID, parentID: GitCommitID) {
  return `${childID}->${parentID}`
}

function edgeKey(childID: GitCommitID, parentID: GitCommitID) {
  return pathKey(childID, parentID)
}

const TRACK_INSET = 14
const TRACK_PITCH = 20

type GutterTrack = {
  key: string
  track: number
  corridor: number
  side: "start" | "end"
}

/** Overlapping forks/merges get separate tracks; non-overlapping ones reuse the closest free track. */
function planGutterTracks(
  pending: { child: LaidOutCommit; parent: LaidOutCommit; kind: EdgeKind }[],
  ports: { startY: Map<string, number>; endY: Map<string, number> },
) {
  const pools = new Map<string, { key: string; y0: number; y1: number; side: "start" | "end" }[]>()

  for (const item of pending) {
    if (item.kind === "continue") continue
    const key = edgeKey(item.child.id, item.parent.id)
    const fromY = ports.startY.get(key) ?? item.parent.y
    const toY = ports.endY.get(key) ?? item.child.y
    if (Math.abs(toY - fromY) < 8) continue
    const goingRight = facing(item.parent, item.child).dir > 0
    const y0 = Math.min(fromY, toY)
    const y1 = Math.max(fromY, toY)
    const startCorridor = goingRight ? item.parent.lane : item.parent.lane - 1
    pushPool(pools, startCorridor, { key, y0, y1, side: "start" })
    if (Math.abs(item.child.lane - item.parent.lane) <= 1) continue
    const endCorridor = goingRight ? item.child.lane - 1 : item.child.lane
    pushPool(pools, endCorridor, { key, y0, y1, side: "end" })
  }

  const tracks: GutterTrack[] = []
  for (const [corridorKey, list] of pools) {
    const corridor = Number(corridorKey)
    const ordered = [...list].sort((a, b) => a.y1 - a.y0 - (b.y1 - b.y0) || a.y0 - b.y0)
    const taken: { y0: number; y1: number; track: number }[] = []
    for (const item of ordered) {
      const used = new Set(
        taken.filter((other) => other.y0 < item.y1 + 12 && item.y0 < other.y1 + 12).map((other) => other.track),
      )
      let track = 0
      while (used.has(track)) track++
      taken.push({ y0: item.y0, y1: item.y1, track })
      tracks.push({ key: item.key, track, corridor, side: item.side })
    }
  }

  return { tracks }
}

function pushPool<T>(pools: Map<string, T[]>, corridor: number, item: T) {
  const key = String(corridor)
  const list = pools.get(key) ?? []
  list.push(item)
  pools.set(key, list)
}

function guttersFromPlan(tracks: readonly GutterTrack[], byId: Map<GitCommitID, LaidOutCommit>, cardWidth: number) {
  const laneLeft = new Map<number, number>()
  for (const commit of byId.values()) {
    if (!laneLeft.has(commit.lane)) laneLeft.set(commit.lane, commit.cardLeft)
  }
  const gutters = new Map<string, { start: number; end?: number }>()
  for (const edge of tracks) {
    const originLane = Math.max(0, edge.corridor)
    const left = laneLeft.get(originLane)
    if (left == null) continue
    const x =
      edge.corridor < 0 ? left - TRACK_INSET - edge.track * TRACK_PITCH : left + cardWidth + TRACK_INSET + edge.track * TRACK_PITCH
    const current = gutters.get(edge.key) ?? { start: x }
    if (edge.side === "end") {
      gutters.set(edge.key, { ...current, end: x })
      continue
    }
    gutters.set(edge.key, { ...current, start: x })
  }
  return gutters
}

function corridorGaps(tracks: readonly GutterTrack[], maxLane: number, fallback: number) {
  const height = new Map<number, number>()
  for (const track of tracks) {
    if (track.corridor < 0) continue
    height.set(track.corridor, Math.max(height.get(track.corridor) ?? 0, track.track + 1))
  }
  return Array.from({ length: Math.max(0, maxLane) }, (_, lane) =>
    Math.max(fallback, TRACK_INSET * 2 + (height.get(lane) ?? 0) * TRACK_PITCH),
  )
}

function shiftLanes(commits: readonly LaidOutCommit[], paddingX: number, cardWidth: number, gaps: readonly number[]) {
  const leftAt = new Map<number, number>()
  let left = paddingX
  const lastLane = Math.max(0, ...commits.map((commit) => commit.lane))
  for (let lane = 0; lane <= lastLane; lane++) {
    leftAt.set(lane, left)
    left += cardWidth + (gaps[lane] ?? 56)
  }
  return commits.map((commit) => {
    const cardLeft = leftAt.get(commit.lane)!
    return { ...commit, cardLeft, x: cardLeft + cardWidth / 2 }
  })
}

/** Sit overlapping threads in consecutive columns to the right of HEAD. */
function packColumns(commits: readonly LaidOutCommit[], headID?: GitCommitID) {
  const spans = new Map<number, { lane: number; y0: number; y1: number }>()
  for (const commit of commits) {
    const y0 = commit.cardTop
    const y1 = commit.cardTop + commit.cardHeight
    const prev = spans.get(commit.lane)
    if (!prev) {
      spans.set(commit.lane, { lane: commit.lane, y0, y1 })
      continue
    }
    prev.y0 = Math.min(prev.y0, y0)
    prev.y1 = Math.max(prev.y1, y1)
  }

  const headLane = headID ? commits.find((commit) => commit.id === headID)?.lane : undefined
  const assigned: { y0: number; y1: number; col: number }[] = []
  const columnByLane = new Map<number, number>()
  const ordered = [...spans.values()].sort((a, b) => {
    if (a.lane === headLane) return -1
    if (b.lane === headLane) return 1
    return a.lane - b.lane
  })
  for (const span of ordered) {
    if (span.lane === headLane) {
      assigned.push({ y0: span.y0, y1: span.y1, col: 0 })
      columnByLane.set(span.lane, 0)
      continue
    }
    const used = new Set(
      assigned.filter((other) => other.y0 < span.y1 + 12 && span.y0 < other.y1 + 12).map((other) => other.col),
    )
    if (headLane != null) used.add(0)
    let col = 0
    while (used.has(col)) col++
    assigned.push({ y0: span.y0, y1: span.y1, col })
    columnByLane.set(span.lane, col)
  }
  return columnByLane
}

function assignPorts(pending: { child: LaidOutCommit; parent: LaidOutCommit; kind: EdgeKind }[]) {
  const startY = new Map<string, number>()
  const endY = new Map<string, number>()
  const groups = new Map<string, { key: string; commit: LaidOutCommit; otherY: number; which: "start" | "end" }[]>()

  for (const item of pending) {
    if (item.kind === "continue") continue
    const face = facing(item.parent, item.child)
    const key = edgeKey(item.child.id, item.parent.id)
    pushPort(groups, item.parent, face.parentSide, {
      key,
      commit: item.parent,
      otherY: item.child.y,
      which: "start",
    })
    pushPort(groups, item.child, face.childSide, {
      key,
      commit: item.child,
      otherY: item.parent.y,
      which: "end",
    })
  }

  for (const list of groups.values()) {
    const ordered = [...list].sort((a, b) => a.otherY - b.otherY || a.key.localeCompare(b.key))
    const ys = portYs(ordered[0]!.commit, ordered.length)
    for (let index = 0; index < ordered.length; index++) {
      const item = ordered[index]!
      if (item.which === "start") {
        startY.set(item.key, ys[index]!)
        continue
      }
      endY.set(item.key, ys[index]!)
    }
  }

  return { startY, endY }
}

function pushPort<T>(groups: Map<string, T[]>, commit: LaidOutCommit, side: string, item: T) {
  const key = `${commit.id}:${side}`
  const list = groups.get(key) ?? []
  list.push(item)
  groups.set(key, list)
}

function portYs(commit: LaidOutCommit, count: number) {
  if (count <= 1) return [commit.y]
  const pad = Math.min(12, commit.cardHeight / 4)
  const top = commit.cardTop + pad
  const span = Math.max(0, commit.cardHeight - pad * 2)
  return Array.from({ length: count }, (_, index) => top + (span * index) / (count - 1))
}

function makeEdge(
  item: { child: LaidOutCommit; parent: LaidOutCommit; kind: EdgeKind },
  points: readonly GraphPoint[],
): LaidOutEdge {
  return {
    key: edgeKey(item.child.id, item.parent.id),
    from: item.child.id,
    to: item.parent.id,
    kind: item.kind,
    points,
    lane: item.child.lane,
    colorLane: item.kind === "merge" ? item.parent.lane : item.child.lane,
    selectable: item.kind !== "continue",
  }
}

function routeContinue(child: LaidOutCommit, parent: LaidOutCommit) {
  return [
    { x: parent.x, y: parent.cardTop },
    { x: child.x, y: child.cardTop + child.cardHeight },
  ]
}

const CLEAR = 10

type Occupied = {
  h: Map<number, StemRun[]>
  v: Map<number, StemRun[]>
}

function facing(parent: LaidOutCommit, child: LaidOutCommit) {
  const parentRight = parent.cardLeft + parent.cardWidth
  const childRight = child.cardLeft + child.cardWidth
  if (child.cardLeft >= parentRight - 1) {
    return { startX: parentRight, endX: child.cardLeft, dir: 1 as const, parentSide: "r", childSide: "l" }
  }
  if (childRight <= parent.cardLeft + 1) {
    return { startX: parent.cardLeft, endX: childRight, dir: -1 as const, parentSide: "l", childSide: "r" }
  }
  return { startX: parentRight, endX: childRight, dir: 1 as const, parentSide: "r", childSide: "r" }
}

function routeForkMerge(
  child: LaidOutCommit,
  parent: LaidOutCommit,
  startY: number,
  endY: number,
  plannedGutter: number | undefined,
  occupied: Occupied,
) {
  const face = facing(parent, child)
  const startX = face.startX
  const endX = face.endX
  const gutters = verticalTracks(startX, endX, face.dir, plannedGutter)

  const tryPath = (fromY: number, toY: number) => {
    if (Math.abs(fromY - toY) < 8) {
      const y = (fromY + toY) / 2
      const straight = [
        { x: startX, y },
        { x: endX, y },
      ]
      if (!pathHits(straight, occupied)) return straight
      return
    }
    return gutters
      .map((gutter) =>
        simplifyPath([
          { x: startX, y: fromY },
          { x: gutter, y: fromY },
          { x: gutter, y: toY },
          { x: endX, y: toY },
        ]),
      )
      .find((path) => !pathHits(path, occupied))
  }

  const direct = tryPath(startY, endY)
  if (direct) return direct

  const nudged = nudgeYs(startY, sideRange(parent))
    .flatMap((fromY) => nudgeYs(endY, sideRange(child)).map((toY) => tryPath(fromY, toY)))
    .find(Boolean)
  if (nudged) return nudged

  return simplifyPath([
    { x: startX, y: startY },
    { x: gutters[0]!, y: startY },
    { x: gutters[0]!, y: endY },
    { x: endX, y: endY },
  ])
}

function verticalTracks(startX: number, endX: number, dir: number, planned?: number) {
  if (Math.abs(endX - startX) < 2) {
    return Array.from({ length: 8 }, (_, track) => startX + dir * (TRACK_INSET + track * TRACK_PITCH))
  }
  const lo = Math.min(startX, endX) + TRACK_INSET
  const hi = Math.max(startX, endX) - TRACK_INSET
  if (hi <= lo) return [(startX + endX) / 2]
  const clamp = (value: number) => Math.min(hi, Math.max(lo, value))
  const nearStart = clamp(startX + dir * TRACK_INSET)
  const xs = [
    nearStart,
    planned == null ? nearStart : clamp(planned),
    clamp(endX - dir * TRACK_INSET),
    ...Array.from({ length: 7 }, (_, track) => clamp(nearStart + dir * (track + 1) * TRACK_PITCH)),
  ]
  const seen = new Set<number>()
  return xs.filter((x) => {
    const key = Math.round(x)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sideRange(commit: LaidOutCommit) {
  const pad = Math.min(12, commit.cardHeight / 4)
  return { lo: commit.cardTop + pad, hi: commit.cardTop + commit.cardHeight - pad }
}

function nudgeYs(y: number, range: { lo: number; hi: number }) {
  const seen = new Set<number>()
  return [y, y - 16, y + 16, range.lo, range.hi, (range.lo + range.hi) / 2].flatMap((value) => {
    const clamped = Math.min(range.hi, Math.max(range.lo, value))
    const key = Math.round(clamped)
    if (seen.has(key)) return []
    seen.add(key)
    return [clamped]
  })
}

function pathHits(points: readonly GraphPoint[], occupied: Occupied) {
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!
    const end = points[index + 1]!
    const dx = end.x - start.x
    const dy = end.y - start.y
    if (Math.hypot(dx, dy) < 8) continue
    if (dx !== 0 && dy !== 0) return true
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (hitsBucket(occupied.h, start.y, Math.min(start.x, end.x), Math.max(start.x, end.x))) return true
      continue
    }
    if (hitsBucket(occupied.v, start.x, Math.min(start.y, end.y), Math.max(start.y, end.y))) return true
  }
}

function hitsBucket(buckets: Map<number, StemRun[]>, at: number, from: number, to: number) {
  const center = Math.round(at)
  for (let delta = -CLEAR; delta <= CLEAR; delta++) {
    const runs = buckets.get(center + delta)
    if (!runs) continue
    if (runs.some((run) => Math.abs(run.at - at) < CLEAR && from < run.to - 4 && to > run.from + 4)) return true
  }
}

function occupyPath(occupied: Occupied, points: readonly GraphPoint[]) {
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!
    const end = points[index + 1]!
    const dx = end.x - start.x
    const dy = end.y - start.y
    if (Math.hypot(dx, dy) < 8) continue
    if (Math.abs(dx) >= Math.abs(dy)) {
      pushRun(occupied.h, { at: start.y, from: Math.min(start.x, end.x), to: Math.max(start.x, end.x) })
      continue
    }
    pushRun(occupied.v, { at: start.x, from: Math.min(start.y, end.y), to: Math.max(start.y, end.y) })
  }
}

function pushRun(buckets: Map<number, StemRun[]>, run: StemRun) {
  const key = Math.round(run.at)
  const list = buckets.get(key) ?? []
  list.push(run)
  buckets.set(key, list)
}

function simplifyPath(points: readonly GraphPoint[]) {
  const simplified: GraphPoint[] = []
  for (const point of points) {
    const prev = simplified.at(-1)
    if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) < 1) continue
    const older = simplified.at(-2)
    if (older && prev && collinear(older, prev, point)) {
      simplified[simplified.length - 1] = point
      continue
    }
    simplified.push(point)
  }
  return simplified
}

function collinear(a: GraphPoint, b: GraphPoint, c: GraphPoint) {
  return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
}

function collectStems(edges: readonly LaidOutEdge[]) {
  const verticals: StemRun[] = []
  const horizontals: StemRun[] = []
  for (const edge of edges) {
    for (let index = 0; index < edge.points.length - 1; index++) {
      const start = edge.points[index]!
      const end = edge.points[index + 1]!
      const dx = end.x - start.x
      const dy = end.y - start.y
      if (Math.hypot(dx, dy) < 8) continue
      if (Math.abs(dx) >= Math.abs(dy)) {
        horizontals.push({ at: start.y, from: Math.min(start.x, end.x), to: Math.max(start.x, end.x) })
        continue
      }
      verticals.push({ at: start.x, from: Math.min(start.y, end.y), to: Math.max(start.y, end.y) })
    }
  }
  return { verticals, horizontals }
}

function compareNewestFirst(a: GitGraphCommit, b: GitGraphCommit) {
  if (b.committerAt !== a.committerAt) return b.committerAt - a.committerAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Children before parents so lane allocation never invents a fake side branch on timestamp ties. */
function orderCommits(commits: readonly GitGraphCommit[]) {
  const byId = new Map(commits.map((commit) => [commit.id, commit]))
  const pendingChildren = new Map<GitCommitID, number>()
  for (const commit of commits) pendingChildren.set(commit.id, 0)
  for (const commit of commits) {
    for (const parentID of commit.parents) {
      if (!byId.has(parentID)) continue
      pendingChildren.set(parentID, (pendingChildren.get(parentID) ?? 0) + 1)
    }
  }

  const ready = commits.filter((commit) => (pendingChildren.get(commit.id) ?? 0) === 0).sort(compareNewestFirst)
  const ordered: GitGraphCommit[] = []
  const seen = new Set<GitCommitID>()

  while (ready.length > 0) {
    const commit = ready.shift()!
    if (seen.has(commit.id)) continue
    seen.add(commit.id)
    ordered.push(commit)
    for (const parentID of commit.parents) {
      const parent = byId.get(parentID)
      if (!parent) continue
      const left = (pendingChildren.get(parentID) ?? 1) - 1
      pendingChildren.set(parentID, left)
      if (left !== 0) continue
      ready.push(parent)
      ready.sort(compareNewestFirst)
    }
  }

  if (ordered.length === commits.length) return ordered
  return ordered.concat(commits.filter((commit) => !seen.has(commit.id)).sort(compareNewestFirst))
}

function allocateLanes(commits: readonly GitGraphCommit[], headID?: GitCommitID) {
  const laneByCommit = new Map<GitCommitID, number>()
  const reserved = new Map<GitCommitID, number>()
  let nextLane = 0
  if (headID) {
    reserved.set(headID, 0)
    nextLane = 1
  }

  for (const commit of commits) {
    const lane = reserved.get(commit.id) ?? nextLane++
    laneByCommit.set(commit.id, lane)

    const [first, ...rest] = commit.parents
    if (first && !reserved.has(first) && !laneByCommit.has(first)) {
      reserved.set(first, lane)
    }
    for (const parent of rest) {
      if (reserved.has(parent) || laneByCommit.has(parent)) continue
      reserved.set(parent, nextLane++)
    }
  }

  return laneByCommit
}

function labelsByCommitID(refs: readonly GitGraphRef[]) {
  const all = new Map<GitCommitID, CommitLabel[]>()
  const ordered = [...refs]
    .filter((ref) => ref.kind === "local" || ref.kind === "remote" || ref.kind === "tag")
    .sort((a, b) => {
      const rank = (ref: GitGraphRef) => (ref.kind === "local" ? 0 : ref.kind === "tag" ? 1 : 2)
      const delta = rank(a) - rank(b)
      if (delta !== 0) return delta
      return refDisplayName(a).localeCompare(refDisplayName(b))
    })

  for (const ref of ordered) {
    if (ref.kind !== "local" && ref.kind !== "remote" && ref.kind !== "tag") continue
    const list = all.get(ref.commitID) ?? []
    const name = refDisplayName(ref)
    if (list.some((item) => item.name === name && item.kind === ref.kind)) continue
    list.push({ name, kind: ref.kind })
    all.set(ref.commitID, list)
  }

  const trimmed = new Map<GitCommitID, CommitLabel[]>()
  for (const [commitID, labels] of all) {
    if (labels.length <= 3) {
      trimmed.set(commitID, labels)
      continue
    }
    trimmed.set(commitID, [...labels.slice(0, 2), { name: `+${labels.length - 2}`, kind: "remote" }])
  }
  return trimmed
}

function refDisplayName(ref: GitGraphRef) {
  if (ref.kind === "remote") return `${ref.remote}/${ref.name}`
  return ref.name
}

function truncateLabel(text: string, maxWidth: number, fontSize: number) {
  const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * 0.56)))
  const value = text.trim()
  if (value.length <= maxChars) return value
  return `${value.slice(0, Math.max(1, maxChars - 1))}…`
}

export function wrapText(text: string, maxWidth: number, fontSize: number) {
  const average = fontSize * 0.56
  const maxChars = Math.max(8, Math.floor(maxWidth / average))
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]

  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const pieces = splitLongWord(word, maxChars)
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece
      if (next.length <= maxChars) {
        current = next
        continue
      }
      if (current) lines.push(current)
      current = piece
    }
  }
  if (current) lines.push(current)
  return lines
}

function splitLongWord(word: string, maxChars: number) {
  if (word.length <= maxChars) return [word]
  const parts: string[] = []
  let rest = word
  while (rest.length > maxChars) {
    const take = splitAt(rest, maxChars)
    parts.push(rest.slice(0, take))
    rest = rest.slice(take)
  }
  if (rest) parts.push(rest)
  return parts
}

function splitAt(word: string, maxChars: number) {
  const window = word.slice(0, maxChars)
  for (let index = window.length - 1; index >= Math.ceil(maxChars * 0.4); index--) {
    if (!":/._-".includes(window[index]!)) continue
    return index + 1
  }
  const leftover = word.length - maxChars
  if (leftover <= 2) return Math.max(1, word.length - 3)
  return maxChars
}
