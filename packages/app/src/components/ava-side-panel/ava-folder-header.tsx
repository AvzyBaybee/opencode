import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { TruncatedCursorTooltip, isTextTruncated } from "@/components/truncated-cursor-tooltip"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import {
  AVA_PROJECT_FOLDER_TAB,
  directoryFromBrowseTab,
  isAvaFilesTab,
  isBrowseFolderTab,
  type AvaSidePanelTabs,
} from "./ava-side-panel-tabs"
import { folderBasename } from "./ava-text-file"

const MAX_FONT = 13
const MIN_FONT = 10

function fitFolderName(el: HTMLElement | undefined, text: string) {
  if (!el) return
  el.style.fontSize = `${MAX_FONT}px`
  el.textContent = text
  if (el.scrollWidth <= el.clientWidth) return
  let low = MIN_FONT
  let high = MAX_FONT
  let best = MIN_FONT
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    el.style.fontSize = `${mid}px`
    if (el.scrollWidth <= el.clientWidth) {
      best = mid
      low = mid + 1
      continue
    }
    high = mid - 1
  }
  el.style.fontSize = `${best}px`
}

function AvaFolderDropdownItem(props: {
  label: string
  tooltip: string
  project?: boolean
  closeable?: boolean
  closeLabel: string
  onSelect: () => void
  onClose?: () => void
}) {
  const [textEl, setTextEl] = createSignal<HTMLSpanElement>()
  const [truncated, setTruncated] = createSignal(false)

  const measure = () => {
    const el = textEl()
    fitFolderName(el, props.label)
    setTruncated(isTextTruncated(el))
  }

  createEffect(() => {
    props.label
    measure()
  })

  onMount(() => {
    const el = textEl()
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    onCleanup(() => observer.disconnect())
  })

  return (
    <button
      type="button"
      role="menuitem"
      class="ava-folder-dropdown-item"
      data-project={props.project ? "" : undefined}
      onClick={props.onSelect}
    >
      <TruncatedCursorTooltip
        text={props.tooltip}
        disabled={props.tooltip === props.label ? !truncated() : false}
      >
        {(handlers) => (
          <span
            class="ava-folder-dropdown-label"
            ref={setTextEl}
            onMouseEnter={(event) => {
              measure()
              handlers.onMouseEnter(event)
            }}
            onMouseLeave={handlers.onMouseLeave}
            onMouseMove={handlers.onMouseMove}
          >
            {props.label}
          </span>
        )}
      </TruncatedCursorTooltip>
      <Show when={props.closeable}>
        <TruncatedCursorTooltip text={props.closeLabel}>
          {(handlers) => (
            <button
              type="button"
              class="ava-folder-dropdown-close"
              aria-label={props.closeLabel}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                props.onClose?.()
              }}
              onMouseEnter={handlers.onMouseEnter}
              onMouseLeave={handlers.onMouseLeave}
              onMouseMove={handlers.onMouseMove}
            >
              <Icon name="close-small" size="small" />
            </button>
          )}
        </TruncatedCursorTooltip>
      </Show>
    </button>
  )
}

