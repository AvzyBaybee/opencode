import type { PromptInputV2PastePart, PromptInputV2Prompt } from "./types"

export const LARGE_PASTE_CHARS = 20_000
const PREVIEW_CHARS = 48

export function normalizePastedText(text: string) {
  if (!text.includes("\r")) return text
  return text.replace(/\r\n?/g, "\n")
}

export function isLargePaste(text: string) {
  return text.length >= LARGE_PASTE_CHARS
}

export function pastePreview(text: string) {
  const line = text.split("\n").find((value) => value.trim())?.replace(/\s+/g, " ").trim() ?? ""
  if (line.length <= PREVIEW_CHARS) return line
  return `${line.slice(0, PREVIEW_CHARS).trimEnd()}…`
}

export function createPastePart(text: string, prompt: PromptInputV2Prompt, now = Date.now()): PromptInputV2PastePart {
  const ordinal = prompt.filter((part) => part.type === "paste").length + 1
  return {
    type: "paste",
    id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2),
    createdAt: now,
    ordinal,
    preview: pastePreview(text),
    text,
  }
}
