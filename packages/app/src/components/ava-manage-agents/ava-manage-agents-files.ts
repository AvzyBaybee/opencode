import type { BrowseDirectoryEntry } from "@/context/platform"
import {
  createInstructionId,
  displayNameFromSlug,
  documentId,
  headingName,
  isInstructionId,
  joinPath,
  parseInstructionFile,
  slugifyName,
  uniqueSlug,
  withInstructionId,
  type AgentDocument,
  type AgentsDocument,
  type AgentsScope,
  type InstructionDocument,
} from "./ava-manage-agents-model"
import { parseAgentSettings, serializeAgentSettings } from "./ava-manage-agents-settings"

export type AgentsFileAccess = {
  list?: (path: string) => Promise<BrowseDirectoryEntry[]>
  read?: (path: string) => Promise<string | null>
  write?: (path: string, content: string) => Promise<void>
  remove?: (path: string) => Promise<void>
  rename?: (from: string, to: string) => Promise<void>
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
      const parsed = parseInstructionFile(raw)
      const heading = headingName(raw)
      return {
        ...item,
        name: heading ?? item.name,
        instructionId: parsed.id,
      }
    }),
  )
}

export async function stampInstructionIds(input: {
  access: AgentsFileAccess
  project: string
  config: string
}) {
  if (!input.access.write || !input.access.read) return false
  const docs = await loadInstructions(input)
  const results = await Promise.all(
    docs.map(async (item) => {
      if (item.instructionId) return false
      const raw = (await input.access.read?.(item.path)) ?? ""
      await input.access.write?.(item.path, withInstructionId(raw, createInstructionId()))
      return true
    }),
  )
  return results.some(Boolean)
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

export function exclusiveInstructionPaths(paths: string[]) {
  const seen = new Set<string>()
  return paths.filter((path) => {
    if (isAgentsMdPath(path)) return false
    const key = isInstructionId(path) ? path.trim().toLowerCase() : normalizePath(path)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function extractedInstructionHeading(name: string) {
  return `${name} Instructions`
}

export async function extractAgentPromptFiles(input: {
  access: AgentsFileAccess
  project: string
  config: string
}) {
  if (!input.access.write || !input.access.read) return false
  const agents = await loadAgents(input)
  const results = await Promise.all(agents.map((agent) => extractOneAgent(input, agent)))
  return results.some(Boolean)
}

async function extractOneAgent(
  input: { access: AgentsFileAccess; project: string; config: string },
  agent: AgentDocument,
) {
  const raw = (await input.access.read?.(agent.path)) ?? ""
  const parsed = parseAgentSettings(raw)
  const body = parsed.body.trim()
  if (!body) return false
  const folder =
    agent.scope === "project"
      ? joinPath(input.project, ".opencode", "instructions")
      : joinPath(input.config, "instructions")
  const dest = joinPath(folder, `${agent.slug}-instructions.md`)
  const existing = await input.access.read?.(dest)
  if (existing !== null && existing !== undefined) return false
  const instructionId = createInstructionId()
  const content = withInstructionId(`# ${extractedInstructionHeading(agent.name)}\n\n${body}\n`, instructionId)
  await input.access.write?.(dest, content)
  parsed.settings.instructionPaths = exclusiveInstructionPaths([...parsed.settings.instructionPaths, instructionId])
  await input.access.write?.(agent.path, serializeAgentSettings(parsed.settings, ""))
  return true
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

export function matchesInstructionPath(item: InstructionDocument, path: string) {
  if (item.instructionId && isInstructionId(path) && item.instructionId === path.trim().toLowerCase()) return true
  if (samePath(item.path, path)) return true
  if (item.configPath && samePath(item.configPath, path)) return true
  return normalizePath(fileName(item.path)) === normalizePath(fileName(path))
}

export function instructionRef(item: InstructionDocument) {
  return item.instructionId ?? item.path
}

export function preferInstructionIds(refs: string[], docs: InstructionDocument[]) {
  return exclusiveInstructionPaths(refs).map((ref) => {
    const item = docs.find((doc) => matchesInstructionPath(doc, ref))
    return item ? instructionRef(item) : ref
  })
}

export function isAgentsLibraryFile(path: string, project: string, config: string) {
  const file = normalizePath(path)
  if (!file) return false
  if (isProjectLibraryFile(file)) return true
  return libraryRoots(config).some((root) => file === root || file.startsWith(`${root}/`))
}

function isProjectLibraryFile(file: string) {
  return PROJECT_LIBRARY_MARKERS.some((marker) => file === marker || file.startsWith(`${marker}/`) || file.includes(`/${marker}/`))
}

const PROJECT_LIBRARY_MARKERS = [".opencode/instructions", ".opencode/agents", ".opencode/agent"]

function libraryRoots(config: string) {
  return ["instructions", "agents", "agent"].map((folder) => normalizePath(joinPath(config, folder)))
}

export function instructionDisplayName(path: string) {
  return displayNameFromSlug(fileName(path).replace(/\.md$/i, ""))
}

export function siblingPath(path: string, name: string) {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/)
  parts[parts.length - 1] = name
  const slash = path.includes("\\") && !path.includes("/") ? "\\" : "/"
  return parts.join(slash)
}

export function replaceHeadingName(raw: string, name: string) {
  const heading = `# ${name}`
  if (/^# /m.test(raw)) return raw.replace(/^# .*$/m, heading)
  if (!raw.trim()) return `${heading}\n\n`
  return `${heading}\n\n${raw}`
}

export function libraryRenameTarget(item: AgentsDocument, name: string, taken: Set<string>) {
  const value = name.trim()
  if (!value) return
  const used = new Set(taken)
  used.delete(item.slug)
  const slug = uniqueSlug(slugifyName(value), used)
  return {
    name: value,
    slug,
    path: siblingPath(item.path, `${slug}.md`),
  }
}

export function renamedLibraryContent(item: AgentsDocument, raw: string, name: string) {
  if (item.kind === "instruction") return replaceHeadingName(raw, name)
  const parsed = parseAgentSettings(raw)
  if (!parsed.settings.description || parsed.settings.description === item.name) parsed.settings.description = name
  return serializeAgentSettings(parsed.settings, parsed.body)
}

export function retargetStoredPath(path: string, from: string, to: string) {
  if (samePath(path, from)) return to
  if (samePath(fileName(path), fileName(from))) return to
  return path
}

export function retargetInstructionPath(raw: string, item: InstructionDocument, to: string) {
  const parsed = parseAgentSettings(raw)
  let changed = false
  parsed.settings.instructionPaths = parsed.settings.instructionPaths.map((path) => {
    if (item.instructionId && isInstructionId(path) && item.instructionId === path.trim().toLowerCase()) return path
    if (!matchesInstructionPath(item, path)) return path
    changed = true
    return item.instructionId ?? to
  })
  if (!changed) return
  return serializeAgentSettings(parsed.settings, parsed.body)
}

function fileName(path: string) {
  return path.replace(/\\/g, "/").split("/").pop() ?? path
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
