import { FileIcon } from "@opencode-ai/ui/file-icon"
import "@opencode-ai/ui/v2/file-tree-v2.css"
import { getDirectory, getFilename } from "@opencode-ai/core/util/path"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { kindChange, kindLabel, type Kind } from "@/components/file-tree-v2"
import { pathToFileUrl, withFileDragImage } from "@/components/file-tree"
import { TruncatedCursorTooltip, isTextTruncated } from "@/components/truncated-cursor-tooltip"
import { useStickyScrollport } from "@/components/use-sticky-scrollport"
import { normalizePath } from "@/pages/session/v2/review-diff-kinds"
import { createVirtualizer, defaultRangeExtractor } from "@tanstack/solid-virtual"
import { virtualScrollElement } from "@/components/virtual-scroll-element"

// Drives the highlight/selection of the flat search-result list from the filter
// input's keyboard events.
export function applyFileListKeyDown(
  event: KeyboardEvent,
  files: readonly string[],
  highlighted: string | undefined,
  options: { onHighlight: (path: string) => void; onSelect: (path: string) => void },
) {
  if (files.length === 0) return

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const currentIndex = highlighted ? files.indexOf(highlighted) : -1
    const delta = event.key === "ArrowDown" ? 1 : -1
    const start = currentIndex === -1 ? (delta > 0 ? 0 : files.length - 1) : currentIndex + delta
    const index = Math.max(0, Math.min(files.length - 1, start))
    options.onHighlight(files[index]!)
    event.preventDefault()
    return
  }

  if (event.key !== "Enter") return
  const target = highlighted ?? files[0]
  if (!target) return
  options.onSelect(target)
  event.preventDefault()
}

