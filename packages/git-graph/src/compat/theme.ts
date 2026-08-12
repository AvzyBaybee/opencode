/** OpenCode-compatible theme tokens with standalone fallbacks. */
export const themeCss = `
:root, [data-color-scheme="dark"] {
  color-scheme: dark;
  --git-graph-bg: var(--v2-background-bg-base, #141414);
  --git-graph-panel: var(--v2-background-bg-strong, #1e1e1e);
  --git-graph-text: var(--v2-text-text-base, #e8e8e8);
  --git-graph-text-weak: var(--v2-text-text-weak, #9a9a9a);
  --git-graph-border: var(--v2-border-border-weak, #2f2f2f);
  --git-graph-accent: var(--text-interactive-base, #6b8cff);
  --git-graph-edge: #4f7cff;
  --git-graph-node: #4f7cff;
  --git-graph-pill: var(--surface-raised-base, #2a2a2a);
  --git-graph-radius: 10px;
  --git-graph-font: Inter, ui-sans-serif, system-ui, sans-serif;
  --git-graph-mono: "JetBrains Mono", ui-monospace, monospace;
}

[data-color-scheme="light"] {
  color-scheme: light;
  --git-graph-bg: var(--v2-background-bg-base, #f5f5f5);
  --git-graph-panel: var(--v2-background-bg-strong, #ffffff);
  --git-graph-text: var(--v2-text-text-base, #1a1a1a);
  --git-graph-text-weak: var(--v2-text-text-weak, #6b6b6b);
  --git-graph-border: var(--v2-border-border-weak, #e4e4e4);
  --git-graph-accent: var(--text-interactive-base, #3b5bdb);
  --git-graph-edge: #3b5bdb;
  --git-graph-node: #3b5bdb;
  --git-graph-pill: var(--surface-raised-base, #ececec);
}

.git-graph-root {
  font-family: var(--git-graph-font);
  color: var(--git-graph-text);
  background: var(--git-graph-bg);
}

.git-graph-button {
  height: 28px;
  padding: 0 10px;
  border-radius: var(--git-graph-radius);
  border: 1px solid var(--git-graph-border);
  background: var(--git-graph-pill);
  color: var(--git-graph-text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.git-graph-button:hover {
  filter: brightness(1.08);
}

.git-graph-button:focus-visible {
  outline: 2px solid var(--git-graph-accent);
  outline-offset: 1px;
}

.git-graph-tooltip {
  max-width: min(360px, 70vw);
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--git-graph-border);
  background: var(--git-graph-panel);
  color: var(--git-graph-text);
  font-size: 12px;
  line-height: 1.3;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}

.git-graph-panel-shell {
  width: min(420px, 100%);
  height: min(720px, 100%);
  border-radius: 12px;
  border: 1px solid var(--git-graph-border);
  background: var(--git-graph-panel);
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
`

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
      focus: "#3b5bdb",
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
    focus: "#6b8cff",
  }
}
