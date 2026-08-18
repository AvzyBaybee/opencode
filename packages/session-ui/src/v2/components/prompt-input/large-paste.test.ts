import { describe, expect, test } from "bun:test"
import { createPastePart, isLargePaste, LARGE_PASTE_CHARS, pastePreview } from "./large-paste"

describe("large paste", () => {
  test("treats 20,000 characters as a chip instead of inline text", () => {
    expect(isLargePaste("a".repeat(LARGE_PASTE_CHARS - 1))).toBe(false)
    expect(isLargePaste("a".repeat(LARGE_PASTE_CHARS))).toBe(true)
  })

  test("previews the first line", () => {
    expect(pastePreview("  hello world  \nmore")).toBe("hello world")
    expect(pastePreview(`${"n".repeat(60)}\nnext`)).toBe(`${"n".repeat(48)}…`)
  })

  test("numbers each chip in paste order", () => {
    const first = createPastePart("a".repeat(LARGE_PASTE_CHARS), [], 1)
    const second = createPastePart("b".repeat(LARGE_PASTE_CHARS), [first], 1)
    expect(first.ordinal).toBe(1)
    expect(second.ordinal).toBe(2)
    expect(first.type).toBe("paste")
    expect(first.text.startsWith("a")).toBe(true)
  })
})
