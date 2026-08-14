import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import {
  attachedInstructionPaths,
  loadAttachedInstructionPrompt,
} from "../../src/agent/agent-instructions"

describe("agent instruction files", () => {
  test("reads attached instruction paths from agent options", () => {
    expect(attachedInstructionPaths({ instructions: ["a.md", "  ", 1, "b.md"] })).toEqual(["a.md", "b.md"])
    expect(attachedInstructionPaths({})).toEqual([])
  })

  test("loads attached instruction files as the agent prompt", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "voice.md"), "# Voice\n\nBe brief.\n")
        await Bun.write(path.join(dir, "style.md"), "# Style\n\nUse lists.\n")
      },
    })
    const prompt = await loadAttachedInstructionPrompt({
      prompt: "",
      options: {
        instructions: [path.join(tmp.path, "voice.md"), path.join(tmp.path, "style.md")],
      },
      directory: tmp.path,
    })
    expect(prompt).toContain("Be brief.")
    expect(prompt).toContain("Use lists.")
  })

  test("resolves relative instruction paths from the project directory", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, ".opencode", "instructions", "voice.md"), "Stay kind.\n")
      },
    })
    const prompt = await loadAttachedInstructionPrompt({
      options: { instructions: [".opencode/instructions/voice.md"] },
      directory: tmp.path,
    })
    expect(prompt).toBe("Stay kind.")
  })

  test("keeps the agent body when no instruction files are attached", async () => {
    const prompt = await loadAttachedInstructionPrompt({
      prompt: "You are a reviewer.",
      options: {},
      directory: "/tmp",
    })
    expect(prompt).toBe("You are a reviewer.")
  })
})
