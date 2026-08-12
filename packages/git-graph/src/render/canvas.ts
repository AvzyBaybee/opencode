import type { GraphLayout, GraphPoint, LaidOutCommit } from "../layout"

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
  readonly focus: string
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
  focus: "#6b8cff",
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
  headID?: string
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
  ctx.lineWidth = 2 / input.camera.zoom
  ctx.strokeStyle = colors.edge
  for (const edge of input.layout.edges) {
    if (!edgeVisible(edge.fromPoint, edge.toPoint, view)) continue
    ctx.beginPath()
    ctx.moveTo(edge.fromPoint.x, edge.fromPoint.y)
    const midY = (edge.fromPoint.y + edge.toPoint.y) / 2
    ctx.bezierCurveTo(edge.fromPoint.x, midY, edge.toPoint.x, midY, edge.toPoint.x, edge.toPoint.y)
    ctx.stroke()
  }

  for (const commit of input.layout.commits) {
    if (!pointVisible(commit.x, commit.y, view, 40)) continue
    drawCommit(ctx, commit, colors, input.selectedID === commit.id, input.headID === commit.id, input.camera.zoom)
  }

  for (const ref of input.layout.refs) {
    if (!pointVisible(ref.x, ref.y, view, 80)) continue
    drawPill(ctx, ref.x, ref.y, ref.name, colors, input.camera.zoom)
  }

  ctx.restore()
}

export function hitTestCommit(layout: GraphLayout, worldX: number, worldY: number) {
  let best: LaidOutCommit | undefined
  let bestDist = 18
  for (const commit of layout.commits) {
    const labelLeft = commit.x + 14
    const labelRight = labelLeft + Math.min(240, Math.max(40, commit.label.length * 7))
    const inLabel =
      worldX >= labelLeft && worldX <= labelRight && worldY >= commit.y - 11 && worldY <= commit.y + 11
    const dx = commit.x - worldX
    const dy = commit.y - worldY
    const dist = Math.hypot(dx, dy)
    if (inLabel) return commit
    if (dist < bestDist) {
      best = commit
      bestDist = dist
    }
  }
  return best
}

function drawCommit(
  ctx: CanvasRenderingContext2D,
  commit: LaidOutCommit,
  colors: ThemeColors,
  selected: boolean,
  isHead: boolean,
  zoom: number,
) {
  const radius = 5
  ctx.beginPath()
  ctx.arc(commit.x, commit.y, radius, 0, Math.PI * 2)
  if (isHead) {
    ctx.strokeStyle = colors.nodeHead
    ctx.lineWidth = 2 / zoom
    ctx.stroke()
  } else {
    ctx.fillStyle = selected ? colors.nodeSelected : colors.node
    ctx.fill()
  }
  if (selected) {
    ctx.beginPath()
    ctx.arc(commit.x, commit.y, radius + 3, 0, Math.PI * 2)
    ctx.strokeStyle = colors.focus
    ctx.lineWidth = 1.5 / zoom
    ctx.stroke()
  }

  const labelX = commit.x + 14
  const maxWidth = 240
  ctx.font = `${12 / Math.max(zoom, 0.75)}px Inter, ui-sans-serif, system-ui, sans-serif`
  ctx.textBaseline = "middle"
  const text = truncate(ctx, commit.label, maxWidth)
  const metrics = ctx.measureText(text)
  const padX = 8
  const w = metrics.width + padX * 2
  const h = 22
  roundRect(ctx, labelX, commit.y - h / 2, w, h, 10)
  ctx.fillStyle = "rgba(30,30,30,0.92)"
  ctx.fill()
  ctx.fillStyle = colors.label
  ctx.fillText(text, labelX + padX, commit.y)
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  colors: ThemeColors,
  zoom: number,
) {
  ctx.font = `${10 / Math.max(zoom, 0.75)}px Inter, ui-sans-serif, system-ui, sans-serif`
  ctx.textBaseline = "middle"
  const label = truncate(ctx, text, 120)
  const metrics = ctx.measureText(label)
  const padX = 7
  const h = 18
  const w = metrics.width + padX * 2
  roundRect(ctx, x, y - h / 2, w, h, 9)
  ctx.fillStyle = colors.pillFill
  ctx.fill()
  ctx.fillStyle = colors.pillText
  ctx.fillText(label, x + padX, y)
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

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let value = text
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1)
  }
  return `${value}…`
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

function pointVisible(x: number, y: number, view: ReturnType<typeof visibleBounds>, pad: number) {
  return x >= view.left - pad && x <= view.right + pad && y >= view.top - pad && y <= view.bottom + pad
}

function edgeVisible(a: GraphPoint, b: GraphPoint, view: ReturnType<typeof visibleBounds>) {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  return maxX >= view.left && minX <= view.right && maxY >= view.top && minY <= view.bottom
}
