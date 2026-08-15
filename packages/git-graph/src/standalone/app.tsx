import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { GitGraphPanel } from "../host/git-graph-panel"
import { themeCss } from "../compat/theme"
import { en } from "../i18n/en"
import { createBrowserGitSource, createBrowserGitActions } from "./browser-source"

export function StandaloneApp() {
  const [path, setPath] = createSignal(initialPath())
  const [input, setInput] = createSignal(path())
  const source = createMemo(() => createBrowserGitSource(path(), { scope: "local" }))
  const actions = createMemo(() => createBrowserGitActions(path(), { scope: "local" }))

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

  const open = () => {
    setPath(input().trim())
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
        <div class="h-screen">
          <GitGraphPanel source={source()} actions={actions()} colorScheme="dark" />
        </div>
      </Show>
    </div>
  )
}

function initialPath() {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get("repo") || ""
  if (fromQuery && !fromQuery.startsWith("fixture:")) return fromQuery
  const saved = localStorage.getItem("git-graph.repo") || ""
  if (saved.startsWith("fixture:")) return ""
  return saved
}
