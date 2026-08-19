import { describe, expect, test } from "bun:test"
import {
  displayNameFromSlug,
  headingName,
  createInstructionId,
  isInstructionId,
  parseAgentFile,
  parseInstructionFile,
  serializeAgentFile,
  slugifyName,
  uniqueSlug,
  withInstructionId,
} from "./ava-manage-agents-model"

describe("ava manage agents model", () => {
  test("slugifies a display name", () => {
    expect(slugifyName("Code reviewer")).toBe("code-reviewer")
    expect(slugifyName("  ")).toBe("untitled")
  })

  test("turns a slug into a display name", () => {
    expect(displayNameFromSlug("code-reviewer")).toBe("Code Reviewer")
  })

  test("keeps unique slugs unique", () => {
    expect(uniqueSlug("review", new Set(["review"]))).toBe("review-2")
  })

  test("splits agent frontmatter from the prompt body", () => {
    const parsed = parseAgentFile("---\nmode: primary\n---\n\nYou review code.\n")
    expect(parsed.body.trim()).toBe("You review code.")
    expect(serializeAgentFile(parsed.frontmatter, "Stay focused.\n")).toContain("Stay focused.")
  })

  test("reads an instruction title from the first heading", () => {
    expect(headingName("# Testing\n\nRun bun test.\n")).toBe("Testing")
    expect(headingName("---\nid: inst_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n---\n\n# Testing\n\nRun bun test.\n")).toBe(
      "Testing",
    )
  })

  test("wraps an instruction file with a stable id without changing the visible body", () => {
    const id = createInstructionId()
    expect(isInstructionId(id)).toBe(true)
    const raw = withInstructionId("# Voice\n\nBe kind.\n", id)
    expect(parseInstructionFile(raw)).toEqual({ id, body: "# Voice\n\nBe kind.\n" })
  })
})
