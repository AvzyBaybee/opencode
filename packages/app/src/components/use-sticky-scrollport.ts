import { createEffect, createSignal, onCleanup } from "solid-js"
import { virtualScrollElement } from "@/components/virtual-scroll-element"
import { stickyVirtualPinned, stickyVirtualY } from "@/components/sticky-virtual-row"

/** Keeps sticky row math in sync with the nearest scroll-view viewport. */
export function useStickyScrollport(input: {
  enabled: () => boolean
  root: () => HTMLElement | undefined
  topInset?: number
  bottomInset?: number
}) {
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(0)

  createEffect(() => {
    if (!input.enabled()) return
    let scroll: HTMLDivElement | null = null
    let frame = 0
    let observer: ResizeObserver | undefined

    const sync = () => {
      if (!scroll) return
      setScrollTop(scroll.scrollTop)
      setViewportHeight(scroll.clientHeight)
    }

    const detach = () => {
      if (!scroll) return
      scroll.removeEventListener("scroll", sync)
      observer?.disconnect()
      observer = undefined
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
    if (!input.enabled() || !active || path !== active || height <= 0) {
      return { y: start, pinned: undefined as undefined }
    }
    const y = stickyVirtualY({
      start,
      size,
      scrollTop: top,
      viewportHeight: height,
      topInset: input.topInset ?? 0,
      bottomInset: input.bottomInset ?? 0,
    })
    return { y, pinned: stickyVirtualPinned(start, y) }
  }

  return { scrollTop, viewportHeight, place }
}
