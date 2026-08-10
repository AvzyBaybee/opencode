import { Component } from "solid-js"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { useLanguage } from "@/context/language"
import { AvaUiBaseColorPicker } from "../ava-ui-base-color-picker"
import { useAvaFileHeadersSetting } from "../ava-file-headers-setting"
import { useAvaSimplifySidePanelSetting } from "../ava-simplify-side-panel-setting"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

export const SettingsAvaV2: Component = () => {
  const language = useLanguage()
  const fileHeaders = useAvaFileHeadersSetting()
  const simplify = useAvaSimplifySidePanelSetting()

  return (
    <div class="settings-v2-section">
      <SettingsListV2>
        <SettingsRowV2
          title={language.t("settings.ava.row.uiBaseColor.title")}
          description={language.t("settings.ava.row.uiBaseColor.description")}
        >
          <div data-action="settings-ava-ui-base-color">
            <AvaUiBaseColorPicker />
          </div>
        </SettingsRowV2>
        <SettingsRowV2
          title={language.t("settings.ava.row.fileHeaders.title")}
          description={language.t("settings.ava.row.fileHeaders.description")}
        >
          <div data-action="settings-ava-file-headers">
            <Switch checked={fileHeaders.enabled()} onChange={(value) => void fileHeaders.setEnabled(value)} />
          </div>
        </SettingsRowV2>
        <SettingsRowV2
          title={language.t("settings.ava.row.simplifySidePanel.title")}
          description={language.t("settings.ava.row.simplifySidePanel.description")}
        >
          <div data-action="settings-ava-simplify-side-panel">
            <Switch checked={simplify.enabled()} onChange={(value) => simplify.setEnabled(value)} />
          </div>
        </SettingsRowV2>
      </SettingsListV2>
    </div>
  )
}
