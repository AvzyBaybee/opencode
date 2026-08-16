import { ErrorBoundary, Show, createEffect, createMemo, createSignal } from "solid-js"
import { GitGraphPanel } from "../host/git-graph-panel"
import { en, statusMessage } from "../i18n/en"
import { createBrowserGitSource, createBrowserGitActions } from "./browser-source"

export function StandaloneApp() {
  const [path, setPath] = createSignal(initialPath())
  const [input, setInput] = createSignal(path())
  const source = createMemo(() => createBrowserGitSource(path(), { scope: "local" }))
  const actions = createMemo(() => createBrowserGitActions(path(), { scope: "local" }))

  createEffect(() => {
    document.documentElement.dataset.colorScheme = "dark"
    document.documentElement.style.background = "#141414"
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
    <div class="git-graph-root flex h-full min-h-0 w-full flex-col" data-color-scheme="dark">
      <div class="git-graph-folder-bar">
        <div class="text-[12px] font-medium">{en.title}</div>
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
      <Show
        when={path()}
        fallback={
          <div class="flex flex-1 items-center justify-center p-6">
            <div class="max-w-xl text-center text-[13px]" style={{ color: "#e8e8e8" }}>
              {en.openHint}
            </div>
          </div>
        }
      >
        <div class="relative min-h-0 flex-1">
          <ErrorBoundary
            fallback={(error) => (
              <div class="flex size-full items-center justify-center p-6 text-center text-[13px]" style={{ color: "#e8e8e8" }}>
                {statusMessage(en, "error", error.message)}
              </div>
            )}
          >
            <GitGraphPanel
              class="absolute inset-0"
              source={source()}
              actions={actions()}
              colorScheme="dark"
              onLeaveRepo={() => {
                setPath("")
                setInput("")
              }}
            />
          </ErrorBoundary>
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
