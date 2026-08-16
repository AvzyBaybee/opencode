import type { GitGraphSnapshot, GitGraphSource } from "../domain/contract"
import { emptySnapshot } from "../domain/contract"
import { fixtureSnapshot } from "../../fixtures/snapshots"
import type { GitGraphScope } from "../source/local"
import type { GitGraphActions } from "../details/commit-tooltip"

export type BrowserGitSourceOptions = {
  readonly scope?: GitGraphScope
  readonly maxCommits?: number
}

export function createBrowserGitActions(repo: string, options: BrowserGitSourceOptions = {}): GitGraphActions {
  const scope = options.scope ?? "local"
  return {
    run: async (input) => {
      if (!repo || repo.startsWith("fixture:")) {
        return { ok: false, message: "This repository cannot be changed here." }
      }
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          scope,
          kind: input.kind,
          commitID: input.commitID || "HEAD",
          name: input.name,
          target: input.target,
          endID: input.endID,
          force: input.force,
          cloud: input.cloud,
          paths: input.paths,
        }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        message?: string
        overwrite?: boolean
        conflict?: boolean
        overwriteFiles?: string[]
      }
      if (response.ok && body.ok) return { ok: true }
      return {
        ok: false,
        message: body.message || "There was an error.",
        overwrite: body.overwrite,
        conflict: body.conflict,
        overwriteFiles: body.overwriteFiles,
      }
    },
    init: async (name) => {
      if (!repo || repo.startsWith("fixture:")) {
        return { ok: false, message: "This repository cannot be changed here." }
      }
      const response = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, name }),
      })
      const body = (await response.json()) as { ok?: boolean; message?: string }
      if (response.ok && body.ok) return { ok: true }
      return { ok: false, message: body.message || "There was an error." }
    },
    resolve: async (how) => {
      if (!repo || repo.startsWith("fixture:")) {
        return { ok: false, message: "This repository cannot be changed here." }
      }
      const response = await fetch("/api/conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, how }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        message?: string
        conflict?: boolean
        overwriteFiles?: string[]
      }
      if (response.ok && body.ok) return { ok: true }
      return {
        ok: false,
        message: body.message || "There was an error.",
        conflict: body.conflict,
        overwriteFiles: body.overwriteFiles,
      }
    },
  }
}

export function createBrowserGitSource(repo: string, options: BrowserGitSourceOptions = {}): GitGraphSource {
  if (repo.startsWith("fixture:")) {
    return createFixtureSource(repo.slice("fixture:".length))
  }

  const scope = options.scope ?? "local"
  let current = emptySnapshot({ worktree: repo, status: { kind: "loading" } })
  const listeners = new Set<(snapshot: GitGraphSnapshot) => void>()
  let eventSource: EventSource | undefined

  const query = () => `repo=${encodeURIComponent(repo)}&scope=${encodeURIComponent(scope)}`

  const emit = (snapshot: GitGraphSnapshot) => {
    current = snapshot
    for (const listener of listeners) listener(snapshot)
  }

  const load = async () => {
    if (!repo) {
      const next = emptySnapshot({ worktree: "", status: { kind: "invalid", message: "No repository selected" } })
      emit(next)
      return next
    }
    const response = await fetch(`/api/graph?${query()}`).catch((error: Error) => error)
    if (response instanceof Error) {
      const next = emptySnapshot({ worktree: repo, status: { kind: "error", message: response.message } })
      emit(next)
      return next
    }
    if (!response.ok) {
      const next = emptySnapshot({ worktree: repo, status: { kind: "error", message: `HTTP ${response.status}` } })
      emit(next)
      return next
    }
    const next = (await response.json()) as GitGraphSnapshot
    emit(next)
    return next
  }

  return {
    getSnapshot: async () => {
      if (current.status.kind === "loading") return load()
      return current
    },
    refresh: () => load(),
    subscribe: (listener) => {
      listeners.add(listener)
      listener(current)
      void load()
      if (!eventSource && repo) {
        eventSource = new EventSource(`/api/watch?${query()}`)
        eventSource.onmessage = () => {
          void load()
        }
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && eventSource) {
          eventSource.close()
          eventSource = undefined
        }
      }
    },
  }
}

function createFixtureSource(name: string): GitGraphSource {
  const snapshot = fixtureSnapshot(name)
  return {
    getSnapshot: async () => snapshot,
    refresh: async () => snapshot,
    subscribe: (listener) => {
      listener(snapshot)
      return () => undefined
    },
  }
}
