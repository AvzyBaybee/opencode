# Git Graph Standalone

Isolated, integration-ready Git backup graph for OpenCode.

## Quick start

```powershell
cd packages/git-graph
bun install
bun dev
```

Open [http://127.0.0.1:5199](http://127.0.0.1:5199).

Paste a real repository folder path, for example:

```text
C:\Users\Ava\Documents\Scripts\Javascript\Custom OpenCode
```

Then press Enter / Open. The graph auto-refreshes when Git changes.

By default it shows **all local branches** (for this fork: `Custom` + `Official`) with the **full history**. Use the header dropdown to switch:

- **All local branches** — useful fork view without ~1200 `upstream/*` remotes
- **Current branch only** — one straight line
- **Local + remotes** — everything (can get wide/laggy)

Restart `bun dev` after changing the Git loader — the API process does not hot-reload. Env overrides still work if you want them:

```powershell
$env:GIT_GRAPH_SCOPE="all"          # current | local | all
$env:GIT_GRAPH_MAX_COMMITS="400"    # optional cap; omit for all backups
bun dev
```

## What this is

- Fast standalone SolidJS/Vite app
- Lightweight Bun Git API on port `5200`
- UI on port `5199`
- Does **not** start OpenCode desktop or backend
- Read-only navigable 2D commit DAG with rounded backup labels

## Scripts

| Command | Purpose |
|---|---|
| `bun dev` | Start API + Vite UI |
| `bun test` | Unit tests |
| `bun typecheck` | Typecheck package |

## Package boundary

All implementation lives under `packages/git-graph/**`.

Future OpenCode integration is documented in [`INTEGRATION.md`](./INTEGRATION.md).
