import { describe, expect, test } from "bun:test"
import { createStore } from "solid-js/store"
import type { PromptInputV2PersistedState } from "./types"
import { createPromptInputV2Store } from "./store"

function createPromptStore() {
  return createPromptInputV2Store(
    createStore<PromptInputV2PersistedState>({
      prompt: [
        { type: "text", content: "old", start: 0, end: 3 },
        {
          type: "image",
          id: "attachment-1",
          filename: "notes.txt",
          mime: "text/plain",
          blob: { id: "a", url: "blob:a" },
        },
      ],
      cursor: 3,
      model: { providerID: "anthropic", modelID: "claude-sonnet", variant: null },
      context: { items: [] },
    }),
  )
}

describe("prompt input v2 store", () => {
  test("accepts an accessor for the backing store", () => {
    const [state, setState] = createStore<PromptInputV2PersistedState>({
      prompt: [{ type: "text", content: "", start: 0, end: 0 }],
      cursor: 0,
      context: { items: [] },
    })
    const prompt = createPromptInputV2Store([() => state, setState])

    prompt.setText("accessed")

    expect(prompt.state.prompt).toEqual([{ type: "text", content: "accessed", start: 0, end: 8 }])
    expect(prompt.state.cursor).toBe(8)
  })

  test("updates prompt text and cursor together while preserving attachments", () => {
    const prompt = createPromptStore()

    prompt.setText("updated")

    expect(prompt.state.prompt).toEqual([
      { type: "text", content: "updated", start: 0, end: 7 },
      {
        type: "image",
        id: "attachment-1",
        filename: "notes.txt",
        mime: "text/plain",
        blob: { id: "a", url: "blob:a" },
      },
    ])
    expect(prompt.state.cursor).toBe(7)
  })

  test("inserts text without flattening structured mentions", () => {
    const [state, setState] = createStore<PromptInputV2PersistedState>({
      prompt: [
        { type: "text", content: "A ", start: 0, end: 2 },
        { type: "file", path: "one", content: "@one", start: 2, end: 6 },
        { type: "text", content: " B", start: 6, end: 8 },
      ],
      cursor: 2,
      context: { items: [] },
    })
    const prompt = createPromptInputV2Store([state, setState])

    prompt.addText("X\nY")

    expect(prompt.state.prompt).toEqual([
      { type: "text", content: "A X\nY", start: 0, end: 5 },
      { type: "file", path: "one", content: "@one", start: 5, end: 9 },
      { type: "text", content: " B", start: 9, end: 11 },
    ])
    expect(prompt.state.cursor).toBe(5)
  })

  test("appends multiple mentions at the cursor", () => {
    const [state, setState] = createStore<PromptInputV2PersistedState>({
      prompt: [{ type: "text", content: "", start: 0, end: 0 }],
      cursor: 0,
      context: { items: [] },
    })
    const prompt = createPromptInputV2Store([state, setState])

    prompt.addMention({ type: "file", path: "a.ts", content: "@a.ts", start: 0, end: 0 })
    prompt.addMention({ type: "file", path: "b.ts", content: "@b.ts", start: 0, end: 0 })

    expect(prompt.state.prompt).toEqual([
      { type: "file", path: "a.ts", content: "@a.ts", start: 0, end: 5 },
      { type: "text", content: " ", start: 5, end: 6 },
      { type: "file", path: "b.ts", content: "@b.ts", start: 6, end: 11 },
    ])
    expect(prompt.state.cursor).toBe(11)
  })

  test("adds a leading space before a mention after typed text", () => {
    const [state, setState] = createStore<PromptInputV2PersistedState>({
      prompt: [{ type: "text", content: "hello", start: 0, end: 5 }],
      cursor: 5,
      context: { items: [] },
    })
    const prompt = createPromptInputV2Store([state, setState])

    prompt.addMention({ type: "file", path: "a.ts", content: "@a.ts", start: 0, end: 0 })

    expect(prompt.state.prompt).toEqual([
      { type: "text", content: "hello ", start: 0, end: 6 },
      { type: "file", path: "a.ts", content: "@a.ts", start: 6, end: 11 },
    ])
    expect(prompt.state.cursor).toBe(11)
  })

  test("replaces only a trailing @ query when completing a mention", () => {
    const [state, setState] = createStore<PromptInputV2PersistedState>({
      prompt: [
        { type: "text", content: "see ", start: 0, end: 4 },
        { type: "file", path: "a.ts", content: "@a.ts", start: 4, end: 9 },
        { type: "text", content: " @b", start: 9, end: 12 },
      ],
      cursor: 12,
      context: { items: [] },
    })
    const prompt = createPromptInputV2Store([state, setState])

    prompt.addMention({ type: "file", path: "b.ts", content: "@b.ts", start: 0, end: 0 })

    expect(prompt.state.prompt).toEqual([
      { type: "text", content: "see ", start: 0, end: 4 },
      { type: "file", path: "a.ts", content: "@a.ts", start: 4, end: 9 },
      { type: "text", content: " ", start: 9, end: 10 },
      { type: "file", path: "b.ts", content: "@b.ts", start: 10, end: 15 },
    ])
    expect(prompt.state.cursor).toBe(15)
  })

  test("keeps paste chips when replacing editor text", () => {
    const [state, setState] = createStore<PromptInputV2PersistedState>({
      prompt: [
        { type: "text", content: "note", start: 0, end: 4 },
        {
          type: "paste",
          id: "paste-1",
          createdAt: 1,
          ordinal: 1,
          preview: "hello",
          text: "hello",
        },
      ],
      cursor: 4,
      context: { items: [] },
    })
    const prompt = createPromptInputV2Store([state, setState])

    prompt.setText("updated")
    prompt.removeAttachment("paste-1")

    expect(prompt.state.prompt.some((part) => part.type === "paste")).toBe(false)
    expect(prompt.state.prompt[0]).toEqual({ type: "text", content: "updated", start: 0, end: 7 })
  })

  test("expands a paste chip into the text field at the cursor", () => {
    const [state, setState] = createStore<PromptInputV2PersistedState>({
      prompt: [
        { type: "text", content: "before", start: 0, end: 6 },
        {
          type: "paste",
          id: "paste-1",
          createdAt: 1,
          ordinal: 1,
          preview: "DUMP",
          text: "DUMP",
        },
      ],
      cursor: 6,
      context: { items: [] },
    })
    const prompt = createPromptInputV2Store([state, setState])

    prompt.expandPaste("paste-1")

    expect(prompt.state.prompt).toEqual([{ type: "text", content: "beforeDUMP", start: 0, end: 10 }])
    expect(prompt.state.cursor).toBe(10)
  })

  test("mutates context, attachments, and model through shared actions", () => {
    const prompt = createPromptStore()
    const context = { key: "file:src/index.ts", type: "file" as const, path: "src/index.ts" }

    prompt.addContext(context)
    prompt.addContext(context)
    prompt.addMention({ type: "file", path: "src/app.ts", content: "@src/app.ts", start: 0, end: 0 })
    prompt.removeAttachment("attachment-1")
    prompt.setVariant("thinking")

    expect(prompt.state.context.items).toEqual([context])
    expect(prompt.state.prompt).toEqual([
      { type: "text", content: "old ", start: 0, end: 4 },
      { type: "file", path: "src/app.ts", content: "@src/app.ts", start: 4, end: 15 },
    ])
    expect(prompt.state.model?.variant).toBe("thinking")

    prompt.removeContext(context.key)
    prompt.setPrompt([{ type: "text", content: "old", start: 0, end: 3 }], 3)
    prompt.setModel(undefined)

    expect(prompt.state.context.items).toEqual([])
    expect(prompt.state.prompt).toEqual([{ type: "text", content: "old", start: 0, end: 3 }])
    expect(prompt.state.model).toBeUndefined()
  })

  test("resets the prompt and cursor", () => {
    const prompt = createPromptStore()

    prompt.reset()

    expect(prompt.state.prompt).toEqual([{ type: "text", content: "", start: 0, end: 0 }])
    expect(prompt.state.cursor).toBe(0)
  })
})