function SessionFileListRow(props: {
  path: string
  optionID?: string
  role?: "listbox"
  selected: boolean
  highlighted: boolean
  kind?: Kind
  nameTooltip?: boolean
  draggable: boolean
  onFocus: () => void
  onBlur: () => void
  onClick: () => void
  onDblClick?: () => void
}) {
  const directory = () => (props.path.includes("/") ? getDirectory(props.path) : undefined)
  const filename = () => getFilename(props.path)
  const label = () => (directory() ? `${directory()}${filename()}` : filename())
  const [nameEl, setNameEl] = createSignal<HTMLSpanElement>()
  const [truncated, setTruncated] = createSignal(false)

  return (
    <TruncatedCursorTooltip text={label()} disabled={!props.nameTooltip || !truncated()}>
      {(handlers) => (
        <button
          type="button"
          id={props.optionID}
          role={props.role ? "option" : undefined}
          aria-selected={props.role ? props.selected : undefined}
          data-slot="file-tree-v2-row"
          data-path={props.path}
          data-selected={props.selected ? "" : undefined}
          data-highlighted={props.highlighted ? "" : undefined}
          style="padding-left: 8px"
          draggable={props.draggable}
          onDragStart={(event) => {
            if (!props.draggable) return
            event.dataTransfer?.setData("text/plain", `file:${props.path}`)
            event.dataTransfer?.setData("text/uri-list", pathToFileUrl(props.path))
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy"
            withFileDragImage(event, filename())
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (event.dataTransfer) event.dataTransfer.dropEffect = "none"
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          onClick={props.onClick}
          onDblClick={props.onDblClick}
          onMouseEnter={(event) => {
            if (props.nameTooltip) setTruncated(isTextTruncated(nameEl()))
            handlers.onMouseEnter(event)
          }}
          onMouseLeave={handlers.onMouseLeave}
          onMouseMove={handlers.onMouseMove}
        >
          <span class="filetree-iconpair size-4">
            <FileIcon node={{ path: props.path, type: "file" }} class="size-4 filetree-icon filetree-icon--color" />
            <FileIcon node={{ path: props.path, type: "file" }} class="size-4 filetree-icon filetree-icon--mono" mono />
          </span>
          <span ref={setNameEl} class="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap">
            <Show when={directory()}>
              {(value) => <span class="text-12-medium text-text-muted truncate min-w-0 shrink">{value()}</span>}
            </Show>
            <span class="text-12-medium text-text-base truncate min-w-0 shrink-0">{filename()}</span>
          </span>
          <Show when={props.kind}>
            {(value) => (
              <span data-slot="file-tree-v2-change" data-change={kindChange(value())}>
                {kindLabel(value())}
              </span>
            )}
          </Show>
        </button>
      )}
    </TruncatedCursorTooltip>
  )
}

// Flat variant of FileTreeV2 for filtered results: reuses its data-component and
// row data-slots on purpose so file-tree-v2.css styles both. data-highlighted has
// no CSS of its own — it folds into data-selected below and only exists as the
// scrollIntoView query hook.
export function SessionFileListV2(props: {
  files: readonly string[]
  active?: string
  highlighted?: string
  kinds?: ReadonlyMap<string, Kind>
  id?: string
  role?: "listbox"
  optionID?: (path: string) => string
  stickyActive?: boolean
  nameTooltip?: boolean
  draggable?: boolean
  onFileClick: (path: string) => void
  onFileDoubleClick?: (path: string) => void
}) {
  const active = () => normalizePath(props.active ?? "")
  const highlighted = () => normalizePath(props.highlighted ?? "")
  const normalized = createMemo(() => props.files.map(normalizePath))
  const stickyKey = () => active() || highlighted()
  const [root, setRoot] = createSignal<HTMLDivElement>()
  const [focused, setFocused] = createSignal<string>()
  const sticky = useStickyScrollport({
    enabled: () => !!props.stickyActive,
    root,
  })
  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return props.files.length
    },
    getScrollElement: () => virtualScrollElement(root()),
    initialRect: { width: 0, height: 600 },
    estimateSize: () => 28,
    gap: 2,
    overscan: 10,
    get getItemKey() {
      const files = props.files
      return (index: number) => files[index] ?? index
    },
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range)
      const path = props.stickyActive ? stickyKey() || focused() : focused()
      const index = path ? normalized().indexOf(normalizePath(path)) : -1
      if (index < 0 || indexes.includes(index)) return indexes
      return [...indexes, index].sort((a, b) => a - b)
    },
  })

  createEffect(() => {
    const index = normalized().indexOf(highlighted())
    if (index < 0) return
    queueMicrotask(() => {
      if (virtualizer.range && index >= virtualizer.range.startIndex && index <= virtualizer.range.endIndex) return
      virtualizer.scrollToIndex(index, { align: "auto" })
    })
  })
  const virtualItemByKey = createMemo(
    () => new Map(virtualizer.getVirtualItems().map((item) => [item.key, item] as const)),
  )
  const virtualRowKeys = createMemo(() => virtualizer.getVirtualItems().map((item) => item.key))
  const draggable = () => props.draggable ?? true

  return (
    <div
      ref={setRoot}
      id={props.id}
      role={props.role}
      data-component="file-tree-v2"
      data-total-rows={props.files.length}
      style={{ position: "relative", height: `${virtualizer.getTotalSize()}px` }}
    >
      <For each={virtualRowKeys()}>
        {(key) => {
          const path = key as string
          const value = normalizePath(path)
          const selected = () => (highlighted() ? highlighted() === value : active() === value)
          const highlightedRow = () => highlighted() === value
          const kind = () => props.kinds?.get(value)
          return (
            <Show when={virtualItemByKey().get(key)}>
              {(item) => {
                const placed = () => sticky.place(value, stickyKey() || undefined, item().start, item().size)
                return (
                  <div
                    data-ava-sticky-active={placed().pinned}
                    style={{
                      position: "absolute",
                      top: "0",
                      left: "0",
                      width: "100%",
                      height: `${item().size}px`,
                      transform: `translateY(${placed().y}px)`,
                      "z-index":
                        placed().pinned === "bottom" ? "12" : placed().pinned ? "11" : "auto",
                    }}
                  >
                    <SessionFileListRow
                      path={path}
                      optionID={props.optionID?.(path)}
                      role={props.role}
                      selected={selected()}
                      highlighted={highlightedRow()}
                      kind={kind()}
                      nameTooltip={props.nameTooltip}
                      draggable={draggable()}
                      onFocus={() => setFocused(path)}
                      onBlur={() => setFocused(undefined)}
                      onClick={() => props.onFileClick(path)}
                      onDblClick={() => props.onFileDoubleClick?.(path)}
                    />
                  </div>
                )
              }}
            </Show>
          )
        }}
      </For>
    </div>
  )
}
