import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js"
import { backupLabel } from "../domain/contract"
import type { GitGraphCommit, GitGraphSnapshot } from "../domain/contract"
import type { GitGraphCopy } from "../i18n/en"
import {
  canDeleteBackup,
  canMoveCurrentBranch,
  canStartMerge,
  hasLaterBackups,
  moveTargets,
  type GitActionKind,
} from "../source/actions"

export type GitActionRequest = {
  kind: GitActionKind
  commitID?: string
  name?: string
  target?: string
  endID?: string
  force?: boolean
  cloud?: boolean
  paths?: readonly string[]
}

export type GitActionResult = {
  ok: boolean
  message?: string
  overwrite?: boolean
  conflict?: boolean
  overwriteFiles?: string[]
}

export type GitGraphActions = {
  run(input: GitActionRequest): Promise<GitActionResult>
  init?(name: string): Promise<GitActionResult>
  resolve?(how: "abort" | "keep-this" | "keep-other" | "edited"): Promise<GitActionResult>
}

export function CommitTooltip(props: {
  commit: GitGraphCommit
  snapshot: GitGraphSnapshot
  copy: GitGraphCopy
  actions?: GitGraphActions
  pickingMerge?: boolean
  mergeCount?: number
  onStartMerge?: () => void
  onCancelMerge?: () => void
  onRequestMerge?: () => void
}) {
  const [mode, setMode] = createSignal<"idle" | "branch" | "delete" | "move">("idle")
  const [name, setName] = createSignal("")
  const [target, setTarget] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")

  const commitID = createMemo(() => props.commit.id)

  createEffect(() => {
    commitID()
    if (untrack(() => props.pickingMerge)) return
    setMode("idle")
    setName("")
    setTarget(untrack(() => moveTargets(props.snapshot)[0]?.name ?? ""))
    setError("")
    setBusy(false)
  })

  const run = async (kind: GitActionKind, extras?: { name?: string; target?: string }) => {
    if (!props.actions || busy()) return
    setBusy(true)
    setError("")
    const result = await props.actions.run({
      kind,
      commitID: props.commit.id,
      name: extras?.name,
      target: extras?.target,
    })
    setBusy(false)
    if (result.ok) {
      setMode("idle")
      setName("")
      return
    }
    if (result.overwrite || result.conflict) return
    setError(result.message || props.copy.error)
  }

  return (
    <div
      class="git-graph-tooltip absolute bottom-3 left-3 z-20"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div class="git-graph-tooltip-name">{backupLabel(props.commit)}</div>
      <hr class="git-graph-tooltip-rule" />
      <Show when={props.actions}>
        <Show
          when={props.pickingMerge}
          fallback={
            <>
              <Show when={mode() === "idle"}>
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
                    disabled={busy() || !canStartMerge(props.snapshot, props.commit.id)}
                    onClick={() => props.onStartMerge?.()}
                  >
                    {props.copy.mergeBackups}
                  </button>
                  <Show when={canMoveCurrentBranch(props.snapshot)}>
                    <button class="git-graph-button" type="button" disabled={busy()} onClick={() => setMode("move")}>
                      {props.copy.moveBranchTo}
                    </button>
                  </Show>
                  <button
                    class="git-graph-button"
                    type="button"
                    data-kind="danger"
                    disabled={busy() || !canDeleteBackup(props.snapshot, props.commit.id)}
                    onClick={() => setMode("delete")}
                  >
                    {props.copy.deleteBackup}
                  </button>
                </div>
              </Show>
              <Show when={mode() === "branch"}>
                <div class="mt-2 flex flex-col gap-1.5">
                  <input
                    class="git-graph-button w-full text-left"
                    value={name()}
                    placeholder={props.copy.threadName}
                    disabled={busy()}
                    onInput={(event) => setName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || !name().trim()) return
                      void run("branch", { name: name() })
                    }}
                  />
                  <div class="flex flex-wrap gap-1.5">
                    <button class="git-graph-button" type="button" disabled={busy() || !name().trim()} onClick={() => run("branch", { name: name() })}>
                      {props.copy.createThread}
                    </button>
                    <button class="git-graph-button" type="button" disabled={busy()} onClick={() => setMode("idle")}>
                      {props.copy.cancel}
                    </button>
                  </div>
                </div>
              </Show>
              <Show when={mode() === "move"}>
                <div class="mt-2 flex flex-col gap-1.5">
                  <Show when={props.snapshot.head.detached}>
                    <div>{props.copy.moveNeedsName}</div>
                    <input
                      class="git-graph-button w-full text-left"
                      value={name()}
                      placeholder={props.copy.threadName}
                      disabled={busy()}
                      onInput={(event) => setName(event.currentTarget.value)}
                    />
                  </Show>
                  <div>{props.copy.confirmMove}</div>
                  <div>{props.copy.moveChoose}</div>
                  <select
                    class="git-graph-button git-graph-tooltip-select w-full"
                    value={target()}
                    disabled={busy()}
                    onChange={(event) => setTarget(event.currentTarget.value)}
                  >
                    <For each={moveTargets(props.snapshot)}>
                      {(branch) => <option value={branch.name}>{branch.name}</option>}
                    </For>
                  </select>
                  <div class="git-graph-tooltip-actions">
                    <button
                      class="git-graph-button"
                      type="button"
                      disabled={busy() || !target() || (props.snapshot.head.detached && !name().trim())}
                      onClick={() => run("move", { target: target(), name: name() })}
                    >
                      {props.copy.moveBranchTo}
                    </button>
                    <button class="git-graph-button" type="button" disabled={busy()} onClick={() => setMode("idle")}>
                      {props.copy.cancel}
                    </button>
                  </div>
                </div>
              </Show>
              <Show when={mode() === "delete"}>
                <div class="mt-2 flex flex-col gap-1.5">
                  <div>{hasLaterBackups(props.snapshot, props.commit.id) ? props.copy.confirmDeleteLater : props.copy.confirmDelete}</div>
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
            </>
          }
        >
          <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)", "text-align": "center" }}>
            {props.copy.mergeHint}
          </div>
          <div class="git-graph-tooltip-actions mt-2">
            <button
              class="git-graph-button"
              type="button"
              disabled={(props.mergeCount ?? 0) < 2}
              onClick={() => props.onRequestMerge?.()}
            >
              {props.copy.mergeBackups}
            </button>
            <button class="git-graph-button" type="button" onClick={() => props.onCancelMerge?.()}>
              {props.copy.cancel}
            </button>
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
