import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { GitGraphSnapshot, GitGraphSource } from "../domain/contract"
import { layoutGraph } from "../layout"
import { createGraphInteraction } from "../interaction"
import { drawGraph } from "../render/canvas"
import { canvasColors } from "../compat/theme"
import { en, statusMessage, type GitGraphCopy } from "../i18n/en"

export type GitGraphPanelProps = {
  readonly source: GitGraphSource
  readonly copy?: GitGraphCopy
  readonly colorScheme?: "light" | "dark"
  readonly class?: string
  readonly onSelect?: (commitID?: string) => void
}

export function GitGraphPanel(props: GitGraphPanelProps) {
  const copy = () => props.copy ?? en
  const interaction = createGraphInteraction()
  const [snapshot, setSnapshot] = createSignal<GitGraphSnapshot>()
  const [size, setSize] = createSignal({ width: 1, height: 1 })
  let canvas: HTMLCanvasElement | undefined
  let host: HTMLDivElement | undefined
  let dragging = false
  let moved = false
  let lastX = 0
  let lastY = 0

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

  const paint = () => {
    const node = canvas
    const currentLayout = layout()
    const current = snapshot()
    if (!node || !currentLayout || !current) return
    const ctx = node.getContext("2d")
    if (!ctx) return
    const { width, height } = size()
    const dpr = window.devicePixelRatio || 1
    node.width = Math.max(1, Math.floor(width * dpr))
    node.height = Math.max(1, Math.floor(height * dpr))
    node.style.width = `${width}px`
    node.style.height = `${height}px`
    drawGraph({
      ctx,
      layout: currentLayout,
      camera: interaction.camera(),
      width,
      height,
      selectedID: interaction.selectedID(),
      headID: current.head.commitID,
      colors: canvasColors(props.colorScheme ?? "dark"),
      dpr,
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
    onCleanup(() => observer.disconnect())
  })

  createEffect(() => {
    const stop = props.source.subscribe((next) => setSnapshot(next))
    onCleanup(stop)
  })

  createEffect(() => {
    snapshot()
    layout()
    size()
    interaction.camera()
    interaction.selectedID()
    props.colorScheme
    paint()
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
    if (!currentLayout || !host) return
    const rect = host.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    interaction.hoverAt(currentLayout, x, y)
    if (!dragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    if (Math.hypot(dx, dy) > 2) moved = true
    interaction.pan(dx, dy)
    lastX = event.clientX
    lastY = event.clientY
  }

  const onPointerUp = (event: PointerEvent) => {
    const currentLayout = layout()
    if (currentLayout && host && !moved) {
      const rect = host.getBoundingClientRect()
      const id = interaction.selectAt(currentLayout, event.clientX - rect.left, event.clientY - rect.top)
      props.onSelect?.(id)
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
  }

  return (
    <div class={`git-graph-root relative size-full min-h-0 ${props.class ?? ""}`} data-component="git-graph-panel">
      <div
        ref={host}
        class="absolute inset-0 overflow-hidden"
        style={{ background: "var(--git-graph-bg)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragging = false
          moved = false
        }}
        onWheel={onWheel}
      >
        <canvas ref={canvas} class="block size-full touch-none" />
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

      <Show when={selected()}>
        {(commit) => (
          <div class="git-graph-tooltip pointer-events-none absolute bottom-3 left-3 right-3">
            <div class="truncate">{commit().subject || commit().id.slice(0, 7)}</div>
            <div class="mt-0.5 truncate font-mono text-[11px]" style={{ color: "var(--git-graph-text-weak)" }}>
              {commit().id.slice(0, 12)}
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
