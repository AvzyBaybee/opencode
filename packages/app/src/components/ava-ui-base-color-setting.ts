import { createEffect, createMemo } from "solid-js"
import type { HexColor } from "@opencode-ai/ui/theme"
import { getThemeReferenceBase } from "@opencode-ai/ui/theme"
import { useTheme } from "@opencode-ai/ui/theme/context"
import { useAvaUiBaseColorStore } from "./ava-ui-base-color-store"

export function useAvaUiBaseColorSetting() {
  const theme = useTheme()
  const store = useAvaUiBaseColorStore()

  const reference = createMemo(() => {
    const current = theme.themes()[theme.themeId()]
    if (!current) return "#f7f7f7" as HexColor
    return getThemeReferenceBase(current, theme.mode() === "dark")
  })

  const value = createMemo(() => store.color() ?? reference())

  return {
    value,
    reference,
    customized: store.customized,
    setColor: store.setColor,
    reset: store.reset,
  }
}
