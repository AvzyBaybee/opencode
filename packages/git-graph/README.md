# Git Graph Standalone

Isolated, integration-ready Git backup graph for OpenCode.

## Quick start

```powershell
cd packages/git-graph
bun install
bun dev
```

Open [http://127.0.0.1:5199](http://127.0.0.1:5199).

Optional repo hint:

```powershell
$env:GIT_GRAPH_REPO="C:\path\to\repo"
bun dev
# or
bun dev -- C:\path\to\repo
```

Then open `http://127.0.0.1:5199/?repo=C:%5Cpath%5Cto%5Crepo`.

Use **Open sample repository** for the built-in `fixture:branched` graph without a real repo.

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
