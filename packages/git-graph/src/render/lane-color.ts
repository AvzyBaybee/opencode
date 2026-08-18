/** Stable, well-spaced fallback hues when a stem has no named branch. */
export function colorForLane(lane: number, light = false) {
  const hue = (lane * 137.508) % 360
  const saturation = light ? 72 : 64
  const lightness = light ? 40 : 58
  return `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`
}

export function colorsForLanes(count: number, light = false) {
  return Array.from({ length: Math.max(1, count) }, (_, lane) => colorForLane(lane, light))
}
