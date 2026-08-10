import { createMemo, createSignal, For, Show } from "solid-js"
import { createQuery } from "@tanstack/solid-query"
import { SessionFilePanelV2 } from "@opencode-ai/session-ui/v2/session-file-panel-v2"
import { SessionReviewV2Sidebar } from "@opencode-ai/session-ui/v2/session-review-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import type { ReviewPanelV2State } from "@/pages/session/v2/review-panel-v2-state"
import { showToast } from "@/utils/toast"
import { AvaBrowseFileTree } from "./ava-browse-file-tree"
import { AvaBrowseFilePreview } from "./ava-file-preview"
import { AvaCopyButton } from "./ava-file-row-checkbox"
import { AvaFileContextMenu, useAvaFileContextMenu } from "./ava-file-context-menu"
import { copyTextToClipboard, formatFilesForClipboard } from "./ava-copy-selected-files"
import { folderBasename } from "./ava-text-file"

export function AvaBrowseFolderPanel(props: { directory: string; state: ReviewPanelV2State }) {
  const language = useLanguage()
  const platform = usePlatform()
  const [active, setActive] = createSignal<string>()
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [copying, setCopying] = createSignal(false)
  const menu = useAvaFileContextMenu()
  const query = createMemo(() => props.state.filter().trim().toLowerCase())
  const canReveal = createMemo(() => platform.platform === "desktop" && !!platform.revealPath)

  const search = createQuery(() => ({
    queryKey: ["ava-browse-search", props.directory, query()] as const,
    enabled: query().length > 0 && !!platform.browseListDirectory,
    queryFn: async () => {
      if (!platform.browseListDirectory) return [] as string[]
      const queue = [props.directory]
      const matches: string[] = []
      const needle = query()
      while (queue.length > 0 && matches.length < 200) {
        const dir = queue.shift()!
        const entries = await platform.browseListDirectory(dir)
        for (const entry of entries) {
          if (entry.type === "directory") {
            queue.push(entry.path)
            continue
          }
          if (entry.name.toLowerCase().includes(needle) || entry.path.toLowerCase().includes(needle)) {
            matches.push(entry.path)
          }
        }
      }
      return matches
    },
  }))

  const toggleSelect = (path: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(path)
      else next.delete(path)
      return next
    })
  }

  const copySelected = async () => {
    const paths = [...selected()]
    if (paths.length === 0 || copying() || !platform.browseReadTextFile) return
    setCopying(true)
    const loaded = await Promise.all(
      paths.map(async (path) => ({
        path,
        content: (await platform.browseReadTextFile!(path)) ?? "",
      })),
    )
    const ok = await copyTextToClipboard(formatFilesForClipboard(loaded)).catch(() => false)
    setCopying(false)
    if (!ok) {
      showToast({
        variant: "error",
        title: language.t("ava.sidePanel.copyFailed.title"),
        description: language.t("ava.sidePanel.copyFailed.description"),
      })
      return
    }
    showToast({
      variant: "success",
      title: language.t("ava.sidePanel.copySuccess.title"),
      description: language.t("ava.sidePanel.copySuccess.description", { count: String(paths.length) }),
    })
  }

  return (
    <div class="size-full min-h-0">
      <SessionFilePanelV2
        toolbar={false}
        sidebar={
          <SessionReviewV2Sidebar
            open={props.state.sidebarOpened()}
            transition={props.state.sidebarTransition()}
            title={<span class="truncate">{folderBasename(props.directory)}</span>}
            stats={<AvaCopyButton visible={selected().size > 0} copying={copying()} onClick={() => void copySelected()} />}
            filter={props.state.filter()}
            onFilterChange={props.state.setFilter}
            filterPlaceholder={language.t("ava.sidePanel.searchFiles")}
            width={props.state.sidebarWidth()}
            onWidthChange={props.state.resizeSidebar}
          >
            <Show
              when={query()}
              fallback={
                <AvaBrowseFileTree
                  root={props.directory}
                  active={active()}
                  selected={selected()}
                  onToggleSelect={toggleSelect}
                  onFileClick={setActive}
                  onFileContextMenu={(path, event) => {
                    if (!canReveal()) return
                    menu.show(path, event)
                  }}
                />
              }
            >
              <Show
                when={!search.isPending}
                fallback={
                  <div role="status" class="px-2 py-2 text-12-regular text-text-weak">
                    {language.t("common.loading")}
                    {language.t("common.loading.ellipsis")}
                  </div>
                }
              >
                <div class="flex flex-col gap-0.5 px-1 py-1">
                  <Show
                    when={(search.data ?? []).length > 0}
                    fallback={<div class="px-2 py-2 text-12-regular text-text-weak">{language.t("palette.empty")}</div>}
                  >
                    <For each={search.data ?? []}>
                      {(path) => (
                        <button
                          type="button"
                          class="text-start text-12-medium px-2 py-1 rounded hover:bg-surface-base-hover truncate"
                          data-selected={path === active() ? "" : undefined}
                          onClick={() => setActive(path)}
                          onContextMenu={(event) => {
                            if (!canReveal()) return
                            menu.show(path, event)
                          }}
                        >
                          {path.slice(props.directory.length).replace(/^[/\\]/, "") || path}
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </Show>
          </SessionReviewV2Sidebar>
        }
      >
        <div class="min-h-0 flex-1 flex flex-col">
          <AvaBrowseFilePreview path={active()} />
        </div>
      </SessionFilePanelV2>
      <AvaFileContextMenu
        open={menu.open()}
        x={menu.point().x}
        y={menu.point().y}
        onClose={menu.close}
        onReveal={() => {
          const path = menu.path()
          if (path) void platform.revealPath?.(path)
        }}
      />
    </div>
  )
}
