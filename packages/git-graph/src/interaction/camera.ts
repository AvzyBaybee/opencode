import { createSignal } from "solid-js"
import type { GitCommitID } from "../domain/contract"
import type { GraphLayout } from "../layout"
import { createCamera, hitTestCommit, hitTestEdge, hitTestLocalLabel, screenToWorld, type Camera } from "../render/canvas"

const FLY_MS = 300

export type GraphInteraction = {
  camera: () => Camera
  selectedID: () => string | undefined
  hoveringID: () => string | undefined
  hoveringEdgeKey: () => string | undefined
  selectedEdgeKey: () => string | undefined
  hoveringLabel: () => string | undefined
  pan: (dx: number, dy: number) => void
  zoomAt: (screenX: number, screenY: number, factor: number) => void
  selectAt: (layout: GraphLayout, screenX: number, screenY: number) => string | undefined
  hoverAt: (layout: GraphLayout, screenX: number, screenY: number) => void
  clearHover: () => void
  clearSelection: () => void
  resetCamera: () => void
  fitTips: (layout: GraphLayout, width: number, height: number) => void
  setSelectedID: (id?: string) => void
  setHoveringID: (id?: string) => void
  flyToCommit: (layout: GraphLayout, id: GitCommitID, width: number, height: number) => void
  cancelFly: () => void
}

export function createGraphInteraction(initial?: Partial<Camera>): GraphInteraction {
  const [camera, setCamera] = createSignal(createCamera(initial))
  const [selectedID, setSelectedID] = createSignal<string>()
  const [hoveringID, setHoveringID] = createSignal<string>()
  const [hoveringEdgeKey, setHoveringEdgeKey] = createSignal<string>()
  const [hoveringLabel, setHoveringLabel] = createSignal<string>()
  const [selectedEdgeKey, setSelectedEdgeKey] = createSignal<string>()
  let flyHandle = 0

  const cancelFly = () => {
    if (!flyHandle) return
    cancelAnimationFrame(flyHandle)
    flyHandle = 0
  }

  return {
    camera,
    selectedID,
    hoveringID,
    hoveringEdgeKey,
    hoveringLabel,
    selectedEdgeKey,
    pan: (dx, dy) => {
      cancelFly()
      const current = camera()
      setCamera({
        x: current.x - dx / current.zoom,
        y: current.y - dy / current.zoom,
        zoom: current.zoom,
      })
    },
    zoomAt: (screenX, screenY, factor) => {
      cancelFly()
      const current = camera()
      const before = screenToWorld(current, screenX, screenY)
      const nextZoom = clamp(current.zoom * factor, 0.2, 2.5)
      setCamera({
        zoom: nextZoom,
        x: before.x - screenX / nextZoom,
        y: before.y - screenY / nextZoom,
      })
    },
    selectAt: (layout, screenX, screenY) => {
      const world = screenToWorld(camera(), screenX, screenY)
      const commit = hitTestCommit(layout, world.x, world.y)
      if (commit) {
        setSelectedID(commit.id)
        setSelectedEdgeKey(undefined)
        return commit.id
      }
      const edge = hitTestEdge(layout, world.x, world.y, 8 / camera().zoom)
      if (edge) {
        setSelectedID(undefined)
        setSelectedEdgeKey(edge.key)
        return
      }
      setSelectedID(undefined)
      setSelectedEdgeKey(undefined)
    },
    hoverAt: (layout, screenX, screenY) => {
      const world = screenToWorld(camera(), screenX, screenY)
      const label = hitTestLocalLabel(layout, world.x, world.y)
      if (label) {
        setHoveringLabel(label)
        setHoveringID(undefined)
        setHoveringEdgeKey(undefined)
        return
      }
      setHoveringLabel(undefined)
      const commit = hitTestCommit(layout, world.x, world.y)
      if (commit) {
        setHoveringID(commit.id)
        setHoveringEdgeKey(undefined)
        return
      }
      const edge = hitTestEdge(layout, world.x, world.y, 8 / camera().zoom)
      setHoveringID(undefined)
      setHoveringEdgeKey(edge?.key)
    },
    clearHover: () => {
      setHoveringID(undefined)
      setHoveringEdgeKey(undefined)
      setHoveringLabel(undefined)
    },
    clearSelection: () => {
      setSelectedID(undefined)
      setSelectedEdgeKey(undefined)
    },
    resetCamera: () => {
      cancelFly()
      setCamera(createCamera())
    },
    fitTips: (layout, width, height) => {
      cancelFly()
      if (width < 2 || height < 2 || layout.commits.length === 0) return
      const tips = layout.commits.filter((commit) => commit.labels.length > 0)
      const focus = tips.length > 0 ? tips : layout.commits.slice(0, Math.min(12, layout.commits.length))
      const pad = 48
      const minX = Math.min(...focus.map((commit) => commit.cardLeft)) - pad
      const maxX = Math.max(...focus.map((commit) => commit.cardLeft + commit.cardWidth)) + pad
      const minY = Math.min(...focus.map((commit) => commit.cardTop)) - 40
      const maxY = Math.max(...focus.map((commit) => commit.cardTop + commit.cardHeight)) + pad
      const zoom = clamp(Math.min(width / Math.max(1, maxX - minX), height / Math.max(1, maxY - minY)), 0.2, 1.4)
      setCamera({
        zoom,
        x: (minX + maxX) / 2 - width / 2 / zoom,
        y: minY - 24 / zoom,
      })
    },
    setSelectedID,
    setHoveringID,
    cancelFly,
    flyToCommit: (layout, id, width, height) => {
      const commit = layout.commits.find((item) => item.id === id)
      if (!commit) return
      cancelFly()
      setSelectedID(id)
      const start = camera()
      const targetX = commit.x - width / 2 / start.zoom
      const targetY = commit.y - height / 2 / start.zoom
      const fromX = start.x
      const fromY = start.y
      const began = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - began) / FLY_MS)
        const eased = 1 - (1 - t) ** 3
        setCamera({
          x: fromX + (targetX - fromX) * eased,
          y: fromY + (targetY - fromY) * eased,
          zoom: start.zoom,
        })
        if (t < 1) {
          flyHandle = requestAnimationFrame(tick)
          return
        }
        flyHandle = 0
      }
      flyHandle = requestAnimationFrame(tick)
    },
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
