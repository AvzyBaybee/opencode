import { Component } from "solid-js"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { useLanguage } from "@/context/language"
import { useAvaFileHeadersSetting } from "../ava-file-headers-setting"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

export const SettingsAvaV2: Component = () => {
  const language = useLanguage()
  const setting = useAvaFileHeadersSetting()

  return (
    <div class="settings-v2-section">
      <SettingsListV2>
        <SettingsRowV2
          title={language.t("settings.ava.row.fileHeaders.title")}
          description={language.t("settings.ava.row.fileHeaders.description")}
        >
          <div data-action="settings-ava-file-headers">
            <Switch checked={setting.enabled()} onChange={(value) => void setting.setEnabled(value)} />
          </div>
        </SettingsRowV2>
      </SettingsListV2>
    </div>
  )
}
