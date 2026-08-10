import type { DesktopTheme, HexColor, ResolvedTheme, ResolvedV2Theme } from "./types"
import { hexToRgb, rgbToHex } from "./color"

interface HsbColor {
  h: number
  s: number
  b: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hue(value: number) {
  return ((value % 360) + 360) % 360
}

function rgbToHsb(r: number, g: number, b: number): HsbColor {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const brightness = max
  const saturation = max === 0 ? 0 : delta / max
  let nextHue = 0

  if (delta !== 0) {
    if (max === r) nextHue = ((g - b) / delta + (g < b ? 6 : 0)) * 60
    if (max === g) nextHue = ((b - r) / delta + 2) * 60
    if (max !== r && max !== g) nextHue = ((r - g) / delta + 4) * 60
  }

  return { h: nextHue, s: saturation, b: brightness }
}

function hsbToRgb({ h, s, b }: HsbColor) {
  const chroma = b * s
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const match = b - chroma
  let r = 0
  let g = 0
  let blue = 0

  if (h < 60) {
    r = chroma
    g = second
  } else if (h < 120) {
    r = second
    g = chroma
  } else if (h < 180) {
    g = chroma
    blue = second
  } else if (h < 240) {
    g = second
    blue = chroma
  } else if (h < 300) {
    r = second
    blue = chroma
  } else {
    r = chroma
    blue = second
  }

  return { r: r + match, g: g + match, b: blue + match }
}

function hexToHsb(color: HexColor): HsbColor {
  const { r, g, b } = hexToRgb(color)
  return rgbToHsb(r, g, b)
}

function hsbToHex(value: HsbColor): HexColor {
  const { r, g, b } = hsbToRgb(value)
  return rgbToHex(r, g, b)
}

export function getThemeReferenceBase(theme: DesktopTheme, isDark: boolean): HexColor {
  const variant = isDark ? theme.dark : theme.light
  if ("palette" in variant && variant.palette) return variant.palette.neutral
  if ("seeds" in variant && variant.seeds) return variant.seeds.neutral
  return isDark ? ("#1f1f1f" as HexColor) : ("#f7f7f7" as HexColor)
}

function tintHsb(color: HsbColor, reference: HsbColor, user: HsbColor): HsbColor {
  const deltaHue = user.h - reference.h
  const deltaBrightness = user.b - reference.b
  const saturationRatio = reference.s > 0.001 ? user.s / reference.s : 1
  const neutral = color.s <= 0.01

  const nextSaturation = (() => {
    if (reference.s <= 0.001) {
      if (neutral) {
        const weight = 1 - Math.min(1, Math.abs(color.b - reference.b) / Math.max(reference.b, 0.001))
        return user.s * weight
      }
      return color.s
    }
    return clamp(color.s * saturationRatio, 0, 1)
  })()

  return {
    h: hue(color.h + deltaHue),
    s: nextSaturation,
    b: clamp(color.b + deltaBrightness, 0, 1),
  }
}

function tintHex(color: HexColor, reference: HsbColor, user: HsbColor): HexColor {
  return hsbToHex(tintHsb(hexToHsb(color), reference, user))
}

function parseColorValue(value: string): { color: HexColor; alpha?: string } | undefined {
  if (value.startsWith("var(") || value.startsWith("rgba(") || value.includes("var(")) return

  const raw = value.startsWith("#") ? value.slice(1) : value
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return { color: `#${raw.toLowerCase()}` as HexColor }
  if (/^[0-9a-fA-F]{8}$/.test(raw)) {
    return { color: `#${raw.slice(0, 6).toLowerCase()}` as HexColor, alpha: raw.slice(6).toLowerCase() }
  }
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split("")
      .map((part) => part + part)
      .join("")
    return { color: `#${expanded.toLowerCase()}` as HexColor }
  }
}

export function tintColorValue(value: string, reference: HexColor, user: HexColor): string {
  const parsed = parseColorValue(value)
  if (!parsed) return value

  const tinted = tintHex(parsed.color, hexToHsb(reference), hexToHsb(user))
  if (parsed.alpha) return `${tinted}${parsed.alpha}`
  return tinted
}

function shouldTintV1Token(key: string) {
  if (key.startsWith("text-")) return false
  if (key.startsWith("icon-")) return false
  if (key.startsWith("syntax-")) return false
  if (key.startsWith("markdown-")) return false
  if (key.includes("diff")) return false
  if (key.startsWith("avatar-")) return false

  if (key.startsWith("background-")) return true
  if (key.startsWith("button-")) return true
  if (key === "base" || key === "base2" || key === "base3") return true

  if (key.startsWith("surface-")) {
    const semantic = ["brand", "success", "warning", "critical", "info", "interactive", "diff"]
    return !semantic.some((name) => key.includes(name))
  }

  if (key.startsWith("border-")) return true

  if (key.startsWith("input-")) {
    return key === "input-base" || key === "input-hover" || key === "input-disabled"
  }

  return false
}

function shouldTintV2Token(key: string) {
  if (key.startsWith("v2-grey-")) return true
  if (key.startsWith("v2-background-")) return true
  if (key.startsWith("v2-illustration-")) return true

  if (key.startsWith("v2-overlay-simple-tab-") && key.endsWith("-scrim")) return true

  return false
}

export function tintResolvedTheme(tokens: ResolvedTheme, reference: HexColor, user: HexColor): ResolvedTheme {
  const result: ResolvedTheme = { ...tokens }
  for (const [key, value] of Object.entries(tokens)) {
    if (!shouldTintV1Token(key)) continue
    result[key] = tintColorValue(value, reference, user) as ResolvedTheme[string]
  }
  return result
}

export function tintResolvedV2Theme(tokens: ResolvedV2Theme, reference: HexColor, user: HexColor): ResolvedV2Theme {
  const result: ResolvedV2Theme = { ...tokens }
  for (const [key, value] of Object.entries(tokens)) {
    if (!shouldTintV2Token(key)) continue
    result[key] = tintColorValue(value, reference, user)
  }
  return result
}
