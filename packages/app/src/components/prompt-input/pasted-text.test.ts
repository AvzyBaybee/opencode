import { describe, expect, test } from "bun:test"
import { appendPastedTexts } from "./pasted-text"

describe("appendPastedTexts", () => {
  test("appends XML blocks after the typed prompt", () => {
    const result = appendPastedTexts("Please review this", [
      { createdAt: Date.UTC(2026, 7, 18), ordinal: 1, text: "alpha\nbeta" },
    ])
    expect(result.startsWith("Please review this\n\n<pasted_texts>")).toBe(true)
    expect(result).toContain('title="Paste 2026-08-18"')
    expect(result).toContain('characters="10"')
    expect(result).toContain("<![CDATA[\nalpha\nbeta\n]]>")
    expect(result.endsWith("</pasted_texts>")).toBe(true)
  })

  test("keeps multiple pastes as sibling blocks and escapes CDATA closers", () => {
    const result = appendPastedTexts("", [
      { createdAt: Date.UTC(2026, 7, 18), ordinal: 1, text: "one" },
      { createdAt: Date.UTC(2026, 7, 18), ordinal: 2, text: "secret]]>" },
    ])
    expect(result).toContain('title="Paste 2026-08-18 2"')
    expect(result).toContain("secret]]]]><![CDATA[>")
    expect(result.match(/<pasted_text /g)?.length).toBe(2)
  })
})
