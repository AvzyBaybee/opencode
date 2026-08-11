import { hexToRgb, rgbToHex, type HexColor } from "@opencode-ai/ui/theme"

const STYLE_ID = "ava-ui-surfaces"
const HUE_RANGE = 90
const SATURATION_RANGE = 0.5
const BRIGHTNESS_RANGE = 0.4

export type AvaHsbOffset = {
  h: number
  s: number
  b: number
}

export const AVA_HSB_ZERO: AvaHsbOffset = { h: 0, s: 0, b: 0 }

export function clampHsbChannel(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-50, Math.min(50, Math.round(value)))
}

export function clampHsbOffset(value: AvaHsbOffset): AvaHsbOffset {
  return {
    h: clampHsbChannel(value.h),
    s: clampHsbChannel(value.s),
    b: clampHsbChannel(value.b),
  }
}

export function isHsbZero(value: AvaHsbOffset) {
  return value.h === 0 && value.s === 0 && value.b === 0
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function wrapHue(value: number) {
  return ((value % 360) + 360) % 360
}

function rgbToHsb(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const hue =
    delta === 0
      ? 0
      : max === r
        ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
        : max === g
          ? ((b - r) / delta + 2) * 60
          : ((r - g) / delta + 4) * 60
  return { h: hue, s: max === 0 ? 0 : delta / max, b: max }
}

function hsbToRgb(h: number, s: number, b: number) {
  const chroma = b * s
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const match = b - chroma
  const sector = Math.floor(h / 60) % 6
  const rgb =
    sector === 0
      ? [chroma, second, 0]
      : sector === 1
        ? [second, chroma, 0]
        : sector === 2
          ? [0, chroma, second]
          : sector === 3
            ? [0, second, chroma]
            : sector === 4
              ? [second, 0, chroma]
              : [chroma, 0, second]
  return { r: rgb[0] + match, g: rgb[1] + match, b: rgb[2] + match }
}

export function parseCssHex(value: string): HexColor | undefined {
  const raw = value.trim()
  const hex = raw.startsWith("#") ? raw.slice(1) : raw
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return `#${hex.slice(0, 6).toLowerCase()}` as HexColor
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}` as HexColor
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split("")
      .map((part) => part + part)
      .join("")
      .toLowerCase()}` as HexColor
  }
}

function parseCssRgb(value: string): HexColor | undefined {
  const match = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
  if (!match) return
  return rgbToHex(Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255)
}

export function shiftAvaHsb(color: string, offset: AvaHsbOffset) {
  const hex = parseCssHex(color) ?? parseCssRgb(color)
  if (!hex) return color
  const next = clampHsbOffset(offset)
  if (isHsbZero(next)) return hex
  const rgb = hexToRgb(hex)
  const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b)
  const shifted = hsbToRgb(
    wrapHue(hsb.h + (next.h / 50) * HUE_RANGE),
    clamp01(hsb.s + (next.s / 50) * SATURATION_RANGE),
    clamp01(hsb.b + (next.b / 50) * BRIGHTNESS_RANGE),
  )
  return rgbToHex(shifted.r, shifted.g, shifted.b)
}

function ensureStyle() {
  const existing = document.getElementById(STYLE_ID)
  if (existing instanceof HTMLStyleElement) return existing
  const element = document.createElement("style")
  element.id = STYLE_ID
  document.head.appendChild(element)
  return element
}

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name)
}

function resolvedHex(name: string) {
  return parseCssHex(token(name)) ?? parseCssRgb(token(name))
}

function shiftedToken(name: string, offset: AvaHsbOffset) {
  return parseCssHex(shiftAvaHsb(resolvedHex(name) ?? token(name), offset))
}

function nativeSetBackground(color: string) {
  const setBackgroundColor = window.api?.setBackgroundColor
  if (typeof setBackgroundColor !== "function") return
  void setBackgroundColor(color)
}

export function applyAvaUiSurfaces(layers: {
  frame: AvaHsbOffset
  panels: AvaHsbOffset
  raised: AvaHsbOffset
  wells: AvaHsbOffset
}) {
  if (typeof document === "undefined") return
  const style = ensureStyle()
  style.textContent = ""

  const frame = shiftedToken("--v2-background-bg-deep", layers.frame) ?? shiftedToken("--background-base", layers.frame)
  const panels = shiftedToken("--v2-background-bg-base", layers.panels)
  const raised = shiftedToken("--v2-background-bg-layer-01", layers.raised)
  const raisedSurface = shiftedToken("--surface-raised-base", layers.raised)
  const wells =
    shiftedToken("--v2-background-bg-layer-02", layers.wells) ?? shiftedToken("--background-stronger", layers.wells)

  const lines = [
    !isHsbZero(layers.frame) && frame ? `  --v2-background-bg-deep: ${frame};` : "",
    !isHsbZero(layers.panels) && panels ? `  --v2-background-bg-base: ${panels};` : "",
    !isHsbZero(layers.raised) && raised ? `  --v2-background-bg-layer-01: ${raised};` : "",
    !isHsbZero(layers.raised) && raisedSurface ? `  --surface-raised-base: ${raisedSurface};` : "",
    !isHsbZero(layers.wells) && wells ? `  --ava-code-well: ${wells};` : "",
  ].filter(Boolean)

  style.textContent = [
    lines.length > 0 ? `:root {\n${lines.join("\n")}\n}` : "",
    !isHsbZero(layers.wells) && wells
      ? `[data-component="markdown"] {
  --color-background-stronger: var(--ava-code-well);
  --markdown-shell-code-background: var(--ava-code-well);
}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")

  if (!frame) {
    document.documentElement.style.removeProperty("background-color")
    return
  }
  document.documentElement.style.backgroundColor = frame
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", frame)
  nativeSetBackground(frame)
}

export function removeAvaUiSurfaces() {
  document.getElementById(STYLE_ID)?.remove()
  document.documentElement.style.removeProperty("background-color")
}
