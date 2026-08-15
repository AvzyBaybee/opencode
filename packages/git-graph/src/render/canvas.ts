import type { CommitLabel, GraphLayout, GraphPoint, LaidOutCommit, StemRun } from "../layout"
import { colorForLane } from "./lane-color"

export type Camera = {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

export type ThemeColors = {
  readonly background: string
  readonly edge: string
  readonly node: string
  readonly nodeSelected: string
  readonly nodeHead: string
  readonly label: string
  readonly labelMuted: string
  readonly pillFill: string
  readonly pillText: string
  readonly pillLocal: string
  readonly pillRemote: string
  readonly pillTag: string
  readonly focus: string
  readonly cardFill: string
  readonly cardBorder: string
}

export const DEFAULT_THEME: ThemeColors = {
  background: "#141414",
  edge: "#4f7cff",
  node: "#4f7cff",
  nodeSelected: "#8eb0ff",
  nodeHead: "#4f7cff",
  label: "#e8e8e8",
  labelMuted: "#9a9a9a",
  pillFill: "#2a2a2a",
  pillText: "#d2d2d2",
  pillLocal: "#6b8cff",
  pillRemote: "#7a7a7a",
  pillTag: "#c4a35a",
  focus: "#6b8cff",
  cardFill: "rgba(30,30,30,0.96)",
  cardBorder: "#2f2f2f",
}

export function createCamera(partial?: Partial<Camera>): Camera {
  return {
    x: partial?.x ?? 0,
    y: partial?.y ?? 0,
    zoom: partial?.zoom ?? 1,
  }
}

export function worldToScreen(camera: Camera, x: number, y: number) {
  return {
    x: (x - camera.x) * camera.zoom,
    y: (y - camera.y) * camera.zoom,
  }
}

export function screenToWorld(camera: Camera, x: number, y: number) {
  return {
    x: x / camera.zoom + camera.x,
    y: y / camera.zoom + camera.y,
  }
}

export function drawGraph(input: {
  ctx: CanvasRenderingContext2D
  layout: GraphLayout
  camera: Camera
  width: number
  height: number
  selectedID?: string
  hoveringID?: string
  hoveringEdgeKey?: string
  selectedEdgeKey?: string
  highlightIDs?: readonly string[]
  headID?: string
  detached?: boolean
  light?: boolean
  colors?: ThemeColors
  dpr?: number
}) {
  const colors = input.colors ?? DEFAULT_THEME
  const dpr = input.dpr ?? 1
  const ctx = input.ctx
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, input.width, input.height)
  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, input.width, input.height)

  ctx.save()
  ctx.scale(input.camera.zoom, input.camera.zoom)
  ctx.translate(-input.camera.x, -input.camera.y)

  const view = visibleBounds(input.camera, input.width, input.height)
  const zoom = input.camera.zoom
  const light = Boolean(input.light)
  const stems = { verticals: input.layout.verticals, horizontals: input.layout.horizontals }
  const activeKey = input.hoveringEdgeKey ?? input.selectedEdgeKey
  const visibleCommits = input.layout.commits.filter((commit) => cardVisible(commit, view))
  for (const edge of input.layout.edges) {
    if (!polylineVisible(edge.points, view)) continue
    if (edge.key === activeKey) continue
    ctx.strokeStyle = colorForLane(edge.colorLane, light)
    ctx.lineWidth = 2 / zoom
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    strokePolyline(ctx, edge.points)
    drawChevrons(ctx, edge.points, zoom, visibleCommits, stems)
  }

  const active = input.layout.edges.find((edge) => edge.key === activeKey)
  if (active && polylineVisible(active.points, view)) {
    ctx.strokeStyle = colors.focus
    ctx.lineWidth = 3.4 / zoom
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    strokePolyline(ctx, active.points)
    drawChevrons(ctx, active.points, zoom, visibleCommits, stems)
  }

  const highlighted = new Set(input.highlightIDs ?? [])
  for (const commit of visibleCommits) {
    drawCommit(
      ctx,
      commit,
      colors,
      input.selectedID === commit.id,
      input.hoveringID === commit.id,
      input.headID === commit.id,
      Boolean(input.detached && input.headID === commit.id),
      highlighted.has(commit.id),
      zoom,
      colorForLane(commit.lane, light),
    )
  }

  for (const commit of visibleCommits) {
    if (commit.labels.length === 0) continue
    drawLabels(ctx, commit, colors, colorForLane(commit.lane, light))
  }

  ctx.restore()
}

