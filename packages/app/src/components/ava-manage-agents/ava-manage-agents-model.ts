export type AgentsPane = "agents" | "instructions"
export type AgentsScope = "project" | "global"

export type AgentDocument = {
  id: string
  kind: "agent"
  scope: AgentsScope
  name: string
  slug: string
  path: string
  sticky?: boolean
}

export type InstructionDocument = {
  id: string
  kind: "instruction"
  scope: AgentsScope
  name: string
  slug: string
  path: string
  sticky?: boolean
  configPath?: string
}

export type AgentsDocument = AgentDocument | InstructionDocument

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function joinPath(root: string, ...segments: string[]) {
  const slash = root.includes("\\") && !root.includes("/") ? "\\" : "/"
  return [root.replace(/[\\/]+$/, ""), ...segments].join(slash)
}

export function slugifyName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "untitled"
}

export function displayNameFromSlug(slug: string) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

export function documentId(kind: AgentsDocument["kind"], scope: AgentsScope, path: string) {
  return `${kind}:${scope}:${path}`
}

export function parseAgentFile(raw: string) {
  const match = raw.match(frontmatterPattern)
  if (!match) return { frontmatter: raw.startsWith("---") ? "---\n---\n" : "---\nmode: primary\n---\n", body: raw }
  return { frontmatter: match[0], body: raw.slice(match[0].length) }
}

export function serializeAgentFile(frontmatter: string, body: string) {
  const prefix = frontmatter.endsWith("\n") ? frontmatter : `${frontmatter}\n`
  return `${prefix}${body.replace(/^\n/, "")}`
}

export function headingName(raw: string) {
  const line = raw.split(/\r?\n/).find((item) => item.startsWith("# "))
  if (!line) return
  return line.slice(2).trim()
}

export function agentTemplate(name: string) {
  return `---
description: ${name}
mode: primary
---

`
}

export function instructionTemplate(name: string) {
  return `# ${name}\n\n`
}

export function uniqueSlug(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base}-${index}`)) index++
  return `${base}-${index}`
}
