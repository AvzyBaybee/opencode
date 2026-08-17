import { For } from "solid-js"
import { useLanguage } from "@/context/language"
import {
  AVA_AGENTS_TAB,
  AVA_BACKUP_TAB,
  AVA_CONTEXT_TAB,
  AVA_INSTRUCTIONS_TAB,
  AVA_PROJECT_FOLDER_TAB,
  isAvaFilesTab,
  type AvaSidePanelTabs,
} from "./ava-side-panel-tabs"

const NAV = [
  { id: AVA_CONTEXT_TAB, key: "ava.sidePanel.context" as const, files: false },
  { id: AVA_PROJECT_FOLDER_TAB, key: "ava.sidePanel.files" as const, files: true },
  { id: AVA_BACKUP_TAB, key: "ava.sidePanel.backup" as const, files: false },
  { id: AVA_AGENTS_TAB, key: "ava.sidePanel.agents" as const, files: false },
  { id: AVA_INSTRUCTIONS_TAB, key: "ava.sidePanel.instructions" as const, files: false },
]

export function AvaSidePanelNav(props: { tabs: AvaSidePanelTabs }) {
  const language = useLanguage()
  const active = () => props.tabs.active()

  return (
    <div class="ava-side-panel-nav" role="tablist" aria-label={language.t("ava.sidePanel.tabs")}>
      <For each={NAV}>
        {(item) => {
          const selected = () => (item.files ? isAvaFilesTab(active()) : active() === item.id)
          return (
            <button
              type="button"
              role="tab"
              class="ava-side-panel-nav-tab"
              aria-selected={selected()}
              data-active={selected() ? "" : undefined}
              onClick={() => {
                if (item.files) {
                  if (isAvaFilesTab(active())) return
                  props.tabs.showFiles()
                  return
                }
                props.tabs.setActive(item.id)
              }}
            >
              {language.t(item.key)}
            </button>
          )
        }}
      </For>
    </div>
  )
}
