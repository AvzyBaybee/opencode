# Architecture

```text
packages/git-graph/
  src/domain/      Snapshot contract + normalization
  src/source/      LocalGitSource + OpenCodeGitSource seam + parsers
  src/layout/      Deterministic DAG lane layout
  src/render/      Canvas drawer + hit testing
  src/interaction/ Pan / zoom / selection camera state
  src/host/        Embeddable GitGraphPanel (OpenCode-ready)
  src/compat/      Theme tokens compatible with OpenCode --v2-* vars
  src/i18n/        Visible copy
  src/standalone/  Dev-only host shell + Bun Git bridge
  fixtures/        In-memory sample repositories
```

## Runtime split

Standalone development:

```text
Vite UI (:5199) --fetch/SSE--> Bun Git API (:5200) --git--> local repository
```

Browser code never receives arbitrary shell commands. The API accepts a repository path and runs a fixed allowlist of Git read commands through `bunGitRunner`.

Future OpenCode host:

```text
GitGraphPanel <-- GitGraphSource <-- OpenCodeGitSource <-- OpenCode read-only graph API
```

The panel and layout/render stack stay unchanged. Only the source adapter is replaced.

## Visual model

- Each commit is a backup entry
- Backup label text defaults to commit subject
- Branch/tag labels are compact rounded pills at tips
- Edges preserve merge parents; the graph is a DAG, not a fake tree
- Default UI is intentionally minimal: canvas + optional tooltip

## Performance stance

- Canvas draws edges/nodes/labels
- Only the visible region is painted
- Layout is deterministic and pure
- Large histories should stay on the canvas path (no DOM node per commit)
