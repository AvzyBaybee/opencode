import { createMemo } from "solid-js"
import { createStore, type SetStoreFunction, type Store } from "solid-js/store"
import type { HexColor } from "@opencode-ai/ui/theme"
import { persisted } from "@/utils/persist"
import { Persist } from "@/utils/persist"

type UiBaseColorState = {
  color: HexColor | null
}

let uiBaseColorStore: Store<UiBaseColorState>
let setUiBaseColorStore: SetStoreFunction<UiBaseColorState>

function ensureStore() {
  if (uiBaseColorStore) return
  ;[uiBaseColorStore, setUiBaseColorStore] = persisted(
    Persist.global("ava.ui-base-color"),
    createStore<UiBaseColorState>({ color: null }),
  )
}

function isHexColor(value: string): value is HexColor {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function useAvaUiBaseColorStore() {
  ensureStore()

  const customized = createMemo(() => uiBaseColorStore.color !== null)

  const setColor = (color: HexColor) => {
    if (!isHexColor(color)) return
    setUiBaseColorStore("color", color)
  }

  const reset = () => {
    setUiBaseColorStore("color", null)
  }

  return {
    color: () => uiBaseColorStore.color,
    customized,
    setColor,
    reset,
  }
}
