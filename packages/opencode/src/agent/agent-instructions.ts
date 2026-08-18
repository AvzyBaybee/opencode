import { readFile } from "fs/promises"
import path from "path"

export function attachedInstructionPaths(options: Record<string, unknown> | undefined) {
  const value = options?.instructions
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []))
}

export async function loadAttachedInstructionPrompt(input: {
  prompt?: string
  options?: Record<string, unknown>
  directory: string
}) {
  const paths = attachedInstructionPaths(input.options)
  if (paths.length === 0) return input.prompt
  const body = input.prompt?.trim() ? input.prompt.trim() : undefined
  const attached = (await Promise.all(paths.map((item) => readInstruction(item, input.directory))))
    .filter(Boolean)
    .join("\n\n")
  if (attached && body) return `${attached}\n\n${body}`
  return attached || body
}

async function readInstruction(raw: string, directory: string) {
  const target = path.isAbsolute(raw) ? raw : path.join(directory, raw)
  const text = await readFile(target, "utf8").catch(() => "")
  return text.trim()
}

