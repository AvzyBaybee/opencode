import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"
import { pathKey } from "@/utils/path-key"

export const AVA_PROJECT_FOLDER_TAB = "ava-project-folder"
export const AVA_CONTEXT_TAB = "ava-context"
export const AVA_BACKUP_TAB = "ava-backup"
export const AVA_AGENTS_TAB = "ava-agents"
export const AVA_INSTRUCTIONS_TAB = "ava-instructions"

const AVA_FIXED_TABS = [AVA_PROJECT_FOLDER_TAB, AVA_CONTEXT_TAB, AVA_BACKUP_TAB, AVA_AGENTS_TAB, AVA_INSTRUCTIONS_TAB] as const

export function browseFolderTab(directory: string) {
  return `ava-browse://${encodeURIComponent(directory)}`
}

export function directoryFromBrowseTab(tab: string) {
  if (!tab.startsWith("ava-browse://")) return
  return decodeURIComponent(tab.slice("ava-browse://".length))
}

export function isBrowseFolderTab(tab: string) {
  return tab.startsWith("ava-browse://")
}

export function isAvaFilesTab(tab: string) {
  return tab === AVA_PROJECT_FOLDER_TAB || isBrowseFolderTab(tab)
}

export function isAvaFixedTab(tab: string) {
  return AVA_FIXED_TABS.includes(tab as (typeof AVA_FIXED_TABS)[number])
}

type AvaSidePanelTabsState = {
  browseDirectories: string[]
  active: string
  lastFiles: string
}

let store: ReturnType<typeof createStore<AvaSidePanelTabsState>>[0]
let setStore: ReturnType<typeof createStore<AvaSidePanelTabsState>>[1]

function ensureStore() {
  if (store) return
  ;[store, setStore] = persisted(
    Persist.global("ava.side-panel-tabs"),
    createStore<AvaSidePanelTabsState>({
      browseDirectories: [],
      active: AVA_PROJECT_FOLDER_TAB,
      lastFiles: AVA_PROJECT_FOLDER_TAB,
    }),
  )
}

export function createAvaSidePanelTabs(projectDirectory: () => string) {
  ensureStore()

  const tabs = createMemo(() => [...AVA_FIXED_TABS, ...store.browseDirectories.map(browseFolderTab)])

  const active = createMemo(() => {
    const current = store.active
    if (tabs().includes(current)) return current
    return AVA_PROJECT_FOLDER_TAB
  })

  const setActive = (tab: string) => {
    if (!tabs().includes(tab)) return
    if (isAvaFilesTab(tab)) setStore("lastFiles", tab)
    setStore("active", tab)
  }

  const showFiles = () => {
    const last = store.lastFiles
    if (typeof last === "string" && tabs().includes(last) && isAvaFilesTab(last)) {
      setStore("active", last)
      return
    }
    setStore("active", AVA_PROJECT_FOLDER_TAB)
  }

  const openBrowse = (directory: string) => {
    const key = pathKey(directory)
    const existing = store.browseDirectories.find((item) => pathKey(item) === key)
    if (!existing) setStore("browseDirectories", store.browseDirectories.length, directory)
    setActive(browseFolderTab(existing ?? directory))
  }

  const close = (tab: string) => {
    if (!isBrowseFolderTab(tab)) return
    const directory = directoryFromBrowseTab(tab)
    if (!directory) return
    const key = pathKey(directory)
    setStore(
      "browseDirectories",
      store.browseDirectories.filter((item) => pathKey(item) !== key),
    )
    if (store.lastFiles === tab) setStore("lastFiles", AVA_PROJECT_FOLDER_TAB)
    if (store.active === tab) setStore("active", AVA_PROJECT_FOLDER_TAB)
  }

  return {
    tabs,
    active,
    projectDirectory,
    openBrowse,
    close,
    setActive,
    showFiles,
    browseDirectories: () => store.browseDirectories,
  }
}

export type AvaSidePanelTabs = ReturnType<typeof createAvaSidePanelTabs>
