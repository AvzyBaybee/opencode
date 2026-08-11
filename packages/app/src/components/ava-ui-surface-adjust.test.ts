import { describe, expect, test } from "bun:test"
import { hexToRgb } from "@opencode-ai/ui/theme"
import { parseCssHex, shiftAvaHsb } from "./ava-ui-surface-adjust"

describe("ava ui surface HSB", () => {
  test("parses six and eight digit hex", () => {
    expect(parseCssHex("#080808ff")).toBe("#080808")
    expect(parseCssHex("#fafafa")).toBe("#fafafa")
    expect(parseCssHex("#abc")).toBe("#aabbcc")
  })

  test("keeps the color at zero and lightens or darkens brightness", () => {
    const base = "#242424"
    const lighter = shiftAvaHsb(base, { h: 0, s: 0, b: 50 })
    const darker = shiftAvaHsb(base, { h: 0, s: 0, b: -50 })
    expect(shiftAvaHsb(base, { h: 0, s: 0, b: 0 })).toBe("#242424")
    expect(hexToRgb(parseCssHex(lighter)!).r).toBeGreaterThan(hexToRgb(base).r)
    expect(hexToRgb(parseCssHex(darker)!).r).toBeLessThan(hexToRgb(base).r)
  })

  test("shifts hue and saturation on a chromatic color", () => {
    const base = "#3366cc"
    expect(shiftAvaHsb(base, { h: 50, s: 0, b: 0 })).not.toBe(base)
    const richer = parseCssHex(shiftAvaHsb(base, { h: 0, s: 50, b: 0 }))!
    const greyer = parseCssHex(shiftAvaHsb(base, { h: 0, s: -50, b: 0 }))!
    const baseRgb = hexToRgb(base)
    const richerRgb = hexToRgb(richer)
    const greyerRgb = hexToRgb(greyer)
    const spread = (rgb: { r: number; g: number; b: number }) => Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)
    expect(spread(richerRgb)).toBeGreaterThan(spread(baseRgb))
    expect(spread(greyerRgb)).toBeLessThan(spread(baseRgb))
  })
})
