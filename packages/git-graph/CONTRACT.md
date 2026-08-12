# Contract

## `GitGraphSource`

```ts
type GitGraphSource = {
  getSnapshot(): Promise<GitGraphSnapshot>
  refresh(): Promise<GitGraphSnapshot>
  subscribe(listener: (snapshot: GitGraphSnapshot) => void): () => void
}
```

## `GitGraphSnapshot`

Authoritative read model for the UI:

- `repositoryRoot`, `worktree`
- `head`: `{ commitID?, branch?, detached }`
- `commits[]`: immutable ids, ordered parents, subject, author/committer metadata, optional `backupName`
- `refs[]`: local / remote / tag / stash / head
- `shallow`
- `status`: ready | loading | stale | empty | unborn | invalid | unsupported | error
- `generatedAt`

## Backup naming

MVP backup label:

1. `commit.backupName` if present
2. else `commit.subject`
3. else short commit id

Author names are retained in the data model for later features, but are **not** shown in the MVP canvas.

## Implementations

| Source | Purpose |
|---|---|
| `createLocalGitSource` | Standalone Bun/Git bridge |
| `createOpenCodeGitSource` | Host adapter seam for OpenCode |
| `createBrowserGitSource` | Standalone browser client over `/api` |

## Invariants

- Parent ids referenced by commits must exist in `commits` for ready snapshots used by layout tests
- Ref commit ids (except transient unborn cases) must exist in `commits`
- Layout must be deterministic for the same snapshot
