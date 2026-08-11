import { Component, type JSX } from "solid-js"
import { Switch } from "@opencode-ai/ui/switch"
import { useLanguage } from "@/context/language"
import { AvaUiBaseColorPicker } from "./ava-ui-base-color-picker"
import { AvaUiHsbSliders } from "./ava-ui-hsb-sliders"
import { useAvaUiBaseColorStore } from "./ava-ui-base-color-store"
import { useAvaFileHeadersSetting } from "./ava-file-headers-setting"
import { useAvaSimplifySidePanelSetting } from "./ava-simplify-side-panel-setting"
import { SettingsList } from "./settings-list"

export const SettingsAva: Component = () => {
  const language = useLanguage()
  const surfaces = useAvaUiBaseColorStore()
  const fileHeaders = useAvaFileHeadersSetting()
  const simplify = useAvaSimplifySidePanelSetting()
  const hueLabel = language.t("settings.ava.row.hsb.hue")
  const saturationLabel = language.t("settings.ava.row.hsb.saturation")
  const brightnessLabel = language.t("settings.ava.row.hsb.brightness")
  const resetLabel = language.t("settings.ava.row.uiBaseColor.reset")

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
        <LayerRow
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
        </LayerRow>
        <LayerRow
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
        </LayerRow>
        <LayerRow
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
        </LayerRow>
        <LayerRow
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
        </LayerRow>
        <div class="flex flex-wrap items-center gap-4 py-3">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-14-medium text-text-strong">{language.t("settings.ava.row.fileHeaders.title")}</span>
            <span class="text-12-regular text-text-weak">
              {language.t("settings.ava.row.fileHeaders.description")}
            </span>
          </div>
          <div class="flex w-full justify-end sm:w-auto sm:shrink-0" data-action="settings-ava-file-headers">
            <Switch checked={fileHeaders.enabled()} onChange={(value) => void fileHeaders.setEnabled(value)} />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4 py-3">
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-14-medium text-text-strong">
              {language.t("settings.ava.row.simplifySidePanel.title")}
            </span>
            <span class="text-12-regular text-text-weak">
              {language.t("settings.ava.row.simplifySidePanel.description")}
            </span>
          </div>
          <div class="flex w-full justify-end sm:w-auto sm:shrink-0" data-action="settings-ava-simplify-side-panel">
            <Switch checked={simplify.enabled()} onChange={(value) => simplify.setEnabled(value)} />
          </div>
        </div>
      </SettingsList>
    </div>
  )
}

function LayerRow(props: { title: string; description: string; children: JSX.Element }) {
  return (
    <div class="flex flex-wrap items-center gap-4 py-3">
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-14-medium text-text-strong">{props.title}</span>
        <span class="text-12-regular text-text-weak">{props.description}</span>
      </div>
      <div class="flex w-full justify-end sm:w-auto sm:shrink-0">{props.children}</div>
    </div>
  )
}
