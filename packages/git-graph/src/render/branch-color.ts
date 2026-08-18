export type BranchColor = number | string
export type BranchColorMap = Record<string, BranchColor>

const STORAGE_PREFIX = "opencode.git-graph.branch-hues:"

export function hueCss(hue: number, light = false) {
  const saturation = light ? 72 : 64
  const lightness = light ? 40 : 58
  return `hsl(${wrapHue(hue).toFixed(1)} ${saturation}% ${lightness}%)`
}

export function cssFromHues(colors: BranchColorMap, light = false) {
  return Object.fromEntries(Object.entries(colors).map(([name, value]) => [name, cssOf(value, light)]))
}

export function pickerHex(value: BranchColor | undefined, light = false) {
  if (typeof value === "string") {
    const hex = normalizeHex(value)
    if (hex) return hex
  }
  return hslToHex(typeof value === "number" ? value : 210, light)
}

export function assignBranchHues(
  names: readonly string[],
  remembered: BranchColorMap = {},
  random = Math.random,
): BranchColorMap {
  const colors: Record<string, BranchColor> = { ...remembered }
  const fresh = [...new Set(names)].filter((name) => name && !hasColor(colors[name]))
  const existing = Object.values(colors).flatMap((value) => (hasColor(value) ? [hueOf(value)] : []))
  if (fresh.length === 0) return colors
  if (existing.length === 0) {
    const offset = random() * 360
    const step = 360 / fresh.length
    for (const [index, name] of fresh.entries()) colors[name] = wrapHue(offset + index * step)
    return colors
  }
  for (const name of fresh) colors[name] = pickHue(Object.values(colors).flatMap((value) => (hasColor(value) ? [hueOf(value)] : [])))
  return colors
}

export function rememberRename(colors: BranchColorMap, from: string, to: string): BranchColorMap {
  if (!from || !to || from === to) return colors
  const value = colors[from]
  if (!hasColor(value)) return colors
  const next: Record<string, BranchColor> = {}
  for (const [name, current] of Object.entries(colors)) {
    if (name === from) continue
    next[name] = current
  }
  next[to] = value
  return next
}

export function rememberPickedColor(colors: BranchColorMap, name: string, hex: string): BranchColorMap {
  const normalized = normalizeHex(hex)
  if (!name || !normalized) return colors
  return { ...colors, [name]: normalized }
}

export function loadBranchHues(worktree: string, storage: Pick<Storage, "getItem"> = defaultStorage()) {
  if (!worktree) return {}
  return parseColors(storage.getItem(storageKey(worktree)))
}

export function saveBranchHues(
  worktree: string,
  colors: BranchColorMap,
  storage: Pick<Storage, "setItem"> = defaultStorage(),
) {
  if (!worktree) return
  storage.setItem(storageKey(worktree), JSON.stringify(colors))
}

export function circularHueDistance(a: number, b: number) {
  const delta = Math.abs(wrapHue(a) - wrapHue(b))
  return Math.min(delta, 360 - delta)
}

export function minHueDistance(hues: readonly number[]) {
  if (hues.length < 2) return 360
  return hues.reduce((best, hue, index) => {
    const rest = hues.slice(index + 1)
    const nearest = rest.reduce((gap, other) => Math.min(gap, circularHueDistance(hue, other)), 360)
    return Math.min(best, nearest)
  }, 360)
}

export function hueOf(value: BranchColor) {
  if (typeof value === "number") return wrapHue(value)
  const hsl = /^hsl\(\s*([0-9.]+)/i.exec(value)
  if (hsl) return wrapHue(Number(hsl[1]))
  return hueFromHex(value)
}

function cssOf(value: BranchColor, light: boolean) {
  if (typeof value === "string") {
    const hex = normalizeHex(value)
    if (hex) return hex
  }
  if (typeof value === "number") return hueCss(value, light)
  return hueCss(hueOf(value), light)
}

function hasColor(value: BranchColor | undefined): value is BranchColor {
  if (typeof value === "number") return Number.isFinite(value)
  return typeof value === "string" && Boolean(normalizeHex(value) || value.startsWith("hsl("))
}

function pickHue(existing: readonly number[]) {
  if (existing.length === 0) return 0
  const gap = largestGap(existing)
  return wrapHue(gap.start + gap.span / 2)
}

function largestGap(hues: readonly number[]) {
  const sorted = [...hues].map(wrapHue).sort((a, b) => a - b)
  return sorted.reduce(
    (best, start, index) => {
      const end = index === sorted.length - 1 ? sorted[0]! + 360 : sorted[index + 1]!
      const span = end - start
      if (span <= best.span) return best
      return { start, span }
    },
    { start: sorted[0]!, span: 0 },
  )
}

function wrapHue(value: number) {
  return ((value % 360) + 360) % 360
}

function storageKey(worktree: string) {
  return `${STORAGE_PREFIX}${worktree}`
}

function parseColors(raw: string | null): BranchColorMap {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    const next: Record<string, BranchColor> = {}
    for (const [name, color] of Object.entries(value)) {
      if (typeof color === "number" && Number.isFinite(color)) {
        next[name] = wrapHue(color)
        continue
      }
      if (typeof color === "string" && (normalizeHex(color) || color.startsWith("hsl("))) {
        next[name] = color
      }
    }
    return next
  } catch {
    return {}
  }
}

function normalizeHex(value: string) {
  const hex = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const [, r, g, b] = hex
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return
}

function hueFromHex(value: string) {
  const hex = normalizeHex(value)
  if (!hex) return 0
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0
  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return wrapHue(hue * 60)
}

function hslToHex(hue: number, light: boolean) {
  const saturation = (light ? 72 : 64) / 100
  const lightness = (light ? 40 : 58) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const h = wrapHue(hue) / 60
  const x = chroma * (1 - Math.abs((h % 2) - 1))
  const m = lightness - chroma / 2
  const rgb = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x]
  return `#${rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> {
  if (typeof localStorage === "object" && localStorage) return localStorage
  const memory = new Map<string, string>()
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
    },
  }
}
