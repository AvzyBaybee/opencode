import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import "@opencode-ai/ui/v2/file-tree-v2.css"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { usePlatform, type BrowseDirectoryEntry } from "@/context/platform"
import { AvaFileRowCheckbox } from "./ava-file-row-checkbox"
import { isTextFilePath } from "./ava-text-file"

type BrowseRow = {
  entry: BrowseDirectoryEntry
  level: number
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
      <div data-component="file-tree-v2" class="group/file-tree-v2">
        <For each={rows()}>
          {(row) => (
            <button
              type="button"
              data-slot="file-tree-v2-row"
              data-path={row.entry.path}
              data-selected={row.entry.path === props.active ? "" : undefined}
              class="relative w-full"
              style={`padding-inline-start: ${8 + row.level * 16}px`}
              onClick={() => {
                if (row.entry.type === "directory") {
                  toggle(row.entry.path)
                  return
                }
                props.onFileClick(row.entry.path)
              }}
              onContextMenu={(event) => {
                if (row.entry.type !== "file" || !props.onFileContextMenu) return
                event.preventDefault()
                props.onFileContextMenu(row.entry.path, event)
              }}
            >
              <Show when={row.entry.type === "directory"}>
                <div
                  data-slot="file-tree-v2-chevron"
                  data-expanded={expanded[row.entry.path] ? "" : undefined}
                  class="size-4 flex items-center justify-center"
                >
                  <Icon name="chevron-down" />
                </div>
              </Show>
              <Show when={row.entry.type === "file" && row.level > 0}>
                <div class="w-4 shrink-0" />
              </Show>
              <span class="filetree-iconpair size-4">
                <FileIcon
                  node={{ path: row.entry.path, type: row.entry.type }}
                  class="size-4 filetree-icon filetree-icon--color"
                />
                <FileIcon
                  node={{ path: row.entry.path, type: row.entry.type }}
                  class="size-4 filetree-icon filetree-icon--mono"
                  mono
                />
              </span>
              <span class="flex-1 min-w-0 text-start text-12-medium whitespace-nowrap truncate">
                <bdi dir="auto">{row.entry.name}</bdi>
              </span>
              <Show when={row.entry.type === "file" && isTextFilePath(row.entry.path)}>
                <AvaFileRowCheckbox
                  path={row.entry.path}
                  checked={props.selected.has(row.entry.path)}
                  onChange={(checked) => props.onToggleSelect(row.entry.path, checked)}
                />
              </Show>
            </button>
          )}
        </For>
      </div>
    </Show>
  )
}
