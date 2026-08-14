import type { BrowseDirectoryEntry } from "@/context/platform"
import {
  displayNameFromSlug,
  documentId,
  headingName,
  joinPath,
  type AgentDocument,
  type AgentsScope,
  type InstructionDocument,
} from "./ava-manage-agents-model"

export type AgentsFileAccess = {
  list?: (path: string) => Promise<BrowseDirectoryEntry[]>
  read?: (path: string) => Promise<string | null>
  write?: (path: string, content: string) => Promise<void>
  remove?: (path: string) => Promise<void>
}

const markdown = (entry: BrowseDirectoryEntry) => entry.type === "file" && entry.name.toLowerCase().endsWith(".md")

async function listMarkdown(access: AgentsFileAccess, directory: string) {
  if (!access.list) return []
  const entries = await access.list(directory).catch(() => [])
  return entries.filter(markdown)
}

export async function loadAgents(input: {
  access: AgentsFileAccess
  project: string
  config: string
}): Promise<AgentDocument[]> {
  const dirs = [
    { scope: "project" as const, path: joinPath(input.project, ".opencode", "agents") },
    { scope: "project" as const, path: joinPath(input.project, ".opencode", "agent") },
    { scope: "global" as const, path: joinPath(input.config, "agents") },
    { scope: "global" as const, path: joinPath(input.config, "agent") },
  ]
  const seen = new Set<string>()
  const groups = await Promise.all(dirs.map((dir) => listMarkdown(input.access, dir.path).then((entries) => ({ dir, entries }))))
  return groups.flatMap(({ dir, entries }) =>
    entries.flatMap((entry) => {
      const item = toAgent(dir.scope, entry, seen)
      return item ? [item] : []
    }),
  )
}

export async function loadInstructions(input: {
  access: AgentsFileAccess
  project: string
  config: string
}): Promise<InstructionDocument[]> {
  const extras = [
    ...(await listMarkdown(input.access, joinPath(input.project, ".opencode", "instructions"))).map((entry) =>
      toInstruction("project", entry, relativeInstruction(input.project, entry.path)),
    ),
    ...(await listMarkdown(input.access, joinPath(input.config, "instructions"))).map((entry) =>
      toInstruction("global", entry, relativeInstruction(input.config, entry.path)),
    ),
  ]
  return Promise.all(
    extras.map(async (item) => {
      const raw = (await input.access.read?.(item.path)) ?? ""
      const heading = headingName(raw)
      if (!heading) return item
      return { ...item, name: heading }
    }),
  )
}

export function instructionFolderGlob(scope: AgentsScope, root: string) {
  if (scope === "project") return joinPath(root, ".opencode", "instructions", "*.md")
  return joinPath(root, "instructions", "*.md")
}

export function withInstructionGlob(current: string[], glob: string) {
  if (current.some((item) => samePath(item, glob))) return current
  return [...current, glob]
}

export function isAgentsMdPath(path: string) {
  return /(?:^|[\\/])AGENTS\.md$/i.test(path)
}

export function exclusiveInstructionPaths(paths: string[], ambient: string[]) {
  const locked = new Set(ambient.map(normalizePath))
  return paths.filter((path) => !locked.has(normalizePath(path)) && !isAgentsMdPath(path))
}

export function instructionConfigPath(root: string, absolute: string) {
  return relativeInstruction(root, absolute)
}

function toAgent(scope: AgentsScope, entry: BrowseDirectoryEntry, seen: Set<string>): AgentDocument | undefined {
  const slug = entry.name.replace(/\.md$/i, "")
  const key = `${scope}:${slug}`
  if (!slug || seen.has(key)) return
  seen.add(key)
  return {
    id: documentId("agent", scope, entry.path),
    kind: "agent",
    scope,
    slug,
    name: displayNameFromSlug(slug),
    path: entry.path,
  }
}

function toInstruction(scope: AgentsScope, entry: BrowseDirectoryEntry, configPath: string): InstructionDocument {
  const slug = entry.name.replace(/\.md$/i, "")
  return {
    id: documentId("instruction", scope, entry.path),
    kind: "instruction",
    scope,
    slug,
    name: displayNameFromSlug(slug),
    path: entry.path,
    configPath,
  }
}

function relativeInstruction(root: string, absolute: string) {
  const prefix = root.replace(/[\\/]+$/, "")
  if (!absolute.toLowerCase().startsWith(prefix.toLowerCase())) return absolute.replace(/\\/g, "/")
  return absolute.slice(prefix.length).replace(/^[\\/]+/, "").replace(/\\/g, "/")
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").toLowerCase()
}

function samePath(left: string, right: string) {
  return normalizePath(left) === normalizePath(right)
}
