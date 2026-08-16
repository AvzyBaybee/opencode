export function canvasColors(scheme: "light" | "dark") {
  if (scheme === "light") {
    return {
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
    }
  }
  return {
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
  }
}