export function hitTestCommit(layout: GraphLayout, worldX: number, worldY: number) {
  for (const commit of layout.commits) {
    if (
      worldX >= commit.cardLeft &&
      worldX <= commit.cardLeft + commit.cardWidth &&
      worldY >= commit.cardTop &&
      worldY <= commit.cardTop + commit.cardHeight
    ) {
      return commit
    }
  }
}

export function hitTestEdge(layout: GraphLayout, worldX: number, worldY: number, threshold: number) {
  let best: { edge: (typeof layout.edges)[number]; distance: number } | undefined
  for (const edge of layout.edges) {
    if (!edge.selectable) continue
    if (!polylineNear(edge.points, worldX, worldY, threshold + 8)) continue
    const distance = distanceToPolyline(worldX, worldY, edge.points)
    if (distance > threshold) continue
    if (best && best.distance <= distance) continue
    best = { edge, distance }
  }
  return best?.edge
}

const CHEVRON_PITCH = 36
const CHEVRON_CLEAR = 8

/** Fixed pitch along the segment. Drop a mark only if it lands on a real crossing. */
export function chevronPointsAlong(start: GraphPoint, end: GraphPoint, crossings: readonly number[] = []) {
  return chevronMarksOnPolyline([start, end], axisRuns(crossings, start, end)).map((mark) => mark.point)
}

function axisRuns(crossings: readonly number[], start: GraphPoint, end: GraphPoint): { verticals: StemRun[]; horizontals: StemRun[] } {
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
  if (horizontal) {
    return {
      verticals: crossings.map((at) => ({
        at,
        from: Math.min(start.y, end.y) - 40,
        to: Math.max(start.y, end.y) + 40,
      })),
      horizontals: [],
    }
  }
  return {
    verticals: [],
    horizontals: crossings.map((at) => ({
      at,
      from: Math.min(start.x, end.x) - 40,
      to: Math.max(start.x, end.x) + 40,
    })),
  }
}

function chevronMarksOnPolyline(
  points: readonly GraphPoint[],
  stems: { verticals: readonly StemRun[]; horizontals: readonly StemRun[] },
) {
  const marks: { point: GraphPoint; angle: number }[] = []
  let traveled = 0
  let next = CHEVRON_PITCH / 2
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!
    const end = points[index + 1]!
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    if (length < 1) continue
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const angle = Math.atan2(dy, dx)
    while (next < traveled + length) {
      const along = next - traveled
      if (along >= 1 && length - along >= 1) {
        const t = along / length
        const point = { x: start.x + dx * t, y: start.y + dy * t }
        if (!blockedByStem(point, horizontal, stems)) marks.push({ point, angle })
      }
      next += CHEVRON_PITCH
    }
    traveled += length
  }
  return marks
}

function blockedByStem(
  point: GraphPoint,
  horizontal: boolean,
  stems: { verticals: readonly StemRun[]; horizontals: readonly StemRun[] },
) {
  if (horizontal) {
    return stems.verticals.some(
      (run) => Math.abs(run.at - point.x) < CHEVRON_CLEAR && point.y > run.from && point.y < run.to,
    )
  }
  return stems.horizontals.some(
    (run) => Math.abs(run.at - point.y) < CHEVRON_CLEAR && point.x > run.from && point.x < run.to,
  )
}

