---
name: Git Graph Standalone
overview: Build a standalone, integration-ready SolidJS Git history visualizer that uses OpenCode-compatible contracts and visual conventions, then add only a thin adapter when it is ready for the OpenCode side panel.
todos:
  - id: standalone-boundaries
    content: Define the standalone project boundaries and version-pinned SolidJS/Vite/Bun toolchain.
    status: in_progress
  - id: git-graph-contract
    content: Implement and test the GitGraphSnapshot contract and LocalGitSource against real fixture repositories.
    status: pending
  - id: graph-renderer
    content: Build deterministic DAG layout, virtualized Canvas/SVG rendering, and interaction behavior.
    status: pending
  - id: opencode-compatible-shell
    content: Build the OpenCode-compatible side-panel shell, theme bridge, i18n surface, and performance fixtures.
    status: pending
  - id: integration-checklist
    content: Document the host adapter and produce the minimal OpenCode integration checklist before moving code into the master application.
    status: pending
isProject: false
---

# Build an Integration-Ready Git Graph Standalone App

## Goal
Create an isolated workspace package inside this repository at `packages/git-graph/`. It must run as a fast standalone application without starting the full OpenCode desktop or backend, while making its eventual incorporation into the master OpenCode application a small, explicit change set. The app should be a read-only, live-updating visualizer of a local Git commit DAG, designed to mount inside the existing OpenCode side-panel experience.

The standalone runtime is a development-speed strategy, not a separate product direction. The master OpenCode application remains the canonical reference for visual style, interaction conventions, accessibility, localization, and host behavior. Build the feature so iteration is lightweight now and the finished component can be mounted later without reimplementing its graph engine or visual design.

## Repository facts to respect
- OpenCode’s UI is SolidJS/Vite/Bun in [`packages/app/package.json`](packages/app/package.json).
- Shared components, theme tokens, icons, and styles are exported by [`packages/ui/package.json`](packages/ui/package.json).
- The current custom side-panel content is routed through [`packages/app/src/components/ava-side-panel/ava-side-panel-content.tsx`](packages/app/src/components/ava-side-panel/ava-side-panel-content.tsx).
- Side-panel tabs and persistence are owned by [`packages/app/src/components/ava-side-panel/ava-side-panel-tabs.ts`](packages/app/src/components/ava-side-panel/ava-side-panel-tabs.ts).
- The panel is mounted by [`packages/app/src/pages/session/session-side-panel.tsx`](packages/app/src/pages/session/session-side-panel.tsx).
- OpenCode already has a backend Git service in [`packages/opencode/src/git/index.ts`](packages/opencode/src/git/index.ts), but it currently focuses on status, diffs, branches, and patches—not a complete commit-graph contract. The future integration should add a focused read-only graph API rather than making browser code execute Git directly.

## Standalone project shape
Create `packages/git-graph/`, which is already covered by the repository’s `packages/*` Bun workspace glob. Keep all feature implementation inside this directory until integration is explicitly approved. The package may use existing workspace dependencies and shared public UI exports, but it must remain independent of OpenCode’s private `@/` imports and must not modify `packages/app` during standalone development.

Use:
- TypeScript
- SolidJS
- Vite
- Bun
- Tailwind CSS or equivalent CSS using OpenCode-compatible theme variables
- No dependency on OpenCode’s server internals

Organize the code around removable feature boundaries:

```text
packages/git-graph/
  package.json
  PLAN.md
  README.md
  ARCHITECTURE.md
  CONTRACT.md
  INTEGRATION.md
src/
  domain/       Git graph types, normalization, invariants
  source/       GitGraphSource contract and local Git adapter
  layout/       deterministic DAG lane and coordinate calculation
  render/       Canvas/SVG graph renderer and visible-node projection
  interaction/  pan, zoom, search, selection, keyboard navigation
  details/      selected commit/ref details
  host/         standalone host shell and future OpenCode adapter boundary
  i18n/         visible UI translations
  compat/       OpenCode-compatible theme tokens and UI bridge
```

Keep the domain and source layers framework-independent wherever practical. The SolidJS component should consume snapshots and user actions through explicit props/callbacks, so the eventual host can replace the standalone shell without rewriting the graph engine.

## Master application reference policy
Use the master application as the primary reference throughout development:

- Inspect existing OpenCode components, styles, theme tokens, typography, spacing, interaction patterns, accessibility conventions, and localization before inventing new behavior.
- Prefer shared public workspace packages such as `@opencode-ai/ui` and `@opencode-ai/session-ui` when they provide the needed visual primitives.
- Read and reference `packages/app` implementation details for fidelity, but do not import its private `@/` modules or session-specific runtime contexts into the standalone package.
- Keep any unavoidable compatibility mapping in `src/compat/`, with a clear replacement path for the final OpenCode integration.
- Do not create a parallel design system, alternate color palette, or standalone-only interaction language.

