import { batch, type Accessor } from "solid-js"
import type { SetStoreFunction, Store } from "solid-js/store"
import type {
  PromptInputV2AgentPart,
  PromptInputV2Attachment,
  PromptInputV2Comment,
  PromptInputV2FilePart,
  PromptInputV2Model,
  PromptInputV2PersistedState,
  PromptInputV2Prompt,
} from "./types"

export type PromptInputV2StoreTuple = [
  Store<PromptInputV2PersistedState> | Accessor<Store<PromptInputV2PersistedState>>,
  SetStoreFunction<PromptInputV2PersistedState>,
]

export type PromptInputV2StoreInput = PromptInputV2StoreTuple | Accessor<PromptInputV2StoreTuple>

export function createPromptInputV2Store(input: PromptInputV2StoreInput) {
  const tuple = () => (typeof input === "function" ? input() : input)
  const store = () => {
    const value = tuple()[0]
    return typeof value === "function" ? value() : value
  }
  const setStore = () => tuple()[1]

  return {
    get state() {
      return store()
    },
    setPrompt(prompt: PromptInputV2Prompt, cursor?: number) {
      batch(() => {
        setStore()("prompt", prompt)
        if (cursor !== undefined) setStore()("cursor", cursor)
      })
    },
    setCursor(cursor: number) {
      setStore()("cursor", cursor)
    },
    setText(content: string) {
      batch(() => {
        setStore()("prompt", (prompt) => [
          { type: "text", content, start: 0, end: content.length },
          ...prompt.filter((part) => part.type !== "text"),
        ])
        setStore()("cursor", content.length)
      })
    },
    addText(content: string) {
      const cursor = store().cursor ?? promptLength(store().prompt)
      batch(() => {
        setStore()("prompt", (prompt) => insertText(prompt, cursor, content))
        setStore()("cursor", cursor + content.length)
      })
    },
    reset() {
      batch(() => {
        setStore()("prompt", [{ type: "text", content: "", start: 0, end: 0 }])
        setStore()("cursor", 0)
      })
    },
    setModel(model: PromptInputV2Model | undefined) {
      setStore()("model", model)
    },
    setVariant(variant: string | null) {
      if (store().model) setStore()("model", "variant", variant)
    },
    addContext(item: PromptInputV2Comment) {
      if (store().context.items.some((entry) => entry.key === item.key)) return
      setStore()("context", "items", (items) => [...items, item])
    },
    removeContext(key: string) {
      setStore()("context", "items", (items) => items.filter((item) => item.key !== key))
    },
    addMention(mention: PromptInputV2FilePart | PromptInputV2AgentPart) {
      const prompt = store().prompt
      const end = store().cursor ?? promptLength(prompt)
      const start = mentionInsertStart(prompt, end)

      let working = prompt
      let insertStart = start
      let insertEnd = end

      if (start === end && needsMentionLeadingSpace(prompt, end)) {
        working = insertText(prompt, end, " ")
        insertStart = end + 1
        insertEnd = end + 1
      }

      batch(() => {
        setStore()("prompt", insertMention(working, insertStart, insertEnd, mention))
        setStore()("cursor", insertStart + mention.content.length)
      })
    },
    addAttachment(attachment: PromptInputV2Attachment) {
      setStore()("prompt", (prompt) => [...prompt, attachment])
    },
    removeAttachment(id: string) {
      setStore()("prompt", (parts) => parts.filter((part) => part.type !== "image" || part.id !== id))
    },
  }
}

export type PromptInputV2Store = ReturnType<typeof createPromptInputV2Store>

function insertText(prompt: PromptInputV2Prompt, cursor: number, content: string): PromptInputV2Prompt {
  let position = 0
  let inserted = false
  const parts = prompt.flatMap<PromptInputV2Prompt[number]>((part) => {
    if (part.type === "image") return [part]
    const start = position
    position += part.content.length
    if (inserted) return [part]
    if (part.type === "text" && cursor >= start && cursor <= position) {
      inserted = true
      const offset = cursor - start
      return [{ ...part, content: part.content.slice(0, offset) + content + part.content.slice(offset) }]
    }
    if (cursor > start) return [part]
    inserted = true
    return [{ type: "text", content, start: 0, end: 0 }, part]
  })
  if (!inserted) parts.push({ type: "text", content, start: 0, end: 0 })
  return withOffsets(parts)
}

function needsMentionLeadingSpace(prompt: PromptInputV2Prompt, end: number) {
  if (end === 0) return false

  let position = 0
  for (const part of prompt) {
    if (part.type === "image") continue
    const partStart = position
    const partEnd = position + part.content.length

    if (end > partEnd) {
      position = partEnd
      continue
    }

    if (end < partEnd) {
      const before = part.content.slice(0, end - partStart)
      return before.length > 0 && !/\s$/.test(before)
    }

    if (part.type === "file" || part.type === "agent") return true
    if (part.type === "text") {
      if (part.content.length === 0) return false
      return !/\s$/.test(part.content)
    }
  }

  return false
}

function mentionInsertStart(prompt: PromptInputV2Prompt, end: number) {
  let position = 0
  for (const part of prompt) {
    if (part.type === "image") continue
    const partStart = position
    const partEnd = position + part.content.length
    if (end < partStart) return end
    if (part.type === "text" && end > partStart && end <= partEnd) {
      const atMatch = part.content.slice(0, end - partStart).match(/@(\S*)$/)
      return atMatch ? partStart + atMatch.index! : end
    }
    if (end <= partEnd) return end
    position = partEnd
  }
  return end
}

function insertMention(
  prompt: PromptInputV2Prompt,
  start: number,
  end: number,
  mention: PromptInputV2FilePart | PromptInputV2AgentPart,
): PromptInputV2Prompt {
  let position = 0
  let inserted = false
  const parts = prompt.flatMap<PromptInputV2Prompt[number]>((part) => {
    if (part.type === "image") return [part]
    const partStart = position
    const partEnd = position + part.content.length
    position = partEnd

    if (inserted) return [part]
    if (part.type === "text" && start >= partStart && end <= partEnd) {
      inserted = true
      const before = part.content.slice(0, start - partStart)
      const after = part.content.slice(end - partStart)
      return [
        ...(before ? [{ type: "text" as const, content: before, start: 0, end: 0 }] : []),
        mention,
        ...(after ? [{ type: "text" as const, content: after, start: 0, end: 0 }] : []),
      ]
    }
    if (start >= partEnd) return [part]
    inserted = true
    return [mention, part]
  })
  if (!inserted) parts.push(mention)
  return withOffsets(parts)
}

function withOffsets(prompt: PromptInputV2Prompt): PromptInputV2Prompt {
  let offset = 0
  return prompt.map((part) => {
    if (part.type === "image") return part
    const next = { ...part, start: offset, end: offset + part.content.length }
    offset = next.end
    return next
  })
}

function promptLength(prompt: PromptInputV2Prompt) {
  return prompt.reduce((length, part) => length + ("content" in part ? part.content.length : 0), 0)
}
