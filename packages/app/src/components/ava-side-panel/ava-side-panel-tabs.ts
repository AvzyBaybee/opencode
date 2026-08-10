import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"
import { pathKey } from "@/utils/path-key"

export const AVA_PROJECT_FOLDER_TAB = "ava-project-folder"

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

type AvaSidePanelTabsState = {
  browseDirectories: string[]
  active: string
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
    }),
  )
}

export function createAvaSidePanelTabs(projectDirectory: () => string) {
  ensureStore()

  const tabs = createMemo(() => [AVA_PROJECT_FOLDER_TAB, ...store.browseDirectories.map(browseFolderTab)])

  const active = createMemo(() => {
    const current = store.active
    if (tabs().includes(current)) return current
    return AVA_PROJECT_FOLDER_TAB
  })

  const openBrowse = (directory: string) => {
    const key = pathKey(directory)
    const existing = store.browseDirectories.find((item) => pathKey(item) === key)
    if (!existing) setStore("browseDirectories", store.browseDirectories.length, directory)
    setStore("active", browseFolderTab(existing ?? directory))
  }

  const close = (tab: string) => {
    if (tab === AVA_PROJECT_FOLDER_TAB) return
    const directory = directoryFromBrowseTab(tab)
    if (!directory) return
    const key = pathKey(directory)
    setStore(
      "browseDirectories",
      store.browseDirectories.filter((item) => pathKey(item) !== key),
    )
    if (store.active === tab) setStore("active", AVA_PROJECT_FOLDER_TAB)
  }

  const setActive = (tab: string) => {
    if (!tabs().includes(tab)) return
    setStore("active", tab)
  }

  return {
    tabs,
    active,
    projectDirectory,
    openBrowse,
    close,
    setActive,
    browseDirectories: () => store.browseDirectories,
  }
}

export type AvaSidePanelTabs = ReturnType<typeof createAvaSidePanelTabs>
