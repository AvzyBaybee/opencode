import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { GitGraphPanel } from "../host/git-graph-panel"
import { themeCss } from "../compat/theme"
import { en } from "../i18n/en"
import { createBrowserGitSource, createBrowserGitActions } from "./browser-source"
import type { GitGraphSnapshot } from "../domain/contract"
import type { GitGraphScope } from "../source/local"

export function StandaloneApp() {
  const [path, setPath] = createSignal(initialPath())
  const [input, setInput] = createSignal(path())
  const [scope, setScope] = createSignal<GitGraphScope>(initialScope())
  const [branchLabel, setBranchLabel] = createSignal("")
  const [commitCount, setCommitCount] = createSignal(0)
  const [branchCount, setBranchCount] = createSignal(0)
  const source = createMemo(() => createBrowserGitSource(path(), { scope: scope() }))
  const actions = createMemo(() => createBrowserGitActions(path(), { scope: scope() }))

  createEffect(() => {
    document.documentElement.dataset.colorScheme = "dark"
    document.documentElement.style.background = "#080808"
  })

  createEffect(() => {
    const value = path()
    if (!value || value.startsWith("fixture:")) {
      localStorage.removeItem("git-graph.repo")
      return
    }
    localStorage.setItem("git-graph.repo", value)
  })

  createEffect(() => {
    localStorage.setItem("git-graph.scope", scope())
  })

  const open = () => {
    setPath(input().trim())
  }

  const onSnapshot = (snapshot: GitGraphSnapshot) => {
    setBranchLabel(snapshot.head.branch || (snapshot.head.detached ? "detached" : ""))
    setCommitCount(snapshot.commits.length)
    setBranchCount(snapshot.refs.filter((ref) => ref.kind === "local" || ref.kind === "remote").length)
  }

  return (
    <div class="git-graph-root min-h-screen w-full" data-color-scheme="dark">
      <style>{themeCss}</style>
      <Show
        when={path()}
        fallback={
          <div class="flex min-h-screen items-center justify-center p-6">
            <div class="w-full max-w-xl flex flex-col gap-3">
              <div class="text-[13px] font-medium">{en.title}</div>
              <div class="text-[12px]" style={{ color: "var(--git-graph-text-weak)" }}>
                {en.openHint}
              </div>
              <div class="flex gap-2">
                <input
                  class="git-graph-button min-w-0 flex-1 text-left"
                  value={input()}
                  placeholder={en.pathPlaceholder}
                  autofocus
                  onInput={(event) => setInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return
                    open()
                  }}
                />
                <button class="git-graph-button" type="button" onClick={open}>
                  {en.openRepository}
                </button>
              </div>
            </div>
          </div>
        }
      >
        <div class="flex h-screen flex-col">
          <header
            class="flex shrink-0 flex-col gap-2 border-b px-3 py-2"
            style={{ "border-color": "var(--git-graph-border)" }}
          >
            <div class="flex items-center gap-2">
              <input
                class="git-graph-button min-w-0 flex-1 text-left"
                value={input()}
                placeholder={en.pathPlaceholder}
                onInput={(event) => setInput(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return
                  open()
                }}
              />
              <button class="git-graph-button" type="button" onClick={open}>
                {en.openRepository}
              </button>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <select
                class="git-graph-button"
                value={scope()}
                onChange={(event) => setScope(event.currentTarget.value as GitGraphScope)}
              >
                <option value="local">All local branches</option>
                <option value="current">Current branch only</option>
                <option value="all">Local + remotes</option>
              </select>
            </div>
            <div class="text-[11px]" style={{ color: "var(--git-graph-text-weak)" }}>
              {statusLine(scope(), branchLabel(), branchCount(), commitCount())}
            </div>
          </header>
          <div class="min-h-0 flex-1">
            <GitGraphPanel source={source()} actions={actions()} colorScheme="dark" onSnapshot={onSnapshot} />
          </div>
        </div>
      </Show>
    </div>
  )
}

function statusLine(scope: GitGraphScope, branch: string, branches: number, commits: number) {
  if (scope === "current") {
    return branch
      ? `Current branch only: ${branch} · ${commits} backups`
      : `Current branch only · ${commits} backups`
  }
  if (scope === "local") {
    return branches <= 1
      ? `All local branches · only ${branch || "one"} tip in view · ${commits} backups`
      : `All local branches · ${branches} tips (including forks beside the main line) · ${commits} backups`
  }
  return `Local + remotes · ${branches} branch tips · ${commits} backups`
}

function initialPath() {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get("repo") || ""
  if (fromQuery && !fromQuery.startsWith("fixture:")) return fromQuery
  const saved = localStorage.getItem("git-graph.repo") || ""
  if (saved.startsWith("fixture:")) return ""
  return saved
}

function initialScope(): GitGraphScope {
  const saved = localStorage.getItem("git-graph.scope")
  if (saved === "current" || saved === "local" || saved === "all") return saved
  return "local"
}
