export type CanvasColors = {
  background: string
  edge: string
  node: string
  nodeSelected: string
  nodeHead: string
  label: string
  labelMuted: string
  pillFill: string
  pillText: string
  pillLocal: string
  pillRemote: string
  pillTag: string
  focus: string
  cardFill: string
  cardBorder: string
  font: string
}

const light: CanvasColors = {
  background: "#f5f5f5",
  edge: "#3b5bdb",
  node: "#3b5bdb",
  nodeSelected: "#5c7cfa",
  nodeHead: "#3b5bdb",
  label: "#1a1a1a",
  labelMuted: "#6b6b6b",
  pillFill: "#ececec",
  pillText: "#333333",
  pillLocal: "#3b5bdb",
  pillRemote: "#6b6b6b",
  pillTag: "#b0892e",
  focus: "#3b5bdb",
  cardFill: "rgba(255,255,255,0.96)",
  cardBorder: "#e4e4e4",
  font: "Inter, ui-sans-serif, system-ui, sans-serif",
}

const dark: CanvasColors = {
  background: "#141414",
  edge: "#4f7cff",
  node: "#4f7cff",
  nodeSelected: "#8eb0ff",
  nodeHead: "#4f7cff",
  label: "#e8e8e8",
  labelMuted: "#9a9a9a",
  pillFill: "#2a2a2a",
  pillText: "#d2d2d2",
  pillLocal: "#6b8cff",
  pillRemote: "#9a9a9a",
  pillTag: "#c4a35a",
  focus: "#6b8cff",
  cardFill: "#2c2c2c",
  cardBorder: "#5a5a5a",
  font: "Inter, ui-sans-serif, system-ui, sans-serif",
}

export function canvasColors(scheme: "light" | "dark", host?: HTMLElement): CanvasColors {
  const fallback = scheme === "light" ? light : dark
  if (!host) return fallback
  const style = getComputedStyle(host)
  const read = (name: string, next: string) => style.getPropertyValue(name).trim() || next
  return {
    background: read("--git-graph-bg", fallback.background),
    edge: read("--git-graph-edge", fallback.edge),
    node: read("--git-graph-node", fallback.node),
    nodeSelected: read("--git-graph-node-selected", fallback.nodeSelected),
    nodeHead: read("--git-graph-node", fallback.nodeHead),
    label: read("--git-graph-text", fallback.label),
    labelMuted: read("--git-graph-text-weak", fallback.labelMuted),
    pillFill: read("--git-graph-pill", fallback.pillFill),
    pillText: read("--git-graph-pill-text", fallback.pillText),
    pillLocal: read("--git-graph-accent", fallback.pillLocal),
    pillRemote: read("--git-graph-text-weak", fallback.pillRemote),
    pillTag: read("--git-graph-tag", fallback.pillTag),
    focus: read("--git-graph-accent", fallback.focus),
    cardFill: read("--git-graph-card", fallback.cardFill),
    cardBorder: read("--git-graph-card-border", fallback.cardBorder),
    font: style.fontFamily.trim() || fallback.font,
  }
}
