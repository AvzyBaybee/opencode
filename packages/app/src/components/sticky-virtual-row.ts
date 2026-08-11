/** Clamp a virtualized row's Y so the active item stays on-screen while scrolling. */
export function stickyVirtualY(input: {
  start: number
  size: number
  scrollTop: number
  viewportHeight: number
}) {
  const max = Math.max(input.scrollTop, input.scrollTop + input.viewportHeight - input.size)
  return Math.min(Math.max(input.start, input.scrollTop), max)
}

export function stickyVirtualPinned(start: number, clamped: number) {
  if (clamped > start) return "top" as const
  if (clamped < start) return "bottom" as const
  return undefined
}
