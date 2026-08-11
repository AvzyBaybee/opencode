import { createEffect, createSignal, onCleanup } from "solid-js"
import { virtualScrollElement } from "@/components/virtual-scroll-element"
import { stickyOverlayTopInset, stickyVirtualPinned, stickyVirtualY } from "@/components/sticky-virtual-row"

/** Pin the selected row just below the copy bar when that bar overlaps the list. */
function overlayTopInset(scroll: HTMLElement) {
  const overlay = scroll.closest(".ava-side-panel")?.querySelector(".ava-side-panel-copy-slot")
  if (!(overlay instanceof HTMLElement)) return 0
  return stickyOverlayTopInset({
    viewportTop: scroll.getBoundingClientRect().top,
    overlayBottom: overlay.getBoundingClientRect().bottom,
  })
}

/** Keeps sticky row math in sync with the nearest scroll-view viewport. */
export function useStickyScrollport(input: {
  enabled: () => boolean
  root: () => HTMLElement | undefined
  topInset?: number
  bottomInset?: number
}) {
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(0)
  const [topInset, setTopInset] = createSignal(0)

  createEffect(() => {
    if (!input.enabled()) return
    let scroll: HTMLDivElement | null = null
    let frame = 0
    let observer: ResizeObserver | undefined
    let mutations: MutationObserver | undefined
    let overlay: Element | undefined

    const sync = () => {
      if (!scroll) return
      setScrollTop(scroll.scrollTop)
      setViewportHeight(scroll.clientHeight)
      setTopInset(overlayTopInset(scroll))
      const nextOverlay = scroll.closest(".ava-side-panel")?.querySelector(".ava-side-panel-copy-slot") ?? undefined
      if (nextOverlay === overlay || !observer) return
      if (overlay) observer.unobserve(overlay)
      overlay = nextOverlay
      if (overlay) observer.observe(overlay)
    }

    const detach = () => {
      if (!scroll) return
      scroll.removeEventListener("scroll", sync)
      observer?.disconnect()
      observer = undefined
      mutations?.disconnect()
      mutations = undefined
      overlay = undefined
      scroll = null
    }

    const attach = () => {
      const next = virtualScrollElement(input.root())
      if (!next) {
        frame = requestAnimationFrame(attach)
        return
      }
      if (scroll === next && next.clientHeight > 0) {
        sync()
        return
      }
      detach()
      scroll = next
      scroll.addEventListener("scroll", sync, { passive: true })
      observer = new ResizeObserver(sync)
      observer.observe(scroll)
      const sidebar = scroll.closest("[data-slot='session-review-v2-sidebar']")
      if (sidebar) {
        mutations = new MutationObserver(sync)
        mutations.observe(sidebar, { childList: true })
      }
      sync()
      if (scroll.clientHeight <= 0) frame = requestAnimationFrame(attach)
    }

    attach()
    onCleanup(() => {
      cancelAnimationFrame(frame)
      detach()
    })
  })

  const place = (path: string, active: string | undefined, start: number, size: number) => {
    // Touch signals so Solid re-renders this row on every scroll/resize.
    const top = scrollTop()
    const height = viewportHeight()
    const inset = topInset()
    if (!input.enabled() || !active || path !== active || height <= 0) {
      return { y: start, pinned: undefined as undefined }
    }
    const y = stickyVirtualY({
      start,
      size,
      scrollTop: top,
      viewportHeight: height,
      topInset: (input.topInset ?? 0) + inset,
      bottomInset: input.bottomInset ?? 0,
    })
    return { y, pinned: stickyVirtualPinned(start, y) }
  }

  return { scrollTop, viewportHeight, place }
}
