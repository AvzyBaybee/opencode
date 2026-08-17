import { For, Show, Suspense, lazy, type JSX } from "solid-js"
import { AvaManageAgentsPage } from "@/components/ava-manage-agents/ava-manage-agents-page"
import { SessionContextTab } from "@/components/session"
import type { ReviewPanelV2State } from "@/pages/session/v2/review-panel-v2-state"
import { AvaBrowseFolderPanel } from "./ava-browse-folder-panel"
import { AvaSidePanelNav } from "./ava-side-panel-nav"
import { AvaSimplifySidePanel } from "./ava-simplify-side-panel"
import {
  AVA_AGENTS_TAB,
  AVA_BACKUP_TAB,
  AVA_CONTEXT_TAB,
  AVA_INSTRUCTIONS_TAB,
  AVA_PROJECT_FOLDER_TAB,
  browseFolderTab,
  type AvaSidePanelTabs,
} from "./ava-side-panel-tabs"

const AvaGitGraphPanel = lazy(() => import("./ava-git-graph-panel"))

export function AvaSidePanelContent(props: {
  tab: string
  state: ReviewPanelV2State
  tabs: AvaSidePanelTabs
  onOpenFolder: () => void
  canOpenFolder: boolean
}) {
  return (
    <div class="size-full min-h-0 flex flex-col ava-side-panel">
      <AvaSidePanelNav tabs={props.tabs} />
      <div class="relative min-h-0 min-w-0 flex-1">
        <AvaSidePanelPane active={props.tab === AVA_CONTEXT_TAB} class="ava-side-panel-pane">
          <SessionContextTab />
        </AvaSidePanelPane>
        <AvaSidePanelPane active={props.tab === AVA_AGENTS_TAB}>
          <AvaManageAgentsPage pane="agents" sidebarWidth={props.state.sidebarWidth} />
        </AvaSidePanelPane>
        <AvaSidePanelPane active={props.tab === AVA_INSTRUCTIONS_TAB}>
          <AvaManageAgentsPage pane="instructions" sidebarWidth={props.state.sidebarWidth} />
        </AvaSidePanelPane>
        <AvaSidePanelPane active={props.tab === AVA_BACKUP_TAB}>
          <Show when={props.tab === AVA_BACKUP_TAB}>
            <Suspense>
              <AvaGitGraphPanel />
            </Suspense>
          </Show>
        </AvaSidePanelPane>
        <AvaSidePanelPane active={props.tab === AVA_PROJECT_FOLDER_TAB}>
          <AvaSimplifySidePanel
            state={props.state}
            tabs={props.tabs}
            onOpenFolder={props.onOpenFolder}
            canOpenFolder={props.canOpenFolder}
          />
        </AvaSidePanelPane>
        <For each={props.tabs.browseDirectories()}>
          {(directory) => (
            <AvaSidePanelPane active={props.tab === browseFolderTab(directory)}>
              <AvaBrowseFolderPanel
                directory={directory}
                state={props.state}
                tabs={props.tabs}
                onOpenFolder={props.onOpenFolder}
                canOpenFolder={props.canOpenFolder}
              />
            </AvaSidePanelPane>
          )}
        </For>
      </div>
    </div>
  )
}

function AvaSidePanelPane(props: { active: boolean; class?: string; children: JSX.Element }) {
  return (
    <div
      class={`absolute inset-0 min-h-0 min-w-0 overflow-hidden ${props.class ?? ""}`}
      classList={{
        hidden: !props.active,
        "pointer-events-none": !props.active,
      }}
      inert={!props.active || undefined}
      aria-hidden={!props.active}
    >
      {props.children}
    </div>
  )
}
