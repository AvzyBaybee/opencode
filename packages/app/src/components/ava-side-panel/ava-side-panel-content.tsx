import { Match, Show, Switch } from "solid-js"
import type { ReviewPanelV2State } from "@/pages/session/v2/review-panel-v2-state"
import { AvaBrowseFolderPanel } from "./ava-browse-folder-panel"
import { AvaSimplifySidePanel } from "./ava-simplify-side-panel"
import { AVA_PROJECT_FOLDER_TAB, directoryFromBrowseTab } from "./ava-side-panel-tabs"

export function AvaSidePanelContent(props: { tab: string; state: ReviewPanelV2State }) {
  return (
    <Switch>
      <Match when={props.tab === AVA_PROJECT_FOLDER_TAB}>
        <AvaSimplifySidePanel state={props.state} />
      </Match>
      <Match when={directoryFromBrowseTab(props.tab)}>
        {(directory) => <AvaBrowseFolderPanel directory={directory()} state={props.state} />}
      </Match>
      <Match when={true}>
        <Show when={true}>
          <AvaSimplifySidePanel state={props.state} />
        </Show>
      </Match>
    </Switch>
  )
}
