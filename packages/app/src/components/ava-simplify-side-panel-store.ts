import { createMemo } from "solid-js"
import { createStore, type SetStoreFunction, type Store } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"

type SimplifySidePanelState = {
  enabled: boolean
}

let simplifySidePanelStore: Store<SimplifySidePanelState>
let setSimplifySidePanelStore: SetStoreFunction<SimplifySidePanelState>

function ensureStore() {
  if (simplifySidePanelStore) return
  ;[simplifySidePanelStore, setSimplifySidePanelStore] = persisted(
    Persist.global("ava.simplify-side-panel"),
    createStore<SimplifySidePanelState>({ enabled: false }),
  )
}

export function useAvaSimplifySidePanelStore() {
  ensureStore()

  const enabled = createMemo(() => simplifySidePanelStore.enabled === true)

  const setEnabled = (value: boolean) => {
    setSimplifySidePanelStore("enabled", value)
  }

  return {
    enabled,
    setEnabled,
  }
}
