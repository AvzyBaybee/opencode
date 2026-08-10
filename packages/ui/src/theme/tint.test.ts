import { describe, expect, test } from "bun:test"
import { tintColorValue } from "./tint"
import type { HexColor } from "./types"

describe("tintColorValue", () => {
  const reference = "#f7f7f7" as HexColor

  test("keeps css variables unchanged", () => {
    expect(tintColorValue("var(--v2-text-text-base)", reference, "#dbeafe")).toBe("var(--v2-text-text-base)")
  })

  test("shifts hue while preserving brightness ratios", () => {
    const user = "#dbeafe" as HexColor
    const dark = "#171717" as HexColor
    const tintedDark = tintColorValue(dark, reference, user)
    const tintedReference = tintColorValue(reference, reference, user)

    expect(tintedDark).not.toBe(dark)
    expect(tintedReference).not.toBe(reference)
    expect(tintColorValue(reference, reference, reference)).toBe(reference)
  })

  test("preserves alpha on eight-digit hex values", () => {
    const tinted = tintColorValue("#f7f7f7ff", reference, "#dbeafe")
    expect(tinted.endsWith("ff")).toBe(true)
  })
})
