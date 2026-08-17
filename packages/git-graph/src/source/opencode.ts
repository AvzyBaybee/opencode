import type { GitGraphSnapshot, GitGraphSource } from "../domain/contract"
import { emptySnapshot } from "../domain/contract"

/** Integration seam for OpenCode. Standalone development uses LocalGitSource. */
export function createOpenCodeGitSource(input: {
  directory: string
  fetchSnapshot: () => Promise<GitGraphSnapshot>
  subscribe?: (listener: (snapshot: GitGraphSnapshot) => void) => () => void
}): GitGraphSource {
  let current = emptySnapshot({
    worktree: input.directory,
    status: { kind: "loading" },
  })
  const listeners = new Set<(snapshot: GitGraphSnapshot) => void>()

  const emit = (snapshot: GitGraphSnapshot) => {
    current = snapshot
    for (const listener of listeners) listener(snapshot)
  }

  return {
    getSnapshot: async () => {
      if (current.status.kind === "loading") {
        const next = await input.fetchSnapshot()
        emit(next)
        return next
      }
      return current
    },
    refresh: async () => {
      const next = await input.fetchSnapshot()
      emit(next)
      return next
    },
    subscribe: (listener) => {
      listeners.add(listener)
      listener(current)
      const stop = input.subscribe?.((snapshot) => emit(snapshot))
      void input.fetchSnapshot().then(emit, (error: Error) => {
        emit(
          emptySnapshot({
            worktree: input.directory,
            status: { kind: "error", message: error.message || "Could not read git history" },
          }),
        )
      })
      return () => {
        listeners.delete(listener)
        stop?.()
      }
    },
  }
}
