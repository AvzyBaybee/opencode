import { createMemo } from "solid-js"
import { createStore, type SetStoreFunction, type Store } from "solid-js/store"
import type { HexColor } from "@opencode-ai/ui/theme"
import { Persist, persisted } from "@/utils/persist"
import {
  AVA_HSB_ZERO,
  clampHsbOffset,
  type AvaHsbOffset,
} from "./ava-ui-surface-adjust"

type UiBaseColorState = {
  color: HexColor | null
  frame: AvaHsbOffset
  panels: AvaHsbOffset
  raised: AvaHsbOffset
  wells: AvaHsbOffset
}

let uiBaseColorStore: Store<UiBaseColorState>
let setUiBaseColorStore: SetStoreFunction<UiBaseColorState>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function offsetFrom(value: unknown, brightness = 0): AvaHsbOffset {
  if (!isRecord(value)) return clampHsbOffset({ h: 0, s: 0, b: brightness })
  return clampHsbOffset({
    h: typeof value.h === "number" ? value.h : 0,
    s: typeof value.s === "number" ? value.s : 0,
    b: typeof value.b === "number" ? value.b : brightness,
  })
}

function migrate(value: unknown) {
  if (!isRecord(value)) return value
  const chrome = typeof value.chromeBrightness === "number" ? value.chromeBrightness : 0
  const well = typeof value.codeWellBrightness === "number" ? value.codeWellBrightness : 0
  return {
    color: value.color,
    frame: offsetFrom(value.frame, chrome),
    panels: offsetFrom(value.panels, chrome),
    raised: offsetFrom(value.raised),
    wells: offsetFrom(value.wells, well),
  }
}

function ensureStore() {
  if (uiBaseColorStore) return
  ;[uiBaseColorStore, setUiBaseColorStore] = persisted(
    { ...Persist.global("ava.ui-base-color"), migrate },
    createStore<UiBaseColorState>({
      color: null,
      frame: { h: 0, s: 0, b: 0 },
      panels: { h: 0, s: 0, b: 0 },
      raised: { h: 0, s: 0, b: 0 },
      wells: { h: 0, s: 0, b: 0 },
    }),
  )
}

function isHexColor(value: string): value is HexColor {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function readOffset(value: AvaHsbOffset | undefined) {
  return clampHsbOffset(value ?? AVA_HSB_ZERO)
}

export function useAvaUiBaseColorStore() {
  ensureStore()

  const customized = createMemo(() => uiBaseColorStore.color !== null)

  const setColor = (color: HexColor) => {
    if (!isHexColor(color)) return
    setUiBaseColorStore("color", color)
  }

  const setFrame = (value: AvaHsbOffset) => setUiBaseColorStore("frame", clampHsbOffset(value))
  const setPanels = (value: AvaHsbOffset) => setUiBaseColorStore("panels", clampHsbOffset(value))
  const setRaised = (value: AvaHsbOffset) => setUiBaseColorStore("raised", clampHsbOffset(value))
  const setWells = (value: AvaHsbOffset) => setUiBaseColorStore("wells", clampHsbOffset(value))

  return {
    color: () => uiBaseColorStore.color,
    frame: () => readOffset(uiBaseColorStore.frame),
    panels: () => readOffset(uiBaseColorStore.panels),
    raised: () => readOffset(uiBaseColorStore.raised),
    wells: () => readOffset(uiBaseColorStore.wells),
    customized,
    setColor,
    setFrame,
    setPanels,
    setRaised,
    setWells,
    reset: () => setUiBaseColorStore("color", null),
    resetFrame: () => setFrame(AVA_HSB_ZERO),
    resetPanels: () => setPanels(AVA_HSB_ZERO),
    resetRaised: () => setRaised(AVA_HSB_ZERO),
    resetWells: () => setWells(AVA_HSB_ZERO),
  }
}
