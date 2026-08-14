import { describe, expect, test } from "bun:test"
import { emptyAgentSettings, parseAgentSettings, serializeAgentSettings } from "./ava-manage-agents-settings"

describe("ava agent settings", () => {
  test("reads frontmatter settings and instruction paths", () => {
    const parsed = parseAgentSettings(`---
description: Reviewer
mode: subagent
temperature: 0.2
top_p: 0.9
steps: 8
hidden: true
instructions:
  - /repo/AGENTS.md
  - /repo/.opencode/instructions/style.md
permission:
  edit: ask
  bash: deny
  task:
    "*": deny
    explore: allow
options:
  reasoningEffort: high
---

ignored body
`)
    expect(parsed.settings.description).toBe("Reviewer")
    expect(parsed.settings.mode).toBe("subagent")
    expect(parsed.settings.temperature).toBe("0.2")
    expect(parsed.settings.topP).toBe("0.9")
    expect(parsed.settings.steps).toBe("8")
    expect(parsed.settings.hidden).toBe(true)
    expect(parsed.settings.instructionPaths).toEqual(["/repo/AGENTS.md", "/repo/.opencode/instructions/style.md"])
    expect(parsed.settings.permissions.edit).toBe("ask")
    expect(parsed.settings.permissions.bash).toBe("deny")
    expect(parsed.settings.taskDefault).toBe("deny")
    expect(parsed.settings.taskAgents).toEqual([{ name: "explore", action: "allow" }])
    expect(parsed.settings.reasoningEffort).toBe("high")
  })

  test("writes settings as agent markdown", () => {
    const raw = serializeAgentSettings(
      {
        description: "Build",
        mode: "primary",
        model: "anthropic/claude-sonnet-4-5",
        variant: "",
        temperature: "0.1",
        topP: "",
        steps: "12",
        disable: false,
        hidden: false,
        color: "#4C6FFF",
        reasoningEffort: "medium",
        permissions: { edit: "ask" },
        taskDefault: "ask",
        taskAgents: [],
        instructionPaths: ["/tmp/AGENTS.md"],
      },
      "",
    )
    expect(raw).toContain("description: Build")
    expect(raw).toContain("mode: primary")
    expect(raw).toContain("model: anthropic/claude-sonnet-4-5")
    expect(raw).toContain("temperature: 0.1")
    expect(raw).toContain("steps: 12")
    expect(raw).toContain("color: \"#4C6FFF\"")
    expect(raw).toContain("edit: ask")
    expect(raw).toContain("task: ask")
    expect(raw).toContain("reasoningEffort: medium")
    expect(raw).toContain("- /tmp/AGENTS.md")
    expect(raw).not.toContain("Follow the repo rules.")
    expect(parseAgentSettings(raw).settings.instructionPaths).toEqual(["/tmp/AGENTS.md"])
    expect(parseAgentSettings(raw).body.trim()).toBe("")
  })

  test("keeps the existing prompt when no instruction files are attached", () => {
    const settings = parseAgentSettings(`---
mode: primary
---

Keep this prompt.
`).settings
    const raw = serializeAgentSettings(settings, "Keep this prompt.")
    expect(raw).toContain("Keep this prompt.")
    expect(raw).not.toContain("instructions:")
  })

  test("comments unset document keys so they can be filled in", () => {
    const raw = serializeAgentSettings(emptyAgentSettings(), "")
    expect(raw).toContain("# color:")
    expect(raw).toContain("#   reasoningEffort:")
    expect(raw).toContain("#   webfetch: allow")
    expect(raw).toContain("#   websearch: allow")
    expect(raw).toContain("#   task: ask")
    expect(parseAgentSettings(raw).settings.permissions.webfetch).toBeUndefined()
  })
})
