export type GitCommitID = string

export type GitRefKind = "local" | "remote" | "tag" | "stash" | "head"

export type GitGraphRef = {
  readonly name: string
  readonly kind: GitRefKind
  readonly commitID: GitCommitID
  readonly remote?: string
}

export type GitGraphCommit = {
  readonly id: GitCommitID
  readonly parents: readonly GitCommitID[]
  readonly subject: string
  readonly authorName: string
  readonly authorEmail: string
  readonly authorAt: number
  readonly committerName: string
  readonly committerEmail: string
  readonly committerAt: number
  /** Optional future backup-name override; UI falls back to subject. */
  readonly backupName?: string
  /** True when this backup is reachable from a remote-tracking tip. */
  readonly onCloud?: boolean
}

export type GitGraphStatus =
  | { readonly kind: "ready" }
  | { readonly kind: "loading" }
  | { readonly kind: "stale"; readonly reason: string }
  | { readonly kind: "empty" }
  | { readonly kind: "unborn" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "unsupported"; readonly message: string }
  | { readonly kind: "error"; readonly message: string }

export type GitGraphSnapshot = {
  readonly repositoryRoot: string
  readonly worktree: string
  readonly head: {
    readonly commitID?: GitCommitID
    readonly branch?: string
    readonly detached: boolean
  }
  readonly commits: readonly GitGraphCommit[]
  readonly refs: readonly GitGraphRef[]
  readonly shallow: boolean
  readonly status: GitGraphStatus
  readonly generatedAt: number
}

export type GitGraphSource = {
  getSnapshot(): Promise<GitGraphSnapshot>
  refresh(): Promise<GitGraphSnapshot>
  subscribe(listener: (snapshot: GitGraphSnapshot) => void): () => void
}

export function backupLabel(commit: GitGraphCommit) {
  const name = commit.backupName?.trim() || commit.subject.trim()
  return name || commit.id.slice(0, 7)
}

export function emptySnapshot(input: {
  worktree: string
  repositoryRoot?: string
  status: GitGraphStatus
}): GitGraphSnapshot {
  return {
    repositoryRoot: input.repositoryRoot ?? input.worktree,
    worktree: input.worktree,
    head: { detached: false },
    commits: [],
    refs: [],
    shallow: false,
    status: input.status,
    generatedAt: Date.now(),
  }
}
