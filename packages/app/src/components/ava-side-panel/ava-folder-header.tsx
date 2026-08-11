import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { TruncatedCursorTooltip, isTextTruncated } from "@/components/truncated-cursor-tooltip"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import {
  AVA_PROJECT_FOLDER_TAB,
  directoryFromBrowseTab,
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
  const others = createMemo(() => props.tabs.tabs().filter((tab) => tab !== active()))
  const hasOthers = createMemo(() => others().length > 0)
  const tooltipText = createMemo(() => (isProject() ? language.t("ava.sidePanel.projectFolder") : activeDirectory()))

  const labelFor = (tab: string) => {
    if (tab === AVA_PROJECT_FOLDER_TAB) return folderBasename(props.tabs.projectDirectory())
    return folderBasename(directoryFromBrowseTab(tab) ?? tab)
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
        <TruncatedCursorTooltip text={tooltipText()} disabled={!truncated()}>
          {(handlers) => (
            <button
              type="button"
              class="ava-folder-name-button"
              data-project={isProject() ? "" : undefined}
              aria-expanded={hasOthers() ? open() : undefined}
              aria-haspopup={hasOthers() ? "menu" : undefined}
              onMouseEnter={handlers.onMouseEnter}
              onMouseLeave={handlers.onMouseLeave}
              onMouseMove={handlers.onMouseMove}
              onClick={() => {
                if (!hasOthers()) return
                setOpen((value) => !value)
              }}
            >
              <span class="ava-folder-name-chevron" data-visible={hasOthers() ? "" : undefined} aria-hidden="true">
                <Icon name="chevron-down" size="small" />
              </span>
              <span class="ava-folder-name-text" ref={setTextEl}>
                {name()}
              </span>
              <Show when={!isProject()}>
                <span
                  class="ava-folder-name-close"
                  role="button"
                  tabindex="0"
                  aria-label={language.t("common.closeTab")}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    props.tabs.close(active())
                    closeMenu()
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return
                    event.preventDefault()
                    event.stopPropagation()
                    props.tabs.close(active())
                    closeMenu()
                  }}
                >
                  <Icon name="close-small" size="small" />
                </span>
              </Show>
            </button>
          )}
        </TruncatedCursorTooltip>
        <Show when={open() && hasOthers()}>
          <div class="ava-folder-dropdown" role="menu">
            <For each={others()}>
              {(tab) => (
                <button
                  type="button"
                  role="menuitem"
                  class="ava-folder-dropdown-item"
                  data-project={tab === AVA_PROJECT_FOLDER_TAB ? "" : undefined}
                  onClick={() => {
                    props.tabs.setActive(tab)
                    closeMenu()
                  }}
                >
                  <span class="ava-folder-dropdown-label truncate">{labelFor(tab)}</span>
                  <Show when={isBrowseFolderTab(tab)}>
                    <span
                      class="ava-folder-dropdown-close"
                      role="button"
                      tabindex="0"
                      aria-label={language.t("common.closeTab")}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        props.tabs.close(tab)
                      }}
                    >
                      <Icon name="close-small" size="small" />
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <Show when={props.canOpenFolder}>
        <div class="ava-folder-header-add">
          <IconButton
            icon="plus-small"
            variant="ghost"
            class="h-6 w-6"
            onClick={(event) => {
              event.stopPropagation()
              props.onOpenFolder()
            }}
            aria-label={language.t("ava.sidePanel.openFolder")}
          />
        </div>
      </Show>
    </div>
  )
}
