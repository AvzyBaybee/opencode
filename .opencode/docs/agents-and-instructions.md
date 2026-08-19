# Agents and instructions

Agents and instructions are separate.

An **agent** is a parameters file. It names the agent and sets how it runs (mode, model, permissions, and so on). It does not own the prompt text.

An **instruction** is a reusable markdown file of prompt text. Any number of instruction files can be plugged into an agent. The same instruction can be reused by several agents.

## Where files live

**Agents**

- Project: `.opencode/agents/` (also `.opencode/agent/`)
- Global: `<config>/agents/` (also `<config>/agent/`)

The filename (without `.md`) is the agent name. Example: `.opencode/agents/reviewer.md` is the agent `reviewer`.

**Instructions**

- Project: `.opencode/instructions/`
- Global: `<config>/instructions/`

These folders are a library. Files there are available to attach. They are not applied to every agent automatically.

## How plugging works

In the Agents tab, attach instructions from the library. Only those attached files are loaded when that agent runs.

Each instruction file has a hidden stable id. The agent stores that id, not the filename. You can rename an instruction in the app (F2, or right-click Rename) or rename the file outside the app, and any agent that already has it plugged in will still get it.

The Instructions editor hides the id. You only edit the prompt text and the heading that is used as the display name.

Older agents that still list a file path keep working. Saving the agent in settings converts those path plugs to ids.

## Agent file

An agent is markdown with YAML frontmatter. When instructions are attached, the body stays empty.

```markdown
---
description: Reviews diffs and asks for the smallest correct change.
mode: primary
model: anthropic/claude-sonnet-4-5
color: "#4C6FFF"
permission:
  edit: ask
  bash: deny
instructions:
  - inst_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  - inst_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
---
```

Useful frontmatter fields:

- `description` — when to use this agent
- `mode` — `primary`, `subagent`, or `all`
- `model`, `variant`, `temperature`, `top_p`, `steps`
- `hidden`, `disable`, `color`
- `permission` — `allow` / `ask` / `deny` per tool; `task` controls which helpers this agent may invoke
- `instructions` — list of instruction ids (or file paths), in the order they should be applied
- `options.reasoningEffort` — provider reasoning setting when needed

Subagents use the same format. Set `mode: subagent` (or `all` if it should also be selectable as a primary agent).

Do not put the system prompt in the agent body. Put it in instruction files and list those files under `instructions`.

## Instruction file

An instruction is markdown. The first `#` heading is the display name. A hidden `id` in the file frontmatter is the stable plug used by agents.

```markdown
---
id: inst_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
---

# Review

Read the diff before commenting.
Prefer the smallest change that fixes the issue.
```

An agent's `instructions` list may contain those ids, or file paths (absolute or relative to the project). Missing files are skipped.

## How a prompt is built

When an agent runs, attached instruction files are read in list order and concatenated. That combined text is the agent's prompt.

If an agent still has markdown below the frontmatter and has no attached instructions, that body is used as the prompt (legacy). If both exist, attached files come first, then the body.

Opening Manage Agents migrates leftover agent bodies: the body is written to `.opencode/instructions/{agent}-instructions.md` (or the matching global folder), the agent is pointed at that file, and the body is cleared.

## What not to do

- Do not write agent parameters and prompt text as one mixed document.
- Do not copy an instruction's contents into the agent file; attach the instruction instead.
- Do not assume every file in `instructions/` is loaded. Only instructions listed on the agent are used.
- Do not use `AGENTS.md` as an agent's prompt. `AGENTS.md` is separate ambient project text, not part of this plug-in list.
