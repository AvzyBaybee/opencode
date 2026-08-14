import { describe, expect, test } from "bun:test"
import {
  exclusiveInstructionPaths,
  extractAgentPromptFiles,
  extractedInstructionHeading,
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

  test("keeps attached catalog instruction paths and drops AGENTS.md", () => {
    expect(isAgentsMdPath("/c/AGENTS.md")).toBe(true)
    expect(
      exclusiveInstructionPaths(["/c/AGENTS.md", "/c/instructions/voice.md", "/tmp/only-this-agent.md"]),
    ).toEqual(["/c/instructions/voice.md", "/tmp/only-this-agent.md"])
  })

  test("extracts agent bodies into instruction files and clears the agent body", async () => {
    const files = new Map<string, string>([
      [
        "/p/.opencode/agents/builder.md",
        `---
mode: primary
color: "#4C6FFF"
---

Build things with care.
`,
      ],
    ])
    const access = {
      list: async (directory: string) => {
        if (directory.replace(/\\/g, "/") === "/p/.opencode/agents") {
          return [{ name: "builder.md", path: "/p/.opencode/agents/builder.md", type: "file" as const }]
        }
        return []
      },
      read: async (path: string) => files.get(path.replace(/\\/g, "/")) ?? null,
      write: async (path: string, content: string) => {
        files.set(path.replace(/\\/g, "/"), content)
      },
    }
    expect(extractedInstructionHeading("Builder")).toBe("Builder Instructions")
    expect(await extractAgentPromptFiles({ access, project: "/p", config: "/c" })).toBe(true)
    const instruction = files.get("/p/.opencode/instructions/builder-instructions.md")
    expect(instruction).toContain("# Builder Instructions")
    expect(instruction).toContain("Build things with care.")
    const agent = files.get("/p/.opencode/agents/builder.md") ?? ""
    expect(agent).toContain("/p/.opencode/instructions/builder-instructions.md")
    expect(agent).toContain('color: "#4C6FFF"')
    expect(agent).not.toContain("Build things with care.")
    expect(await extractAgentPromptFiles({ access, project: "/p", config: "/c" })).toBe(false)
  })
})
