import { createEffect, createSignal, Show } from "solid-js"
import { backupLabel } from "../domain/contract"
import type { GitGraphCommit, GitGraphSnapshot } from "../domain/contract"
import type { GitGraphCopy } from "../i18n/en"
import { hasLaterBackups, type GitActionKind } from "../source/actions"

export type GitGraphActions = {
  run(input: { kind: GitActionKind; commitID: string; name?: string }): Promise<{ ok: boolean; message?: string }>
}

export function CommitTooltip(props: {
  commit: GitGraphCommit
  snapshot: GitGraphSnapshot
  copy: GitGraphCopy
  actions?: GitGraphActions
}) {
  const [mode, setMode] = createSignal<"idle" | "branch" | "delete">("idle")
  const [name, setName] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")

  createEffect(() => {
    props.commit.id
    setMode("idle")
    setName("")
    setError("")
    setBusy(false)
  })

  const rewind = () => hasLaterBackups(props.snapshot, props.commit.id)

  const run = async (kind: GitActionKind, threadName?: string) => {
    if (!props.actions || busy()) return
    setBusy(true)
    setError("")
    const result = await props.actions.run({ kind, commitID: props.commit.id, name: threadName })
    setBusy(false)
    if (result.ok) {
      setMode("idle")
      setName("")
      return
    }
    setError(result.message || props.copy.error)
  }

  return (
    <div
      class="git-graph-tooltip absolute bottom-3 left-3 z-20"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div class="git-graph-tooltip-name">{backupLabel(props.commit)}</div>
      <Show when={props.actions}>
        <div class="git-graph-tooltip-actions mt-2">
          <button class="git-graph-button" type="button" disabled={busy()} onClick={() => setMode("branch")}>
            {props.copy.branchOff}
          </button>
          <button class="git-graph-button" type="button" disabled={busy()} onClick={() => run("restore")}>
            {props.copy.restoreBackup}
          </button>
          <button
            class="git-graph-button"
            type="button"
            data-kind="danger"
            disabled={busy()}
            onClick={() => setMode("delete")}
          >
            {props.copy.deleteBackup}
          </button>
        </div>
        <Show when={mode() === "branch"}>
          <div class="mt-2 flex flex-col gap-1.5">
            <input
              class="git-graph-button w-full text-left"
              value={name()}
              placeholder={props.copy.threadName}
              disabled={busy()}
              onInput={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                void run("branch", name())
              }}
            />
            <div class="flex flex-wrap gap-1.5">
              <button class="git-graph-button" type="button" disabled={busy()} onClick={() => run("branch", name())}>
                {props.copy.createThread}
              </button>
              <button class="git-graph-button" type="button" disabled={busy()} onClick={() => setMode("idle")}>
                {props.copy.cancel}
              </button>
            </div>
          </div>
        </Show>
        <Show when={mode() === "delete"}>
          <div class="mt-2 flex flex-col gap-1.5">
            <div style={{ color: rewind() ? "var(--git-graph-text)" : "var(--git-graph-text-weak)" }}>
              {rewind() ? props.copy.confirmRewind : props.copy.confirmDelete}
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                class="git-graph-button"
                type="button"
                data-kind="danger"
                disabled={busy()}
                onClick={() => run("delete")}
              >
                {props.copy.deleteBackup}
              </button>
              <button class="git-graph-button" type="button" disabled={busy()} onClick={() => setMode("idle")}>
                {props.copy.cancel}
              </button>
            </div>
          </div>
        </Show>
        <Show when={error()}>
          {(message) => (
            <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)" }}>
              {message()}
            </div>
          )}
        </Show>
      </Show>
    </div>
  )
}
