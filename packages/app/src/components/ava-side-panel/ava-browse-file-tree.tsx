import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import "@opencode-ai/ui/v2/file-tree-v2.css"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { pathToFileUrl, withFileDragImage } from "@/components/file-tree"
import { TruncatedCursorTooltip, isTextTruncated } from "@/components/truncated-cursor-tooltip"
import { usePlatform, type BrowseDirectoryEntry } from "@/context/platform"
import { AvaFileRowCheckbox } from "./ava-file-row-checkbox"
import { isTextFilePath } from "./ava-text-file"

type BrowseRow = {
  entry: BrowseDirectoryEntry
  level: number
}

function BrowseTreeRow(props: {
  row: BrowseRow
  active?: string
  expanded: boolean
  selected: boolean
  onToggle: () => void
  onFileClick: () => void
  onFileContextMenu?: (event: MouseEvent) => void
  onToggleSelect: (checked: boolean) => void
}) {
  const [nameEl, setNameEl] = createSignal<HTMLSpanElement>()
  const [truncated, setTruncated] = createSignal(false)
  const entry = () => props.row.entry

  return (
    <TruncatedCursorTooltip text={entry().name} disabled={!truncated()}>
      {(handlers) => (
        <button
          type="button"
          data-slot="file-tree-v2-row"
          data-path={entry().path}
          data-selected={entry().path === props.active ? "" : undefined}
          class="relative w-full"
          style={`padding-inline-start: ${8 + props.row.level * 16}px`}
          draggable
          onDragStart={(event) => {
            event.dataTransfer?.setData("text/plain", `file:${entry().path}`)
            event.dataTransfer?.setData("text/uri-list", pathToFileUrl(entry().path))
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy"
            withFileDragImage(event, entry().name)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (event.dataTransfer) event.dataTransfer.dropEffect = "none"
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={() => {
            if (entry().type === "directory") {
              props.onToggle()
              return
            }
            props.onFileClick()
          }}
          onContextMenu={(event) => {
            if (entry().type !== "file" || !props.onFileContextMenu) return
            event.preventDefault()
            props.onFileContextMenu(event)
          }}
          onMouseEnter={(event) => {
            setTruncated(isTextTruncated(nameEl()))
            handlers.onMouseEnter(event)
          }}
          onMouseLeave={handlers.onMouseLeave}
          onMouseMove={handlers.onMouseMove}
        >
          <Show when={entry().type === "directory"}>
            <div
              data-slot="file-tree-v2-chevron"
              data-expanded={props.expanded ? "" : undefined}
              class="size-4 flex items-center justify-center"
            >
              <Icon name="chevron-down" />
            </div>
          </Show>
          <Show when={entry().type === "file" && props.row.level > 0}>
            <div class="w-4 shrink-0" />
          </Show>
          <span class="filetree-iconpair size-4">
            <FileIcon
              node={{ path: entry().path, type: entry().type }}
              class="size-4 filetree-icon filetree-icon--color"
            />
            <FileIcon
              node={{ path: entry().path, type: entry().type }}
              class="size-4 filetree-icon filetree-icon--mono"
              mono
            />
          </span>
          <span ref={setNameEl} class="flex-1 min-w-0 text-start text-12-medium whitespace-nowrap truncate">
            <bdi dir="auto">{entry().name}</bdi>
          </span>
          <Show when={entry().type === "file" && isTextFilePath(entry().path)}>
            <AvaFileRowCheckbox
              path={entry().path}
              checked={props.selected}
              onChange={props.onToggleSelect}
            />
          </Show>
        </button>
      )}
    </TruncatedCursorTooltip>
  )
}

export function AvaBrowseFileTree(props: {
  root: string
  active?: string
  selected: ReadonlySet<string>
  onToggleSelect: (path: string, checked: boolean) => void
  onFileClick: (path: string) => void
  onFileContextMenu?: (path: string, event: MouseEvent) => void
}) {
  const platform = usePlatform()
  const [expanded, setExpanded] = createStore<Record<string, boolean>>({})
  const [children, setChildren] = createStore<Record<string, BrowseDirectoryEntry[]>>({})
  const [loading, setLoading] = createSignal(false)

  const load = async (dir: string) => {
    if (!platform.browseListDirectory) return
    const entries = await platform.browseListDirectory(dir)
    setChildren(dir, entries)
  }

  createEffect(() => {
    const root = props.root
    setLoading(true)
    void load(root).finally(() => setLoading(false))
  })

  const rows = createMemo(() => {
    const result: BrowseRow[] = []
    const walk = (dir: string, level: number) => {
      const entries = children[dir] ?? []
      for (const entry of entries) {
        result.push({ entry, level })
        if (entry.type === "directory" && expanded[entry.path]) walk(entry.path, level + 1)
      }
    }
    walk(props.root, 0)
    return result
  })

  const toggle = (path: string) => {
    if (expanded[path]) {
      setExpanded(path, false)
      return
    }
    setExpanded(path, true)
    if (!children[path]) void load(path)
  }

  return (
    <Show
      when={!loading() || (children[props.root]?.length ?? 0) > 0}
      fallback={<div class="px-2 py-2 text-12-regular text-text-weak">…</div>}
    >
      <div data-component="file-tree-v2" class="group/file-tree-v2 ava-browse-file-tree">
        <For each={rows()}>
          {(row) => (
            <BrowseTreeRow
              row={row}
              active={props.active}
              expanded={!!expanded[row.entry.path]}
              selected={props.selected.has(row.entry.path)}
              onToggle={() => toggle(row.entry.path)}
              onFileClick={() => props.onFileClick(row.entry.path)}
              onFileContextMenu={(event) => props.onFileContextMenu?.(row.entry.path, event)}
              onToggleSelect={(checked) => props.onToggleSelect(row.entry.path, checked)}
            />
          )}
        </For>
      </div>
    </Show>
  )
}
