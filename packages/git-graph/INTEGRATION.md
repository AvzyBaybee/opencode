# OpenCode integration checklist

This package is ready for a later, explicit integration phase. Do **not** perform these steps during standalone development.

## Host requirements

- Host supplies the current project/worktree directory
- Host provides snapshots / change notifications through a read-only API
- Feature never spawns Git from browser code
- Feature never owns OpenCode session, project, layout, or persistence state
- Mount `GitGraphPanel` with an explicit `GitGraphSource`

## Suggested integration order

1. Add a focused read-only graph endpoint near existing backend Git/VCS services
   - Likely around `packages/opencode/src/git/index.ts` and/or `packages/opencode/src/project/vcs.ts`
2. If the public Protocol/Server HttpApi changes, regenerate client types with the official generate scripts
   - Never edit `src/generated` by hand
3. Implement `createOpenCodeGitSource` against that API
4. Add one custom side-panel tab in
   `packages/app/src/components/ava-side-panel/ava-side-panel-tabs.ts`
5. Add one routing case in
   `packages/app/src/components/ava-side-panel/ava-side-panel-content.tsx`
6. Mount through the existing
   `packages/app/src/pages/session/session-side-panel.tsx` path
7. Add i18n keys under the app language dictionaries
8. Keep host edits small, local, and clearly named as the graph feature

## Expected host import

```ts
import { GitGraphPanel } from "@opencode-ai/git-graph"
import { createOpenCodeGitSource } from "@opencode-ai/git-graph/source"
```

## Files likely touched later

| File | Why |
|---|---|
| `packages/opencode/src/git/index.ts` or adjacent graph module | Read-only commit/ref graph API |
| Protocol / schema / generated client (via scripts) | Public API surface if exposed |
| `packages/app/src/components/ava-side-panel/ava-side-panel-tabs.ts` | Tab registration |
| `packages/app/src/components/ava-side-panel/ava-side-panel-content.tsx` | Tab content routing |
| `packages/app/package.json` | Depend on `@opencode-ai/git-graph` |
| App i18n dictionaries | Visible copy |

## Merge risk notes

- Prefer adding new files over editing hot session loops
- Side-panel files are custom-fork hotspots; keep the mount as one Match branch
- Avoid rewriting shared theme systems; reuse existing `--v2-*` tokens already mirrored in `src/compat/theme.ts`

## Standalone cleanup after integration

Once OpenCode hosts the panel:

- Keep `src/standalone/**` for local iteration, or delete it if no longer needed
- The embeddable surface is `src/host/git-graph-panel.tsx`
- OpenCode mounts it as the **Backup** side-panel tab via `packages/app/src/components/ava-side-panel/`
- The backend reuses `src/source/host-http.ts` at `/ava/git-graph/*`
