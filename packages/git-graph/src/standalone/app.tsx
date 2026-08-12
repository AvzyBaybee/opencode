import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { GitGraphPanel } from "../host/git-graph-panel"
import { themeCss } from "../compat/theme"
import { en } from "../i18n/en"
import { createBrowserGitSource } from "./browser-source"

export function StandaloneApp() {
  const [scheme, setScheme] = createSignal<"light" | "dark">(readTheme())
  const [path, setPath] = createSignal(initialPath())
  const [input, setInput] = createSignal(path())
  const source = createMemo(() => createBrowserGitSource(path()))

  createEffect(() => {
    const value = scheme()
    document.documentElement.dataset.colorScheme = value
    document.documentElement.style.background = value === "dark" ? "#080808" : "#fafafa"
    localStorage.setItem("git-graph.theme", value)
  })

  createEffect(() => {
    const value = path()
    if (!value) return
    localStorage.setItem("git-graph.repo", value)
  })

  return (
    <div class="git-graph-root min-h-screen w-full p-6" data-color-scheme={scheme()}>
      <style>{themeCss}</style>
      <div class="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col gap-4">
        <header class="flex flex-wrap items-center gap-2">
          <div class="mr-auto text-[13px] font-medium">{en.title}</div>
          <input
            class="git-graph-button min-w-[280px] flex-1 text-left"
            value={input()}
            placeholder={en.selectRepository}
            onInput={(event) => setInput(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              setPath(input().trim())
            }}
          />
          <button class="git-graph-button" type="button" onClick={() => setPath(input().trim())}>
            {en.openRepository}
          </button>
          <button
            class="git-graph-button"
            type="button"
            onClick={() => {
              void source().refresh()
            }}
          >
            {en.refresh}
          </button>
          <button
            class="git-graph-button"
            type="button"
            onClick={() => setScheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {en.themeToggle}
          </button>
          <button
            class="git-graph-button"
            type="button"
            onClick={() => {
              setInput("fixture:branched")
              setPath("fixture:branched")
            }}
          >
            {en.useFixture}
          </button>
        </header>

        <div class="flex flex-1 justify-center">
          <div class="git-graph-panel-shell relative">
            <Show when={path()} fallback={<EmptyState />}>
              <GitGraphPanel source={source()} colorScheme={scheme()} />
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      class="flex size-full items-center justify-center p-8 text-center text-[12px]"
      style={{ color: "var(--git-graph-text-weak)" }}
    >
      {en.selectRepository}
    </div>
  )
}

function initialPath() {
  const params = new URLSearchParams(window.location.search)
  return params.get("repo") || localStorage.getItem("git-graph.repo") || ""
}

function readTheme(): "light" | "dark" {
  const saved = localStorage.getItem("git-graph.theme")
  return saved === "light" ? "light" : "dark"
}