function drawCommit(
  ctx: CanvasRenderingContext2D,
  commit: LaidOutCommit,
  colors: ThemeColors,
  selected: boolean,
  hovering: boolean,
  isHead: boolean,
  detachedHere: boolean,
  highlighted: boolean,
  zoom: number,
  laneColor: string,
) {
  ctx.save()
  roundRect(ctx, commit.cardLeft, commit.cardTop, commit.cardWidth, commit.cardHeight, 10)
  if (highlighted) {
    ctx.fillStyle = colors.focus
    ctx.globalAlpha = 0.34
    ctx.fill()
    ctx.globalAlpha = 1
  } else {
    if (!commit.onCloud) ctx.globalAlpha = 0.42
    ctx.fillStyle = colors.cardFill
    ctx.fill()
  }
  ctx.strokeStyle = selected || highlighted ? colors.focus : hovering ? colors.nodeSelected : isHead ? laneColor : colors.cardBorder
  ctx.lineWidth = (selected || highlighted ? 2.4 : hovering || isHead ? 2.4 : 1) / zoom
  ctx.stroke()

  const fontSize = 12
  const mutedSize = 10
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  if (detachedHere) {
    ctx.font = `${mutedSize}px Inter, ui-sans-serif, system-ui, sans-serif`
    ctx.fillStyle = colors.labelMuted
    ctx.fillText("you are here · no branch name", commit.x, commit.cardTop - 22)
  }

  ctx.font = `${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
  ctx.fillStyle = colors.label
  ctx.fillText(commit.lines[0] ?? "", commit.x, commit.y)
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.restore()
}

function drawLabels(ctx: CanvasRenderingContext2D, commit: LaidOutCommit, colors: ThemeColors, laneColor: string) {
  const pillH = 16
  const gap = 6
  const pad = 7
  const textY = commit.cardTop - 8 - pillH
  ctx.font = `10px Inter, ui-sans-serif, system-ui, sans-serif`
  const widths = commit.labels.map((label) => ctx.measureText(label.name).width + pad * 2)
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, commit.labels.length - 1)
  let x = commit.x - total / 2
  for (let index = 0; index < commit.labels.length; index++) {
    const label = commit.labels[index]!
    const width = widths[index]!
    roundRect(ctx, x, textY, width, pillH, 8)
    ctx.fillStyle = pillFill(label, colors, laneColor)
    ctx.fill()
    ctx.fillStyle = pillText(label, colors)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(label.name, x + width / 2, textY + pillH / 2)
    x += width + gap
  }
  ctx.textBaseline = "top"
}

function pillFill(label: CommitLabel, colors: ThemeColors, laneColor: string) {
  if (label.kind === "local") return laneColor
  if (label.kind === "tag") return colors.pillTag
  return colors.pillFill
}

function pillText(label: CommitLabel, colors: ThemeColors) {
  if (label.kind === "local") return "#f4f6ff"
  if (label.kind === "tag") return "#1a1408"
  return colors.pillRemote
}

function strokePolyline(ctx: CanvasRenderingContext2D, points: readonly GraphPoint[]) {
  const first = points[0]
  if (!first) return
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

function drawChevrons(
  ctx: CanvasRenderingContext2D,
  points: readonly GraphPoint[],
  zoom: number,
  commits: readonly LaidOutCommit[],
  stems: { verticals: readonly StemRun[]; horizontals: readonly StemRun[] },
) {
  const size = 3.5
  ctx.lineWidth = 1.25 / zoom
  ctx.lineCap = "butt"
  ctx.lineJoin = "miter"
  for (const mark of chevronMarksOnPolyline(points, stems)) {
    if (insideCard(mark.point, commits, 2)) continue
    drawChevron(ctx, mark.point.x, mark.point.y, mark.angle, size)
  }
}

function polylineNear(points: readonly GraphPoint[], x: number, y: number, pad: number) {
  if (points.length === 0) return false
  let minX = points[0]!.x
  let maxX = points[0]!.x
  let minY = points[0]!.y
  let maxY = points[0]!.y
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  return x >= minX - pad && x <= maxX + pad && y >= minY - pad && y <= maxY + pad
}

function distanceToPolyline(x: number, y: number, points: readonly GraphPoint[]) {
  let best = Infinity
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!
    const end = points[index + 1]!
    best = Math.min(best, distanceToSegment(x, y, start.x, start.y, end.x, end.y))
  }
  return best
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const length = dx * dx + dy * dy
  if (length < 1) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function insideCard(point: GraphPoint, commits: readonly LaidOutCommit[], pad = 6) {
  return commits.some(
    (commit) =>
      point.x >= commit.cardLeft - pad &&
      point.x <= commit.cardLeft + commit.cardWidth + pad &&
      point.y >= commit.cardTop - pad &&
      point.y <= commit.cardTop + commit.cardHeight + pad,
  )
}

function drawChevron(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(-size, -size * 0.7)
  ctx.lineTo(0, 0)
  ctx.lineTo(-size, size * 0.7)
  ctx.stroke()
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function visibleBounds(camera: Camera, width: number, height: number) {
  const topLeft = screenToWorld(camera, 0, 0)
  const bottomRight = screenToWorld(camera, width, height)
  return {
    left: topLeft.x - 80,
    top: topLeft.y - 80,
    right: bottomRight.x + 80,
    bottom: bottomRight.y + 80,
  }
}

function cardVisible(commit: LaidOutCommit, view: ReturnType<typeof visibleBounds>) {
  return (
    commit.cardLeft + commit.cardWidth >= view.left &&
    commit.cardLeft <= view.right &&
    commit.cardTop + commit.cardHeight >= view.top &&
    commit.cardTop <= view.bottom
  )
}

function polylineVisible(points: readonly GraphPoint[], view: ReturnType<typeof visibleBounds>) {
  if (points.length === 0) return false
  let minX = points[0]!.x
  let maxX = points[0]!.x
  let minY = points[0]!.y
  let maxY = points[0]!.y
  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  return maxX >= view.left && minX <= view.right && maxY >= view.top && minY <= view.bottom
}
