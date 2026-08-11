/** Clamp a virtualized row's Y so the active item stays on-screen while scrolling. */
export function stickyVirtualY(input: {
  start: number
  size: number
  scrollTop: number
  viewportHeight: number
  topInset?: number
  bottomInset?: number
}) {
  // Before the scrollport is measured, never clamp — clamping with height 0
  // teleports the selected row to the top of the list.
  if (input.viewportHeight <= 0 || input.size <= 0) return input.start

  const topInset = input.topInset ?? 0
  const bottomInset = input.bottomInset ?? 0
  const top = input.scrollTop + topInset
  const bottom = input.scrollTop + input.viewportHeight - bottomInset
  const max = Math.max(top, bottom - input.size)
  return Math.min(Math.max(input.start, top), max)
}

export function stickyVirtualPinned(start: number, clamped: number) {
  if (clamped > start) return "top" as const
  if (clamped < start) return "bottom" as const
  return undefined
}
