import { describe, expect, test } from "bun:test"
import {
  exclusiveInstructionPaths,
  instructionFolderGlob,
  isAgentsMdPath,
  loadInstructions,
  withInstructionGlob,
} from "./ava-manage-agents-files"

describe("ava manage agents files", () => {
  test("lists folder instructions without pinning AGENTS.md", async () => {
    const docs = await loadInstructions({
      access: {
        list: async (directory) => {
          if (directory.replace(/\\/g, "/").endsWith("/.opencode/instructions")) {
            return [{ name: "style.md", path: "/p/.opencode/instructions/style.md", type: "file" }]
          }
          if (directory.replace(/\\/g, "/").endsWith("/c/instructions")) {
            return [{ name: "voice.md", path: "/c/instructions/voice.md", type: "file" }]
          }
          return []
        },
        read: async (path) => (path.endsWith("style.md") ? "# Style\n" : "# Voice\n"),
      },
      project: "/p",
      config: "/c",
    })
    expect(docs.some((item) => item.sticky)).toBe(false)
    expect(docs.map((item) => item.name)).toEqual(["Style", "Voice"])
  })

  test("adds an instructions glob once", () => {
    const glob = instructionFolderGlob("global", "/c")
    expect(glob.replace(/\\/g, "/")).toBe("/c/instructions/*.md")
    expect(withInstructionGlob(["docs.md"], glob)).toEqual(["docs.md", glob])
    expect(withInstructionGlob([glob], glob)).toEqual([glob])
  })

  test("keeps only agent-exclusive instruction paths", () => {
    expect(isAgentsMdPath("/c/AGENTS.md")).toBe(true)
    expect(
      exclusiveInstructionPaths(
        ["/c/AGENTS.md", "/c/instructions/voice.md", "/tmp/only-this-agent.md"],
        ["/c/instructions/voice.md"],
      ),
    ).toEqual(["/tmp/only-this-agent.md"])
  })
})