“Reference whatever is useful” means the master application is the visual and behavioral source of truth; it does not mean coupling the standalone runtime to private application internals. That boundary is what allows fast startup now and effortless replacement of the standalone host adapter later.

## Fast standalone runtime
The package must have its own development entrypoint so the feature can be restarted without booting OpenCode:

- `bun dev` starts only the Git graph Vite UI and its lightweight local Git bridge.
- The standalone shell accepts a repository path through a folder picker, command-line argument, or documented environment variable.
- The local bridge executes validated Git commands and watches the repository; browser code never spawns processes or receives arbitrary shell commands.
- UI hot reload should restart only the graph package.
- The standalone shell should provide a realistic narrow side-panel viewport, theme toggle, repository selector, and fixture-repository shortcuts.
- Keep standalone-only process and host code under `src/standalone/` so the eventual OpenCode component can be imported without bringing the local server along.

Do not add the package to the OpenCode desktop boot path. Do not require `bun dev:desktop`, the OpenCode backend, or the full application to develop, test, or preview the graph.

## Non-negotiable build scope
During standalone development:

- Allowed writes are limited to `packages/git-graph/**`.
- Do not modify `packages/app/**`, `packages/opencode/**`, `packages/desktop/**`, or any other existing package.
- Do not modify the root `package.json`, lockfile, Turbo configuration, Vite configuration, CI files, generated files, or desktop startup scripts.
- Do not start or restart the OpenCode desktop application, backend, or any existing development server.
- Do not add a dependency if the existing workspace dependencies are insufficient. Stop and request approval before changing a dependency or lockfile.
- Do not commit, push, merge, delete, or overwrite existing project work.
- Before any first write outside `packages/git-graph/**` would be needed, stop and explain the reason instead of proceeding.

The standalone package must be independently reversible by deleting its directory. The final integration is a separate, explicitly approved phase.

## Define the stable data contract first
Create a small public contract before building the UI. It should represent Git’s actual DAG rather than parsing the output of `git log --graph`:

```ts
type GitGraphSource = {
  getSnapshot(): Promise<GitGraphSnapshot>
  refresh(): Promise<GitGraphSnapshot>
  subscribe(listener: (snapshot: GitGraphSnapshot) => void): () => void
}
```

The snapshot should include:
- Immutable commit IDs
- Ordered parent IDs, including multiple parents for merges
- Author and committer metadata
- Commit timestamps and subjects
- Local branches, remote branches, tags, stash refs, and `HEAD`
- Detached-HEAD state
- Repository root, shallow/partial-clone metadata when available
- Explicit loading, stale, unsupported, and error states

Use machine-readable Git output with stable delimiters, explicit formatting, and locale-independent fields. Do not use shell-string interpolation, and do not make the UI depend on Git’s human-oriented output formatting.

Provide two source implementations behind the same contract:
- `LocalGitSource` for the standalone app, using a controlled process boundary and repository path.
- `OpenCodeGitSource` as an integration seam, initially documented and stubbed if the OpenCode API does not yet exist.

## MVP behavior
Implement read-only behavior first:
- Open a selected local repository.
- Represent each visible commit/snapshot as a named backup entry. Use the commit subject as the initial backup name; reserve an optional explicit backup-name field for a later backup system.
- Show branch identity as compact rounded labels attached to the relevant branch tip or lane, rather than repeating branch text on every reachable commit.
- Preserve merge relationships and shared history accurately even though the presentation should feel visually tree-like.
- Pan and zoom through the graph.
- Select a backup entry and expose only a lightweight tooltip or small overlay with its essential identity.
- Refresh manually and update automatically after repository changes.
- Show clear states for an empty repository, detached `HEAD`, shallow history, invalid repository, loading, and stale data.
- Do not implement checkout, reset, rebase, merge, cherry-pick, push, or other mutating Git operations in the first version.

## Minimal visual specification
The graph is the product surface; every other element must justify its space:

- Use a navigable 2D canvas with pointer-drag panning and wheel/pinch zooming.
- Use rounded rectangular backup labels with the same corner-radius language as OpenCode’s existing controls.
- Keep labels visually compact: backup name first, branch pill only where useful, and no author names, avatars, redundant metadata, or decorative cards in the default view.
- Use lane/edge color and position to communicate branch relationships; do not imply that Git history is a simple tree when merges create shared ancestors.
- Keep the background, typography, muted text hierarchy, accent colors, selection treatment, focus rings, and spacing aligned with OpenCode’s current theme tokens.
- Use truncation and a lightweight hover/focus tooltip for long backup names rather than permanently widening the graph.
- Do not add a permanent details sidebar, minimap, dashboard, command toolbar, filters, statistics, restore controls, or redundant legends in the MVP.
- Defer search, advanced history filters, backup actions, and richer metadata until the minimal navigation experience is stable.

Branch labels need an explicit overflow rule because one commit can be reachable from multiple branches. Prefer showing labels at branch tips or lane origins; if several refs share a point, stack a small number and expose the remainder through a compact overflow interaction.

