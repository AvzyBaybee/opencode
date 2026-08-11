import { Component, createEffect, onCleanup } from "solid-js"
import { hexToRgb, type HexColor } from "@opencode-ai/ui/theme"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { useAvaUiBaseColorStore } from "./ava-ui-base-color-store"
import { applyAvaUiSurfaces, removeAvaUiSurfaces } from "./ava-ui-surface-adjust"

function isUsableBaseColor(color: HexColor | null) {
  if (!color) return true
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return false

  const rgb = hexToRgb(color)
  const max = Math.max(rgb.r, rgb.g, rgb.b)
  return max >= 0.08
}

export const AvaUiThemeSync: Component = () => {
  const theme = useTheme()
  const store = useAvaUiBaseColorStore()

  createEffect(() => {
    const color = store.color()
    if (!isUsableBaseColor(color)) {
      store.reset()
      theme.setUiBaseColor(null)
      return
    }
    theme.setUiBaseColor(color)
  })

  createEffect(() => {
    theme.uiBaseColor()
    theme.mode()
    theme.themeId()
    const frame = store.frame()
    const panels = store.panels()
    const raised = store.raised()
    const wells = store.wells()
    const run = { cancelled: false }
    queueMicrotask(() => {
      if (run.cancelled) return
      applyAvaUiSurfaces({ frame, panels, raised, wells })
    })
    onCleanup(() => {
      run.cancelled = true
    })
  })

  onCleanup(removeAvaUiSurfaces)

  return null
}
