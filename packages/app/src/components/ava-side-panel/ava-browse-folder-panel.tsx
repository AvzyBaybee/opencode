import { createMemo, createSignal, For, Show } from "solid-js"
import { createQuery } from "@tanstack/solid-query"
import { SessionFilePanelV2 } from "@opencode-ai/session-ui/v2/session-file-panel-v2"
import { SessionReviewV2Sidebar } from "@opencode-ai/session-ui/v2/session-review-v2"
import { TruncatedCursorTooltip, isTextTruncated } from "@/components/truncated-cursor-tooltip"
import { pathToFileUrl, withFileDragImage } from "@/components/file-tree"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import type { ReviewPanelV2State } from "@/pages/session/v2/review-panel-v2-state"
import { showToast } from "@/utils/toast"
import { AvaBrowseFileTree } from "./ava-browse-file-tree"
import { AvaBrowseFilePreview } from "./ava-file-preview"
import { AvaCopyButton } from "./ava-file-row-checkbox"
import { AvaFileContextMenu, useAvaFileContextMenu } from "./ava-file-context-menu"
import { AvaFolderHeader } from "./ava-folder-header"
import { copyTextToClipboard, formatFilesForClipboard } from "./ava-copy-selected-files"
import { fuzzyFilterPaths, listFilesRecursive } from "./ava-fuzzy-search"
import type { AvaSidePanelTabs } from "./ava-side-panel-tabs"

const emptyFiles: string[] = []

function BrowseSearchRow(props: {
  path: string
  label: string
  active?: string
  onClick: () => void
  onContextMenu?: (event: MouseEvent) => void
}) {
  const [nameEl, setNameEl] = createSignal<HTMLSpanElement>()
  const [truncated, setTruncated] = createSignal(false)
  const selected = () => props.path === props.active

  return (
    <TruncatedCursorTooltip text={props.label} disabled={!truncated()}>
      {(handlers) => (
        <button
          type="button"
          class="ava-file-list-row text-start text-12-medium px-2 py-1 rounded hover:bg-surface-base-hover w-full"
          data-slot="file-tree-v2-row"
          data-path={props.path}
          data-selected={selected() ? "" : undefined}
          draggable
          onDragStart={(event) => {
            event.dataTransfer?.setData("text/plain", `file:${props.path}`)
            event.dataTransfer?.setData("text/uri-list", pathToFileUrl(props.path))
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy"
            withFileDragImage(event, props.label)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (event.dataTransfer) event.dataTransfer.dropEffect = "none"
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={props.onClick}
          onContextMenu={props.onContextMenu}
          onMouseEnter={(event) => {
            setTruncated(isTextTruncated(nameEl()))
            handlers.onMouseEnter(event)
          }}
          onMouseLeave={handlers.onMouseLeave}
          onMouseMove={handlers.onMouseMove}
        >
          <span ref={setNameEl} class="truncate block">
            {props.label}
          </span>
        </button>
      )}
    </TruncatedCursorTooltip>
  )
}

export function AvaBrowseFolderPanel(props: {
  directory: string
  state: ReviewPanelV2State
  tabs: AvaSidePanelTabs
  onOpenFolder: () => void
  canOpenFolder: boolean
}) {
  const language = useLanguage()
  const platform = usePlatform()
  const [active, setActive] = createSignal<string>()
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [copying, setCopying] = createSignal(false)
  const menu = useAvaFileContextMenu()
  const query = createMemo(() => props.state.filter().trim())
  const canReveal = createMemo(() => platform.platform === "desktop" && !!platform.revealPath)

  const index = createQuery(() => ({
    queryKey: ["ava-browse-file-index", props.directory] as const,
    enabled: !!platform.browseListDirectory,
    staleTime: Infinity,
    queryFn: async () => {
      if (!platform.browseListDirectory) return emptyFiles
      return listFilesRecursive(async (dir) => {
        const entries = await platform.browseListDirectory!(dir || props.directory)
        return entries.map((entry) => ({ path: entry.path, type: entry.type }))
      }, props.directory)
    },
  }))

  const files = createMemo(() => {
    const value = query()
    if (!value) return emptyFiles
    const all = index.data ?? emptyFiles
    if (all.length === 0) return emptyFiles
    return [...new Set(fuzzyFilterPaths(value, all))]
  })

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
      description: language.plural("ava.sidePanel.copySuccess.description", paths.length),
    })
  }

  return (
    <div class="size-full min-h-0 ava-side-panel">
      <SessionFilePanelV2
        toolbar={false}
        sidebar={
          <SessionReviewV2Sidebar
            open={props.state.sidebarOpened()}
            transition={props.state.sidebarTransition()}
            title={
              <AvaFolderHeader
                tabs={props.tabs}
                onOpenFolder={props.onOpenFolder}
                canOpenFolder={props.canOpenFolder}
              />
            }
            filter={props.state.filter()}
            onFilterChange={props.state.setFilter}
            filterPlaceholder={language.t("ava.sidePanel.searchFiles")}
            width={props.state.sidebarWidth()}
            onWidthChange={props.state.resizeSidebar}
            leading={
              <Show when={selected().size > 0}>
                <div class="ava-side-panel-copy-slot">
                  <AvaCopyButton visible copying={copying()} onClick={() => void copySelected()} />
                </div>
              </Show>
            }
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
              <div class="flex flex-col gap-0.5 px-1 py-1">
                <Show
                  when={files().length > 0}
                  fallback={<div class="px-2 py-2 text-12-regular text-text-weak">{language.t("palette.empty")}</div>}
                >
                  <For each={files()}>
                    {(path) => (
                      <BrowseSearchRow
                        path={path}
                        label={path.slice(props.directory.length).replace(/^[/\\]/, "") || path}
                        active={active()}
                        onClick={() => setActive(path)}
                        onContextMenu={(event) => {
                          if (!canReveal()) return
                          menu.show(path, event)
                        }}
                      />
                    )}
                  </For>
                </Show>
              </div>
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
