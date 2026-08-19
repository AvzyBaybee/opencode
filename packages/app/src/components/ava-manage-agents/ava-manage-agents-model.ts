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
  instructionId?: string
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
  const line = parseInstructionFile(raw).body.split(/\r?\n/).find((item) => item.startsWith("# "))
  if (!line) return
  return line.slice(2).trim()
}

export function createInstructionId() {
  return `inst_${crypto.randomUUID().replaceAll("-", "")}`
}

export function isInstructionId(value: string) {
  return /^inst_[0-9a-f]{32}$/i.test(value.trim())
}

export function parseInstructionFile(raw: string) {
  const match = raw.match(frontmatterPattern)
  if (!match) return { body: raw, id: undefined as string | undefined }
  const found = match[1].split(/\r?\n/).flatMap((line) => {
    const id = line.match(/^id:\s*(inst_[0-9a-f]{32})\s*$/i)?.[1]
    return id ? [id.toLowerCase()] : []
  })[0]
  return { id: found, body: raw.slice(match[0].length).replace(/^\r?\n/, "") }
}

export function withInstructionId(body: string, id: string) {
  return `---\nid: ${id}\n---\n\n${parseInstructionFile(body).body.replace(/^\r?\n/, "")}`
}

export function agentTemplate(name: string) {
  return `---
description: ${name}
mode: primary
---

`
}

export function instructionTemplate(name: string) {
  return withInstructionId(`# ${name}\n\n`, createInstructionId())
}

export function uniqueSlug(base: string, taken: Set<string>) {
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base}-${index}`)) index++
  return `${base}-${index}`
}
