import { createSignal } from "solid-js"
import type { GraphLayout } from "../layout"
import { createCamera, hitTestCommit, screenToWorld, type Camera } from "../render/canvas"

export type GraphInteraction = {
  camera: () => Camera
  selectedID: () => string | undefined
  hoveringID: () => string | undefined
  pan: (dx: number, dy: number) => void
  zoomAt: (screenX: number, screenY: number, factor: number) => void
  selectAt: (layout: GraphLayout, screenX: number, screenY: number) => string | undefined
  hoverAt: (layout: GraphLayout, screenX: number, screenY: number) => string | undefined
  clearSelection: () => void
  resetCamera: () => void
  setSelectedID: (id?: string) => void
}

export function createGraphInteraction(initial?: Partial<Camera>): GraphInteraction {
  const [camera, setCamera] = createSignal(createCamera(initial))
  const [selectedID, setSelectedID] = createSignal<string>()
  const [hoveringID, setHoveringID] = createSignal<string>()

  return {
    camera,
    selectedID,
    hoveringID,
    pan: (dx, dy) => {
      const current = camera()
      setCamera({
        x: current.x - dx / current.zoom,
        y: current.y - dy / current.zoom,
        zoom: current.zoom,
      })
    },
    zoomAt: (screenX, screenY, factor) => {
      const current = camera()
      const before = screenToWorld(current, screenX, screenY)
      const nextZoom = clamp(current.zoom * factor, 0.35, 2.5)
      setCamera({
        zoom: nextZoom,
        x: before.x - screenX / nextZoom,
        y: before.y - screenY / nextZoom,
      })
    },
    selectAt: (layout, screenX, screenY) => {
      const world = screenToWorld(camera(), screenX, screenY)
      const hit = hitTestCommit(layout, world.x, world.y)
      setSelectedID(hit?.id)
      return hit?.id
    },
    hoverAt: (layout, screenX, screenY) => {
      const world = screenToWorld(camera(), screenX, screenY)
      const hit = hitTestCommit(layout, world.x, world.y)
      setHoveringID(hit?.id)
      return hit?.id
    },
    clearSelection: () => setSelectedID(undefined),
    resetCamera: () => setCamera(createCamera()),
    setSelectedID,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