## Rendering and performance design
Use a two-layer renderer:
- Canvas or WebGL for graph edges, lanes, commit nodes, and large-volume drawing.
- Lightweight DOM/SVG overlays only for selected nodes, accessible focus targets, labels, and menus.

Calculate parsing and layout away from the main interaction path, preferably in a worker. Keep layout deterministic: unchanged commit IDs should retain stable positions where possible, while new refs or commits update only the affected region.

Add generated performance fixtures covering:
- A linear history
- Many parallel branches
- Dense merge history
- At least 100,000 commits
- Large ref sets

Measure initial load, refresh, pan, zoom, search, and selection. Set explicit budgets for the project, including no visible interaction stutter and no full DOM node per commit.

## Visual compatibility
Make the standalone shell intentionally resemble OpenCode rather than inventing a separate design system:
- Match SolidJS component patterns and the project’s compact panel density.
- Use the same Inter and JetBrains Mono typography direction.
- Use CSS variables compatible with OpenCode’s `--v2-*` theme tokens, with standalone fallbacks.
- Support light/dark mode and reduced motion.
- Reuse equivalent button, tooltip, tab, input, resize, and scroll behavior.
- Keep visible strings behind an i18n interface from the beginning; do not hardcode production UI copy.
- Build a narrow side-panel viewport in the standalone shell with tabs, resizing, empty states, and selection details so the eventual mount target is realistic.

Do not copy large sections of OpenCode’s private UI implementation into the standalone app. Put any compatibility mapping in [`src/compat/`](src/compat/) so it can later be replaced by imports from `@opencode-ai/ui` with minimal changes.

## Integration contract for OpenCode
Document the exact host requirements in `INTEGRATION.md`:
- The host supplies the current project/worktree directory.
- The host provides graph snapshots and refresh notifications through a read-only API.
- The feature never spawns Git from browser code.
- The feature never owns OpenCode session, project, layout, or persistence state.
- The feature exposes a component with explicit inputs such as repository identity, source, initial selection, and close/open callbacks.

When the standalone feature is complete, integrate in this order:
1. Add a focused graph data model and read-only endpoint near the existing backend Git/VCS services.
2. Add schema/API generation only if the public server contract requires it; follow OpenCode’s generation rules rather than editing generated files.
3. Add the OpenCode adapter that maps the API to `GitGraphSource`.
4. Add one custom side-panel tab in `ava-side-panel-tabs.ts`.
5. Add one routing case in `ava-side-panel-content.tsx`.
6. Mount the graph component through the existing `SessionSidePanel` path, using the current project directory and existing layout/theme contexts.
7. Keep host changes small, local, and clearly marked as the graph feature.

The intended integration should not require rewriting the graph engine. Ideally, the final host diff consists of a backend graph contract/adapter, a side-panel registration, localization keys, and minimal styling or dependency wiring.

## Validation requirements
Create real fixture repositories and test:
- Linear history
- Branch divergence and convergence
- Two-parent and octopus merges
- Multiple refs on one commit
- Detached `HEAD`
- Tags and remote-tracking refs
- Rewritten history after rebase/amend
- Unborn `HEAD` and empty repositories
- Shallow and partial clones
- Unicode authors, subjects, ref names, and paths
- Concurrent Git updates and transient incomplete reads

Add:
- Unit tests for Git parsing and snapshot normalization
- Invariant tests ensuring every parent reference is handled correctly
- Deterministic layout tests
- Renderer/interaction tests for selection, pan, zoom, and keyboard use
- Browser tests for the standalone side-panel shell
- Performance benchmarks against generated large histories
- A manual integration checklist for OpenCode

## Completion criteria
The standalone app is ready to integrate only when:
- Its core graph behavior is independent of OpenCode private modules.
- The source contract is documented and has both a local implementation and a host adapter boundary.
- It remains responsive on the agreed large-history fixtures.
- It handles Git DAG and ref edge cases without flattening history into a misleading tree.
- All visible copy is localized.
- The UI matches OpenCode’s visual language closely enough that the side-panel version does not look like a separate product.
- `README.md`, `ARCHITECTURE.md`, `CONTRACT.md`, `INTEGRATION.md`, and the fixture/test instructions are included for the Cursor session that performs the final integration.
- The OpenCode integration plan identifies every official file that must be touched and explains any expected merge conflict with future `Official` updates.

todos:
- Define the standalone project boundaries and the version-pinned SolidJS/Vite/Bun toolchain.
- Implement and test the GitGraphSnapshot contract and LocalGitSource against real fixture repositories.
- Build deterministic DAG layout, virtualized Canvas/SVG rendering, and interaction behavior.
- Build the OpenCode-compatible side-panel shell, theme bridge, i18n surface, and performance fixtures.
- Document the host adapter and produce the minimal OpenCode integration checklist before moving any code into the master application.