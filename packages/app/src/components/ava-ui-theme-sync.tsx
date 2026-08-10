import { Component, createEffect } from "solid-js"
import type { HexColor } from "@opencode-ai/ui/theme"
import { hexToRgb } from "@opencode-ai/ui/theme"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { useAvaUiBaseColorStore } from "./ava-ui-base-color-store"

function isUsableBaseColor(color: HexColor | null) {
  if (!color) return true
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return false

  const { r, g, b } = hexToRgb(color)
  const max = Math.max(r, g, b)
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

  return null
}
