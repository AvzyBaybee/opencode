import { Match, Switch } from "solid-js"
import type { ReviewPanelV2State } from "@/pages/session/v2/review-panel-v2-state"
import { AvaBrowseFolderPanel } from "./ava-browse-folder-panel"
import { AvaSimplifySidePanel } from "./ava-simplify-side-panel"
import { AVA_PROJECT_FOLDER_TAB, directoryFromBrowseTab, type AvaSidePanelTabs } from "./ava-side-panel-tabs"

export function AvaSidePanelContent(props: {
  tab: string
  state: ReviewPanelV2State
  tabs: AvaSidePanelTabs
  onOpenFolder: () => void
  canOpenFolder: boolean
}) {
  return (
    <Switch>
      <Match when={props.tab === AVA_PROJECT_FOLDER_TAB}>
        <AvaSimplifySidePanel
          state={props.state}
          tabs={props.tabs}
          onOpenFolder={props.onOpenFolder}
          canOpenFolder={props.canOpenFolder}
        />
      </Match>
      <Match when={directoryFromBrowseTab(props.tab)}>
        {(directory) => (
          <AvaBrowseFolderPanel
            directory={directory()}
            state={props.state}
            tabs={props.tabs}
            onOpenFolder={props.onOpenFolder}
            canOpenFolder={props.canOpenFolder}
          />
        )}
      </Match>
      <Match when={true}>
        <AvaSimplifySidePanel
          state={props.state}
          tabs={props.tabs}
          onOpenFolder={props.onOpenFolder}
          canOpenFolder={props.canOpenFolder}
        />
      </Match>
    </Switch>
  )
}
