import { readdir, readFile } from "fs/promises"
import path from "path"

const instructionIdPattern = /^inst_[0-9a-f]{32}$/i
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function isInstructionId(value: string) {
  return instructionIdPattern.test(value.trim())
}

export function parseInstructionId(raw: string) {
  const match = raw.match(frontmatterPattern)
  if (!match) return
  const found = match[1].split(/\r?\n/).flatMap((line) => {
    const id = line.match(/^id:\s*(inst_[0-9a-f]{32})\s*$/i)?.[1]
    return id ? [id.toLowerCase()] : []
  })[0]
  return found
}

export function instructionPromptBody(raw: string) {
  const match = raw.match(frontmatterPattern)
  if (!match) return raw.trim()
  return raw.slice(match[0].length).trim()
}

export function attachedInstructionPaths(options: Record<string, unknown> | undefined) {
  const value = options?.instructions
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []))
}

export async function loadAttachedInstructionPrompt(input: {
  prompt?: string
  options?: Record<string, unknown>
  directory: string
  config?: string
}) {
  const refs = attachedInstructionPaths(input.options)
  if (refs.length === 0) return input.prompt
  const body = input.prompt?.trim() ? input.prompt.trim() : undefined
  const byId = await instructionIdMap(input.directory, input.config)
  const attached = (await Promise.all(refs.map((item) => readInstruction(item, input.directory, byId))))
    .filter(Boolean)
    .join("\n\n")
  if (attached && body) return `${attached}\n\n${body}`
  return attached || body
}

async function instructionIdMap(directory: string, config?: string) {
  const folders = [path.join(directory, ".opencode", "instructions")]
  if (config) folders.push(path.join(config, "instructions"))
  const entries = await Promise.all(folders.map(listMarkdown))
  const files = await Promise.all(
    entries.flat().map(async (file) => {
      const raw = await readFile(file, "utf8").catch(() => "")
      const id = parseInstructionId(raw)
      return id ? ([[id, file]] as const) : []
    }),
  )
  return new Map(files.flat())
}

async function listMarkdown(folder: string) {
  const names = await readdir(folder, { withFileTypes: true }).catch(() => [])
  return names.flatMap((entry) => {
    if (entry.isDirectory() || !entry.name.toLowerCase().endsWith(".md")) return []
    return [path.join(folder, entry.name)]
  })
}

async function readInstruction(raw: string, directory: string, byId: Map<string, string>) {
  const id = isInstructionId(raw) ? raw.trim().toLowerCase() : undefined
  const target = id ? byId.get(id) : undefined
  const file = target ?? (path.isAbsolute(raw) ? raw : path.join(directory, raw))
  const text = await readFile(file, "utf8").catch(() => "")
  return instructionPromptBody(text)
}
