import type { GitCommitID, GitGraphCommit, GitGraphRef, GitGraphSnapshot, GitGraphStatus } from "./contract"
import { emptySnapshot } from "./contract"

export function normalizeSnapshot(input: {
  worktree: string
  repositoryRoot: string
  head: GitGraphSnapshot["head"]
  commits: readonly GitGraphCommit[]
  refs: readonly GitGraphRef[]
  shallow: boolean
  status?: GitGraphStatus
}): GitGraphSnapshot {
  const commits = dedupeCommits(input.commits)
  const byID = new Map(commits.map((commit) => [commit.id, commit] as const))
  const refs = input.refs.filter((ref) => byID.has(ref.commitID) || ref.kind === "head")
  const head = sanitizeHead(input.head, byID)
  const status = input.status ?? inferStatus(commits, head)

  return {
    repositoryRoot: input.repositoryRoot,
    worktree: input.worktree,
    head,
    commits,
    refs,
    shallow: input.shallow,
    status,
    generatedAt: Date.now(),
  }
}

export function assertSnapshotInvariants(snapshot: GitGraphSnapshot) {
  const ids = new Set(snapshot.commits.map((commit) => commit.id))
  for (const commit of snapshot.commits) {
    if (!commit.id) throw new Error("Commit id is empty")
    for (const parent of commit.parents) {
      if (!ids.has(parent)) throw new Error(`Missing parent ${parent} for ${commit.id}`)
    }
  }
  for (const ref of snapshot.refs) {
    if (ref.kind === "head") continue
    if (!ids.has(ref.commitID)) throw new Error(`Ref ${ref.name} points to missing commit ${ref.commitID}`)
  }
  if (snapshot.head.commitID && !ids.has(snapshot.head.commitID) && snapshot.commits.length > 0) {
    throw new Error(`HEAD points to missing commit ${snapshot.head.commitID}`)
  }
}

function dedupeCommits(commits: readonly GitGraphCommit[]) {
  const seen = new Map<GitCommitID, GitGraphCommit>()
  for (const commit of commits) {
    if (seen.has(commit.id)) continue
    seen.set(commit.id, {
      ...commit,
      parents: [...new Set(commit.parents.filter(Boolean))],
    })
  }
  // Truncated histories may reference parents outside the loaded window.
  // Keep the snapshot layoutable by retaining only known parents.
  return [...seen.values()].map((commit) => ({
    ...commit,
    parents: commit.parents.filter((parent) => seen.has(parent)),
  }))
}

function sanitizeHead(
  head: GitGraphSnapshot["head"],
  byID: Map<GitCommitID, GitGraphCommit>,
): GitGraphSnapshot["head"] {
  if (!head.commitID) return { detached: head.detached, branch: head.branch }
  if (!byID.has(head.commitID)) return { detached: head.detached, branch: head.branch }
  return head
}

function inferStatus(commits: readonly GitGraphCommit[], head: GitGraphSnapshot["head"]): GitGraphStatus {
  if (commits.length === 0) {
    if (head.branch && !head.commitID) return { kind: "unborn" }
    return { kind: "empty" }
  }
  return { kind: "ready" }
}

export function loadingSnapshot(worktree: string) {
  return emptySnapshot({ worktree, status: { kind: "loading" } })
}
