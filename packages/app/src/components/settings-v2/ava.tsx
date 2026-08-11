import { Component } from "solid-js"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { useLanguage } from "@/context/language"
import { AvaUiBaseColorPicker } from "../ava-ui-base-color-picker"
import { AvaUiHsbSliders } from "../ava-ui-hsb-sliders"
import { useAvaUiBaseColorStore } from "../ava-ui-base-color-store"
import { useAvaFileHeadersSetting } from "../ava-file-headers-setting"
import { useAvaSimplifySidePanelSetting } from "../ava-simplify-side-panel-setting"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

export const SettingsAvaV2: Component = () => {
  const language = useLanguage()
  const surfaces = useAvaUiBaseColorStore()
  const fileHeaders = useAvaFileHeadersSetting()
  const simplify = useAvaSimplifySidePanelSetting()
  const hueLabel = language.t("settings.ava.row.hsb.hue")
  const saturationLabel = language.t("settings.ava.row.hsb.saturation")
  const brightnessLabel = language.t("settings.ava.row.hsb.brightness")
  const resetLabel = language.t("settings.ava.row.uiBaseColor.reset")

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
          title={language.t("settings.ava.row.layer.frame.title")}
          description={language.t("settings.ava.row.layer.frame.description")}
        >
          <AvaUiHsbSliders
            value={surfaces.frame()}
            hueLabel={hueLabel}
            saturationLabel={saturationLabel}
            brightnessLabel={brightnessLabel}
            resetLabel={resetLabel}
            onChange={surfaces.setFrame}
            onReset={surfaces.resetFrame}
          />
        </SettingsRowV2>
        <SettingsRowV2
          title={language.t("settings.ava.row.layer.panels.title")}
          description={language.t("settings.ava.row.layer.panels.description")}
        >
          <AvaUiHsbSliders
            value={surfaces.panels()}
            hueLabel={hueLabel}
            saturationLabel={saturationLabel}
            brightnessLabel={brightnessLabel}
            resetLabel={resetLabel}
            onChange={surfaces.setPanels}
            onReset={surfaces.resetPanels}
          />
        </SettingsRowV2>
        <SettingsRowV2
          title={language.t("settings.ava.row.layer.raised.title")}
          description={language.t("settings.ava.row.layer.raised.description")}
        >
          <AvaUiHsbSliders
            value={surfaces.raised()}
            hueLabel={hueLabel}
            saturationLabel={saturationLabel}
            brightnessLabel={brightnessLabel}
            resetLabel={resetLabel}
            onChange={surfaces.setRaised}
            onReset={surfaces.resetRaised}
          />
        </SettingsRowV2>
        <SettingsRowV2
          title={language.t("settings.ava.row.layer.wells.title")}
          description={language.t("settings.ava.row.layer.wells.description")}
        >
          <AvaUiHsbSliders
            value={surfaces.wells()}
            hueLabel={hueLabel}
            saturationLabel={saturationLabel}
            brightnessLabel={brightnessLabel}
            resetLabel={resetLabel}
            onChange={surfaces.setWells}
            onReset={surfaces.resetWells}
          />
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
