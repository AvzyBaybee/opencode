import { AvaEmptyIcon } from "./ava-empty-icons"
import "./ava-empty-state.css"

export function AvaEmptyState(props: { kind: "agent" | "instruction" | "file"; label: string }) {
  return (
    <div class="ava-empty-state">
      <div class="ava-empty-state-icon">
        <AvaEmptyIcon kind={props.kind} />
      </div>
      <div class="ava-empty-state-label">{props.label}</div>
    </div>
  )
}
