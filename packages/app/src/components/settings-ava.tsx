import { Component } from "solid-js"
import { Switch } from "@opencode-ai/ui/switch"
import { useLanguage } from "@/context/language"
import { AvaUiBaseColorPicker } from "./ava-ui-base-color-picker"
import { useAvaFileHeadersSetting } from "./ava-file-headers-setting"
import { SettingsList } from "./settings-list"

export const SettingsAva: Component = () => {
  const language = useLanguage()
  const setting = useAvaFileHeadersSetting()

  return (
    <div class="flex flex-col gap-1">
      <SettingsList>
        <div class="flex flex-wrap items-center gap-4 py-3">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-14-medium text-text-strong">{language.t("settings.ava.row.uiBaseColor.title")}</span>
            <span class="text-12-regular text-text-weak">
              {language.t("settings.ava.row.uiBaseColor.description")}
            </span>
          </div>
          <div class="flex w-full justify-end sm:w-auto sm:shrink-0" data-action="settings-ava-ui-base-color">
            <AvaUiBaseColorPicker />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4 py-3">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-14-medium text-text-strong">{language.t("settings.ava.row.fileHeaders.title")}</span>
            <span class="text-12-regular text-text-weak">
              {language.t("settings.ava.row.fileHeaders.description")}
            </span>
          </div>
          <div class="flex w-full justify-end sm:w-auto sm:shrink-0" data-action="settings-ava-file-headers">
            <Switch checked={setting.enabled()} onChange={(value) => void setting.setEnabled(value)} />
          </div>
        </div>
      </SettingsList>
    </div>
  )
}
