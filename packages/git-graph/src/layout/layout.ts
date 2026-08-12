import type { GitCommitID, GitGraphCommit, GitGraphRef, GitGraphSnapshot } from "../domain/contract"
import { backupLabel } from "../domain/contract"

export type GraphPoint = { readonly x: number; readonly y: number }

export type LaidOutCommit = {
  readonly id: GitCommitID
  readonly label: string
  readonly parents: readonly GitCommitID[]
  readonly lane: number
  readonly row: number
  readonly x: number
  readonly y: number
}

export type LaidOutEdge = {
  readonly from: GitCommitID
  readonly to: GitCommitID
  readonly fromPoint: GraphPoint
  readonly toPoint: GraphPoint
  readonly lane: number
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
}

export type LayoutOptions = {
  readonly rowHeight?: number
  readonly laneWidth?: number
  readonly paddingX?: number
  readonly paddingY?: number
  readonly labelReserve?: number
}

/**
 * Deterministic newest-first lane layout.
 * First-parent edges continue the child lane; merge parents fork sideways.
 */
export function layoutGraph(snapshot: GitGraphSnapshot, options: LayoutOptions = {}): GraphLayout {
  const rowHeight = options.rowHeight ?? 44
  const laneWidth = options.laneWidth ?? 28
  const paddingX = options.paddingX ?? 24
  const paddingY = options.paddingY ?? 24
  const labelReserve = options.labelReserve ?? 280

  const commits = orderCommits(snapshot.commits)
  const laneByCommit = allocateLanes(commits)
  const maxLane = Math.max(0, ...laneByCommit.values(), 0)

  const laidOut: LaidOutCommit[] = commits.map((commit, row) => {
    const lane = laneByCommit.get(commit.id) ?? 0
    return {
      id: commit.id,
      label: backupLabel(commit),
      parents: commit.parents,
      lane,
      row,
      x: paddingX + lane * laneWidth,
      y: paddingY + row * rowHeight,
    }
  })
  const pointByID = new Map(laidOut.map((commit) => [commit.id, commit] as const))

  const edges: LaidOutEdge[] = laidOut.flatMap((commit) =>
    commit.parents.flatMap((parentID) => {
      const parent = pointByID.get(parentID)
      if (!parent) return []
      return [
        {
          from: commit.id,
          to: parentID,
          fromPoint: { x: commit.x, y: commit.y },
          toPoint: { x: parent.x, y: parent.y },
          lane: commit.lane,
        },
      ]
    }),
  )

  const refs = layoutRefs(snapshot.refs, pointByID)

  return {
    commits: laidOut,
    edges,
    refs,
    width: paddingX * 2 + (maxLane + 1) * laneWidth + labelReserve,
    height: paddingY * 2 + Math.max(1, commits.length) * rowHeight,
    rowHeight,
    laneWidth,
  }
}

function orderCommits(commits: readonly GitGraphCommit[]) {
  return [...commits].sort((a, b) => {
    if (b.committerAt !== a.committerAt) return b.committerAt - a.committerAt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

function allocateLanes(commits: readonly GitGraphCommit[]) {
  const laneByCommit = new Map<GitCommitID, number>()
  const reserved = new Map<GitCommitID, number>()
  const open = new Set<number>()
  let nextLane = 0

  const allocate = () => {
    for (let lane = 0; lane < nextLane; lane++) {
      if (!open.has(lane)) {
        open.add(lane)
        return lane
      }
    }
    const lane = nextLane++
    open.add(lane)
    return lane
  }

  for (const commit of commits) {
    const lane = reserved.get(commit.id) ?? allocate()
    laneByCommit.set(commit.id, lane)
    open.delete(lane)

    const [first, ...rest] = commit.parents
    if (first && !reserved.has(first) && !laneByCommit.has(first)) {
      reserved.set(first, lane)
      open.add(lane)
    }
    for (const parent of rest) {
      if (reserved.has(parent) || laneByCommit.has(parent)) continue
      const side = allocate()
      reserved.set(parent, side)
    }
  }

  return laneByCommit
}

function layoutRefs(refs: readonly GitGraphRef[], pointByID: Map<GitCommitID, LaidOutCommit>) {
  const stacks = new Map<GitCommitID, number>()
  const interesting = refs.filter((ref) => ref.kind !== "head" || !!ref.commitID)

  // Prefer branch tips / tags; HEAD is drawn as a selected ring, not a pill stack item unless detached naming helps.
  const ordered = [...interesting].sort((a, b) => {
    const rank = (ref: GitGraphRef) => (ref.kind === "local" ? 0 : ref.kind === "head" ? 1 : ref.kind === "tag" ? 2 : 3)
    const delta = rank(a) - rank(b)
    if (delta !== 0) return delta
    return refDisplayName(a).localeCompare(refDisplayName(b))
  })

  return ordered.flatMap((ref) => {
    if (ref.kind === "head") return []
    const commit = pointByID.get(ref.commitID)
    if (!commit) return []
    const stackIndex = stacks.get(ref.commitID) ?? 0
    stacks.set(ref.commitID, stackIndex + 1)
    if (stackIndex >= 3) return []
    return [
      {
        name: refDisplayName(ref),
        kind: ref.kind,
        commitID: ref.commitID,
        remote: ref.remote,
        x: commit.x + 18,
        y: commit.y - 12 - stackIndex * 18,
        stackIndex,
      } satisfies LaidOutRef,
    ]
  })
}

function refDisplayName(ref: GitGraphRef) {
  if (ref.kind === "remote") return `${ref.remote}/${ref.name}`
  if (ref.kind === "head") return "HEAD"
  return ref.name
}