export function AvaFolderHeader(props: {
  tabs: AvaSidePanelTabs
  onOpenFolder: () => void
  canOpenFolder: boolean
}) {
  const language = useLanguage()
  const [open, setOpen] = createSignal(false)
  const [truncated, setTruncated] = createSignal(false)
  const [textEl, setTextEl] = createSignal<HTMLSpanElement>()
  const active = createMemo(() => props.tabs.active())
  const isProject = createMemo(() => active() === AVA_PROJECT_FOLDER_TAB)
  const activeDirectory = createMemo(() => {
    if (isProject()) return props.tabs.projectDirectory()
    return directoryFromBrowseTab(active()) ?? props.tabs.projectDirectory()
  })
  const name = createMemo(() => folderBasename(activeDirectory()))
  const menuTabs = createMemo(() => props.tabs.tabs().filter((tab) => tab !== active() && isAvaFilesTab(tab)))
  const hasMenu = createMemo(() => menuTabs().length > 0)
  const tooltipText = createMemo(() => (isProject() ? language.t("ava.sidePanel.projectFolder") : activeDirectory()))

  const labelFor = (tab: string) => {
    if (tab === AVA_PROJECT_FOLDER_TAB) return folderBasename(props.tabs.projectDirectory())
    return folderBasename(directoryFromBrowseTab(tab) ?? tab)
  }

  const tooltipFor = (tab: string) => {
    if (tab === AVA_PROJECT_FOLDER_TAB) return language.t("ava.sidePanel.projectFolder")
    return directoryFromBrowseTab(tab) ?? tab
  }

  const closeMenu = () => setOpen(false)

  const measure = () => {
    const el = textEl()
    fitFolderName(el, name())
    setTruncated(isTextTruncated(el))
  }

  createEffect(() => {
    name()
    measure()
  })

  onMount(() => {
    const el = textEl()
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    onCleanup(() => observer.disconnect())
  })

  createEffect(() => {
    if (!open()) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-ava-folder-header]")) return
      closeMenu()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu()
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    })
  })

  return (
    <div class="ava-folder-header" data-ava-folder-header data-project={isProject() ? "" : undefined}>
      <div class="ava-folder-header-center">
        <div
          class="ava-folder-name-button"
          data-project={isProject() ? "" : undefined}
          role={hasMenu() ? "button" : undefined}
          aria-expanded={hasMenu() ? open() : undefined}
          aria-haspopup={hasMenu() ? "menu" : undefined}
          tabIndex={hasMenu() ? 0 : undefined}
          onClick={() => {
            if (!hasMenu()) return
            setOpen((value) => !value)
          }}
          onKeyDown={(event) => {
            if (!hasMenu()) return
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            setOpen((value) => !value)
          }}
        >
          <span class="ava-folder-name-chevron" data-visible={hasMenu() ? "" : undefined} aria-hidden="true">
            <Icon name="chevron-down" size="small" />
          </span>
          <TruncatedCursorTooltip text={tooltipText()} disabled={!isProject() && !truncated()}>
            {(handlers) => (
              <span
                class="ava-folder-name-text"
                ref={setTextEl}
                onMouseEnter={handlers.onMouseEnter}
                onMouseLeave={handlers.onMouseLeave}
                onMouseMove={handlers.onMouseMove}
              >
                {name()}
              </span>
            )}
          </TruncatedCursorTooltip>
          <Show when={props.canOpenFolder}>
            <TruncatedCursorTooltip text={language.t("ava.sidePanel.openNewFolder")}>
              {(handlers) => (
                <button
                  type="button"
                  class="ava-folder-name-add"
                  aria-label={language.t("ava.sidePanel.openNewFolder")}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    props.onOpenFolder()
                  }}
                  onMouseEnter={handlers.onMouseEnter}
                  onMouseLeave={handlers.onMouseLeave}
                  onMouseMove={handlers.onMouseMove}
                >
                  <Icon name="plus-small" size="small" />
                </button>
              )}
            </TruncatedCursorTooltip>
          </Show>
        </div>
        <Show when={open() && hasMenu()}>
          <div class="ava-folder-dropdown" role="menu">
            <For each={menuTabs()}>
              {(tab) => (
                <AvaFolderDropdownItem
                  label={labelFor(tab)}
                  tooltip={tooltipFor(tab)}
                  project={tab === AVA_PROJECT_FOLDER_TAB}
                  closeable={isBrowseFolderTab(tab)}
                  closeLabel={language.t("ava.sidePanel.closeFolder")}
                  onSelect={() => {
                    props.tabs.setActive(tab)
                    closeMenu()
                  }}
                  onClose={() => props.tabs.close(tab)}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
