import { describe, expect, test } from "bun:test"
import { augment, createState, extract } from "@opencode-ai/core/tool/ava-file-headers"

describe("Ava file headers", () => {
  test("extracts SYNOPSIS and RULES from supported comment styles", () => {
    const headers = extract([
      "/* SYNOPSIS: A visual control panel. */",
      "# RULES: Keep the public API stable.",
      "-- synopsis: Use the SQL view.",
      "// rules: Do not mutate input.",
    ])

    expect(headers).toEqual([
      { name: "SYNOPSIS", line: 1, text: "A visual control panel." },
      { name: "RULES", line: 2, text: "Keep the public API stable." },
    ])
  })

  test("does not inject headers that are already in the current page", () => {
    const headers = extract(["// SYNOPSIS: A module.", "// RULES: Keep it small."])
    const state = createState()

    expect(
      augment({
        state,
        filepath: "C:/project/file.ts",
        headers,
        pageStart: 1,
        pageEnd: 10,
      }),
    ).toBeUndefined()
  })

  test("injects each file header once per state and allows it again in a new state", () => {
    const headers = extract(["// SYNOPSIS: A module.", "// RULES: Keep it small."])
    const state = createState()
    const input = {
      state,
      filepath: "C:/project/file.ts",
      headers,
      pageStart: 50,
      pageEnd: 60,
    }

    expect(augment(input)).toContain("SYNOPSIS: A module.")
    expect(augment(input)).toBeUndefined()
    expect(
      augment({
        ...input,
        state: createState(),
      }),
    ).toContain("RULES: Keep it small.")
  })

  test("ignores files without supported headers", () => {
    expect(extract(["// DESCRIPTION: Not an Ava header."])).toEqual([])
  })
})
