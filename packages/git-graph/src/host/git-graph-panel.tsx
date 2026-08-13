import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { GitGraphSnapshot, GitGraphSource } from "../domain/contract"
import { layoutGraph } from "../layout"
import { createGraphInteraction } from "../interaction"
import { drawGraph } from "../render/canvas"
import { canvasColors } from "../compat/theme"
import { PathPopup } from "../details/path-popup"
import { CommitTooltip, type GitGraphActions } from "../details/commit-tooltip"
import { en, statusMessage, type GitGraphCopy } from "../i18n/en"

export type GitGraphPanelProps = {
  readonly source: GitGraphSource
  readonly copy?: GitGraphCopy
  readonly colorScheme?: "light" | "dark"
  readonly class?: string
  readonly onSelect?: (commitID?: string) => void
  readonly onSnapshot?: (snapshot: GitGraphSnapshot) => void
  readonly actions?: GitGraphActions
}

export function GitGraphPanel(props: GitGraphPanelProps) {
  const copy = () => props.copy ?? en
  const interaction = createGraphInteraction()
  const [snapshot, setSnapshot] = createSignal<GitGraphSnapshot>()
  const [size, setSize] = createSignal({ width: 1, height: 1 })
  const [pathPop, setPathPop] = createSignal<{ x: number; y: number }>()
  let canvas: HTMLCanvasElement | undefined
  let host: HTMLDivElement | undefined
  let dragging = false
  let moved = false
  let lastX = 0
  let lastY = 0
  let paintHandle = 0
  let bufferWidth = 0
  let bufferHeight = 0

  const layout = createMemo(() => {
    const current = snapshot()
    if (!current) return
    return layoutGraph(current)
  })

  const message = createMemo(() => {
    const current = snapshot()
    if (!current) return copy().loading
    if (current.status.kind === "ready") return ""
    return statusMessage(copy(), current.status.kind, "message" in current.status ? current.status.message : undefined)
  })

  const selected = createMemo(() => {
    const id = interaction.selectedID()
    const current = snapshot()
    if (!id || !current) return
    return current.commits.find((commit) => commit.id === id)
  })

  const selectedPath = createMemo(() => {
    const key = interaction.selectedEdgeKey()
    const current = layout()
    if (!key || !current) return
    const edge = current.edges.find((item) => item.key === key)
    if (!edge) return
    const child = current.commits.find((commit) => commit.id === edge.from)
    const parent = current.commits.find((commit) => commit.id === edge.to)
    if (!child || !parent) return
    return { edge, child, parent }
  })

  const pathOverlay = createMemo(() => {
    const path = selectedPath()
    const pop = pathPop()
    if (!path || !pop) return
    return { ...path, x: pop.x, y: pop.y }
  })

  const paint = () => {
    const node = canvas
    const currentLayout = layout()
    const current = snapshot()
    if (!node || !currentLayout || !current) return
    const ctx = node.getContext("2d")
    if (!ctx) return
    const { width, height } = size()
    const dpr = window.devicePixelRatio || 1
    const nextWidth = Math.max(1, Math.floor(width * dpr))
    const nextHeight = Math.max(1, Math.floor(height * dpr))
    if (bufferWidth !== nextWidth || bufferHeight !== nextHeight) {
      node.width = nextWidth
      node.height = nextHeight
      node.style.width = `${width}px`
      node.style.height = `${height}px`
      bufferWidth = nextWidth
      bufferHeight = nextHeight
    }
    drawGraph({
      ctx,
      layout: currentLayout,
      camera: interaction.camera(),
      width,
      height,
      selectedID: interaction.selectedID(),
      hoveringID: interaction.hoveringID(),
      hoveringEdgeKey: interaction.hoveringEdgeKey(),
      selectedEdgeKey: interaction.selectedEdgeKey(),
      headID: current.head.commitID,
      detached: current.head.detached,
      light: (props.colorScheme ?? "dark") === "light",
      colors: canvasColors(props.colorScheme ?? "dark"),
      dpr,
    })
  }

  const schedulePaint = () => {
    if (paintHandle) return
    paintHandle = requestAnimationFrame(() => {
      paintHandle = 0
      paint()
    })
  }

  onMount(() => {
    if (!host) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(host)
    onCleanup(() => {
      observer.disconnect()
      if (paintHandle) cancelAnimationFrame(paintHandle)
      interaction.cancelFly()
    })
  })

  let fittedFor = ""

  createEffect(() => {
    fittedFor = ""
    const stop = props.source.subscribe((next) => {
      setSnapshot(next)
      props.onSnapshot?.(next)
    })
    onCleanup(stop)
  })

  createEffect(() => {
    const current = snapshot()
    const currentLayout = layout()
    const { width, height } = size()
    if (!current || current.status.kind !== "ready" || !currentLayout) return
    const key = `${current.repositoryRoot}:${current.commits.length}:${current.refs.length}:${width}x${height}`
    if (fittedFor === key) return
    fittedFor = key
    interaction.fitTips(currentLayout, width, height)
  })

  createEffect(() => {
    snapshot()
    layout()
    size()
    interaction.camera()
    interaction.selectedID()
    interaction.hoveringID()
    interaction.hoveringEdgeKey()
    interaction.selectedEdgeKey()
    props.colorScheme
    schedulePaint()
  })

  const onPointerDown = (event: PointerEvent) => {
    dragging = true
    moved = false
    lastX = event.clientX
    lastY = event.clientY
    canvas?.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    const currentLayout = layout()
    if (dragging) {
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      if (Math.hypot(dx, dy) > 2) moved = true
      interaction.pan(dx, dy)
      lastX = event.clientX
      lastY = event.clientY
      schedulePaint()
      return
    }
    if (!currentLayout || !host) return
    const rect = host.getBoundingClientRect()
    interaction.hoverAt(currentLayout, event.clientX - rect.left, event.clientY - rect.top)
    schedulePaint()
  }

  const onPointerUp = (event: PointerEvent) => {
    const currentLayout = layout()
    if (currentLayout && host && !moved) {
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const id = interaction.selectAt(currentLayout, x, y)
      props.onSelect?.(id)
      if (interaction.selectedEdgeKey()) setPathPop({ x, y })
      if (!interaction.selectedEdgeKey()) setPathPop(undefined)
      schedulePaint()
    }
    dragging = false
    moved = false
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    if (!host) return
    const rect = host.getBoundingClientRect()
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
    interaction.zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor)
    schedulePaint()
  }

  return (
    <div class={`git-graph-root relative size-full min-h-0 ${props.class ?? ""}`} data-component="git-graph-panel">
      <div
        ref={host}
        class="absolute inset-0 overflow-hidden"
        style={{
          background: "var(--git-graph-bg)",
          cursor: interaction.hoveringID() || interaction.hoveringEdgeKey() ? "pointer" : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          interaction.clearHover()
          schedulePaint()
        }}
        onPointerCancel={() => {
          dragging = false
          moved = false
        }}
        onWheel={onWheel}
      >
        <canvas ref={canvas} class="block size-full touch-none" />
        <Show when={pathOverlay()}>
          {(path) => (
            <PathPopup
              edge={path().edge}
              child={path().child}
              parent={path().parent}
              copy={copy()}
              x={path().x}
              y={path().y}
              width={size().width}
              height={size().height}
              hoveringID={interaction.hoveringID()}
              onHover={(id) => {
                interaction.setHoveringID(id)
                schedulePaint()
              }}
              onJump={(id) => {
                const currentLayout = layout()
                if (!currentLayout) return
                interaction.flyToCommit(currentLayout, id, size().width, size().height)
                props.onSelect?.(id)
              }}
            />
          )}
        </Show>
      </div>

      <Show when={message()}>
        {(text) => (
          <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div class="text-center text-[12px]" style={{ color: "var(--git-graph-text-weak)" }}>
              {text()}
            </div>
          </div>
        )}
      </Show>

      <Show when={snapshot()?.head.detached}>
        <div
          class="pointer-events-none absolute top-3 left-3 right-3 text-[11px]"
          style={{ color: "var(--git-graph-text-weak)" }}
        >
          {copy().detachedHead}
        </div>
      </Show>

      <Show when={!selectedPath() ? selected() : undefined}>
        {(commit) => (
          <CommitTooltip commit={commit()} snapshot={snapshot()!} copy={copy()} actions={props.actions} />
        )}
      </Show>
    </div>
  )
}
