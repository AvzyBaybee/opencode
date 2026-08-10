import { createMemo, createSignal, createUniqueId, Show } from "solid-js"
import { createQuery } from "@tanstack/solid-query"
import { SessionFilePanelV2 } from "@opencode-ai/session-ui/v2/session-file-panel-v2"
import { SessionReviewV2Sidebar } from "@opencode-ai/session-ui/v2/session-review-v2"
import type { FileNode } from "@opencode-ai/sdk/v2"
import FileTreeV2 from "@/components/file-tree-v2"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"
import { useSessionLayout } from "@/pages/session/session-layout"
import { SessionFileListV2 } from "@/pages/session/v2/session-file-list-v2"
import type { ReviewPanelV2State } from "@/pages/session/v2/review-panel-v2-state"
import { showToast } from "@/utils/toast"
import { AvaCopyButton, AvaFileRowCheckbox } from "./ava-file-row-checkbox"
import { AvaProjectFilePreview } from "./ava-file-preview"
import { AvaFileContextMenu, useAvaFileContextMenu } from "./ava-file-context-menu"
import { copyTextToClipboard, formatFilesForClipboard } from "./ava-copy-selected-files"
import { isTextFilePath } from "./ava-text-file"

const emptyFiles: string[] = []

export function AvaSimplifySidePanel(props: { state: ReviewPanelV2State }) {
  const file = useFile()
  const language = useLanguage()
  const platform = usePlatform()
  const sdk = useSDK()
  const { workspaceKey } = useSessionLayout()
  const resultsID = `ava-simplify-results-${createUniqueId()}`
  const [active, setActive] = createSignal<string>()
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [copying, setCopying] = createSignal(false)
  const menu = useAvaFileContextMenu()
  const query = createMemo(() => props.state.filter().trim())
  const search = createQuery(() => {
    const value = query()
    return {
      queryKey: ["ava-simplify-search", workspaceKey(), value] as const,
      enabled: value.length > 0,
      queryFn: ({ signal }) => file.searchFiles(value, { limit: 200, signal }),
    }
  })
  const files = createMemo(() => {
    if (!query() || search.isPending) return emptyFiles
    return [...new Set(search.data ?? emptyFiles)]
  })
  const loading = createMemo(() => query().length > 0 && search.isPending)
  const canReveal = createMemo(() => platform.platform === "desktop" && !!platform.revealPath)

  const toggleSelect = (path: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(path)
      else next.delete(path)
      return next
    })
  }

  const reveal = (path: string) => {
    if (!canReveal()) return
    const absolute = path.match(/^[a-zA-Z]:[\\/]/) || path.startsWith("/") ? path : `${sdk().directory}/${path}`
    void platform.revealPath?.(absolute)
  }

  const copySelected = async () => {
    const paths = [...selected()]
    if (paths.length === 0 || copying()) return
    setCopying(true)
    const loaded = await Promise.all(
      paths.map(async (path) => {
        await file.load(path)
        return { path, content: file.get(path)?.content?.content ?? "" }
      }),
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

  const trailing = (node: FileNode) => {
    if (node.type !== "file" || !isTextFilePath(node.path)) return undefined
    return (
      <AvaFileRowCheckbox
        path={node.path}
        checked={selected().has(node.path)}
        onChange={(checked) => toggleSelect(node.path, checked)}
      />
    )
  }

  return (
    <div class="size-full min-h-0">
      <SessionFilePanelV2
        toolbar={false}
        sidebar={
          <SessionReviewV2Sidebar
            open={props.state.sidebarOpened()}
            transition={props.state.sidebarTransition()}
            title={<span class="truncate">{language.t("ava.sidePanel.files")}</span>}
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
                <FileTreeV2
                  active={active()}
                  draggable={false}
                  onFileClick={(node) => setActive(node.path)}
                  onFileContextMenu={(node, event) => {
                    if (!canReveal()) return
                    menu.show(node.path, event)
                  }}
                  trailing={trailing}
                />
              }
            >
              <Show
                when={!loading()}
                fallback={
                  <div role="status" class="px-2 py-2 text-12-regular text-text-weak">
                    {language.t("common.loading")}
                    {language.t("common.loading.ellipsis")}
                  </div>
                }
              >
                <SessionFileListV2
                  id={resultsID}
                  role="listbox"
                  optionID={(path) => `${resultsID}-option-${files().indexOf(path)}`}
                  files={files()}
                  active={active()}
                  highlighted={files()[0]}
                  onFileClick={setActive}
                  onFileDoubleClick={setActive}
                />
              </Show>
            </Show>
          </SessionReviewV2Sidebar>
        }
      >
        <div class="min-h-0 flex-1 flex flex-col">
          <AvaProjectFilePreview path={active()} />
        </div>
      </SessionFilePanelV2>
      <AvaFileContextMenu
        open={menu.open()}
        x={menu.point().x}
        y={menu.point().y}
        onClose={menu.close}
        onReveal={() => {
          const path = menu.path()
          if (path) reveal(path)
        }}
      />
    </div>
  )
}
