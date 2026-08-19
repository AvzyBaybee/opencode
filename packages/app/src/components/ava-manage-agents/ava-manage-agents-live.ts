import { createStore } from "solid-js/store"
import { AVA_INSTRUCTIONS_TAB, openAvaSidePanelTab } from "@/components/ava-side-panel/ava-side-panel-tabs"

const [live, setLive] = createStore({
  revision: 0,
  focusPath: undefined as string | undefined,
})

export function avaAgentsLive() {
  return live
}

export function bumpAvaAgentsLibrary() {
  setLive("revision", live.revision + 1)
}

export function openAvaInstruction(path: string) {
  setLive({
    focusPath: path,
    revision: live.revision + 1,
  })
  openAvaSidePanelTab(AVA_INSTRUCTIONS_TAB)
}

export function clearAvaInstructionFocus() {
  setLive("focusPath", undefined)
}
