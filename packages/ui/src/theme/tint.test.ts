import { describe, expect, test } from "bun:test"
import { tintColorValue, tintResolvedTheme, tintResolvedV2Theme } from "./tint"
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

describe("scoped theme tinting", () => {
  const reference = "#f7f7f7" as HexColor
  const user = "#dbeafe" as HexColor

  test("tints backgrounds but not text or diff colors", () => {
    const tokens = {
      "background-base": "#f8f8f8",
      "text-base": "#6f6f6f",
      "text-diff-add-base": "#167517",
      "button-secondary-base": "#ffffff",
    }

    const tinted = tintResolvedTheme(tokens, reference, user)

    expect(tinted["background-base"]).not.toBe("#f8f8f8")
    expect(tinted["button-secondary-base"]).not.toBe("#ffffff")
    expect(tinted["text-base"]).toBe("#6f6f6f")
    expect(tinted["text-diff-add-base"]).toBe("#167517")
  })

  test("tints grey primitives but not semantic ramps", () => {
    const tokens = {
      "v2-grey-100": "#fafafa",
      "v2-green-800": "#198b43",
      "v2-text-text-base": "#6f6f6f",
      "v2-background-bg-base": "var(--v2-grey-100)",
    }

    const tinted = tintResolvedV2Theme(tokens, reference, user)

    expect(tinted["v2-grey-100"]).not.toBe("#fafafa")
    expect(tinted["v2-green-800"]).toBe("#198b43")
    expect(tinted["v2-text-text-base"]).toBe("#6f6f6f")
    expect(tinted["v2-background-bg-base"]).toBe("var(--v2-grey-100)")
  })
})
