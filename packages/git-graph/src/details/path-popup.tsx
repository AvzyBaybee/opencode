import { For } from "solid-js"
import type { EdgeKind, LaidOutCommit, LaidOutEdge } from "../layout"
import { wrapText } from "../layout"
import type { GitGraphCopy } from "../i18n/en"

export function PathPopup(props: {
  edge: LaidOutEdge
  child: LaidOutCommit
  parent: LaidOutCommit
  copy: GitGraphCopy
  x: number
  y: number
  width: number
  height: number
  hoveringID?: string
  onHover: (id?: string) => void
  onJump: (id: string) => void
}) {
  const nearRight = props.x > props.width - 260
  const nearBottom = props.y > props.height - 280
  const left = spatialFirst(props.child, props.parent)
  const right = left === props.child ? props.parent : props.child
  return (
    <div
      class="git-graph-path-pop absolute z-10"
      style={{
        left: nearRight ? "auto" : `${props.x + 8}px`,
        right: nearRight ? `${Math.max(8, props.width - props.x + 8)}px` : "auto",
        top: nearBottom ? "auto" : `${props.y + 8}px`,
        bottom: nearBottom ? `${Math.max(8, props.height - props.y + 8)}px` : "auto",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div class="mb-2 text-center text-[11px] font-medium" style={{ color: "var(--git-graph-text-weak)" }}>
        {pathTitle(props.copy, props.edge.kind)}
      </div>
      <BackupBubble
        commit={left}
        active={props.hoveringID === left.id}
        onHover={props.onHover}
        onJump={props.onJump}
      />
      <div class="my-1.5 text-center text-[11px]" style={{ color: "var(--git-graph-text-weak)" }}>
        {pathLink(props.copy, props.edge.kind)}
      </div>
      <BackupBubble
        commit={right}
        active={props.hoveringID === right.id}
        onHover={props.onHover}
        onJump={props.onJump}
      />
    </div>
  )
}

function BackupBubble(props: {
  commit: LaidOutCommit
  active: boolean
  onHover: (id?: string) => void
  onJump: (id: string) => void
}) {
  const lines = wrapText(props.commit.label, 176, 12)
  return (
    <button
      type="button"
      class="git-graph-backup-bubble"
      data-active={props.active ? "true" : undefined}
      onPointerEnter={() => props.onHover(props.commit.id)}
      onPointerLeave={() => props.onHover()}
      onClick={() => props.onJump(props.commit.id)}
    >
      <For each={lines}>{(line) => <div>{line}</div>}</For>
    </button>
  )
}

function spatialFirst(a: LaidOutCommit, b: LaidOutCommit) {
  if (Math.abs(a.x - b.x) > 4) return a.x <= b.x ? a : b
  return a.y <= b.y ? a : b
}

function pathTitle(copy: GitGraphCopy, kind: EdgeKind) {
  if (kind === "merge") return copy.pathMerge
  if (kind === "fork") return copy.pathFork
  return copy.pathSameThread
}

function pathLink(copy: GitGraphCopy, kind: EdgeKind) {
  if (kind === "merge") return copy.pathJoined
  if (kind === "fork") return copy.pathBranchedOff
  return copy.pathGrewFrom
}
