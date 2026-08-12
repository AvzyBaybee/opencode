import type { GitGraphSnapshot, GitGraphSource } from "../domain/contract"
import { emptySnapshot } from "../domain/contract"
import { fixtureSnapshot } from "../../fixtures/snapshots"

export function createBrowserGitSource(repo: string): GitGraphSource {
  if (repo.startsWith("fixture:")) {
    return createFixtureSource(repo.slice("fixture:".length))
  }

  let current = emptySnapshot({ worktree: repo, status: { kind: "loading" } })
  const listeners = new Set<(snapshot: GitGraphSnapshot) => void>()
  let eventSource: EventSource | undefined

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
    const response = await fetch(`/api/graph?repo=${encodeURIComponent(repo)}`)
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
        eventSource = new EventSource(`/api/watch?repo=${encodeURIComponent(repo)}`)
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
