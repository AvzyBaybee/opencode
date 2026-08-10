import { Component, Show } from "solid-js"
import type { HexColor } from "@opencode-ai/ui/theme"
import { useLanguage } from "@/context/language"
import { useAvaUiBaseColorSetting } from "./ava-ui-base-color-setting"

export const AvaUiBaseColorPicker: Component = () => {
  const language = useLanguage()
  const setting = useAvaUiBaseColorSetting()

  const onInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setting.setColor(event.currentTarget.value as HexColor)
  }

  return (
    <div class="flex items-center gap-2">
      <label class="relative size-9 shrink-0 overflow-hidden rounded-md border border-border-weak-base">
        <input
          type="color"
          class="absolute inset-0 size-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer border-0 bg-transparent p-0"
          value={setting.value()}
          onInput={onInput}
          aria-label={language.t("settings.ava.row.uiBaseColor.title")}
        />
      </label>
      <span class="min-w-0 font-mono text-12-regular text-text-weak">{setting.value()}</span>
      <Show when={setting.customized()}>
        <button
          type="button"
          class="text-12-medium text-text-weak transition-colors hover:text-text-base"
          onClick={() => setting.reset()}
        >
          {language.t("settings.ava.row.uiBaseColor.reset")}
        </button>
      </Show>
    </div>
  )
}
