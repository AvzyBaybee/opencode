import type { GitCommitID, GitGraphSnapshot } from "../domain/contract"

export type GitActionKind = "branch" | "restore" | "delete"

export type GitPlan =
  | { readonly ok: true; readonly steps: readonly (readonly string[])[] }
  | { readonly ok: false; readonly reason: string }

export function hasLaterBackups(snapshot: GitGraphSnapshot, commitID: GitCommitID) {
  return snapshot.commits.some((commit) => commit.parents.includes(commitID))
}

export function sanitizeBranchName(raw: string) {
  const cleaned = raw.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._/-]/g, "")
  if (!cleaned) return
  if (cleaned.startsWith("-") || cleaned.startsWith("/") || cleaned.endsWith("/") || cleaned.endsWith(".")) return
  if (cleaned.includes("..") || cleaned.includes("@{") || cleaned === ".") return
  return cleaned
}

export function planGitAction(input: {
  snapshot: GitGraphSnapshot
  kind: GitActionKind
  commitID: GitCommitID
  name?: string
}): GitPlan {
  const commit = input.snapshot.commits.find((item) => item.id === input.commitID)
  if (!commit) return { ok: false, reason: "That backup is not in this graph." }
  if (input.kind === "branch") return planBranch(input.snapshot, commit.id, input.name)
  if (input.kind === "restore") return planRestore(input.snapshot, commit.id)
  return planDelete(input.snapshot, commit.id)
}

function planBranch(snapshot: GitGraphSnapshot, commitID: GitCommitID, name: string | undefined): GitPlan {
  const branch = sanitizeBranchName(name ?? "")
  if (!branch) return { ok: false, reason: "Enter a thread name using letters, numbers, dashes, or slashes." }
  if (localBranches(snapshot).some((item) => item.name === branch)) {
    return { ok: false, reason: "That thread name is already in use." }
  }
  return { ok: true, steps: [["switch", "-c", branch, commitID]] }
}

function planRestore(snapshot: GitGraphSnapshot, commitID: GitCommitID): GitPlan {
  const branch = localBranches(snapshot).find((item) => item.commitID === commitID)
  if (branch) return { ok: true, steps: [["switch", branch.name]] }
  return { ok: true, steps: [["switch", "--detach", commitID]] }
}

function planDelete(snapshot: GitGraphSnapshot, commitID: GitCommitID): GitPlan {
  if (hasLaterBackups(snapshot, commitID)) return planRewind(snapshot, commitID)
  return planDropTip(snapshot, commitID)
}

function planRewind(snapshot: GitGraphSnapshot, commitID: GitCommitID): GitPlan {
  const branch = rewindBranch(snapshot, commitID)
  if (!branch) {
    return { ok: false, reason: "No local thread ends after this backup, so it cannot be rewound here." }
  }
  const steps: string[][] = []
  if (snapshot.head.branch !== branch || snapshot.head.detached) steps.push(["switch", branch])
  steps.push(["reset", "--hard", commitID])
  return { ok: true, steps }
}

function planDropTip(snapshot: GitGraphSnapshot, commitID: GitCommitID): GitPlan {
  const commit = snapshot.commits.find((item) => item.id === commitID)
  const steps: string[][] = []
  if (snapshot.head.commitID === commitID) {
    const parent = commit?.parents[0]
    if (!parent) return { ok: false, reason: "The first backup cannot be deleted." }
    const moveHead =
      snapshot.head.detached || !snapshot.head.branch ? ["switch", "--detach", parent] : ["reset", "--hard", parent]
    steps.push(moveHead)
  }
  const current = snapshot.head.detached ? undefined : snapshot.head.branch
  for (const branch of localBranches(snapshot)) {
    if (branch.commitID !== commitID) continue
    if (branch.name === current && snapshot.head.commitID === commitID) continue
    steps.push(["branch", "-D", branch.name])
  }
  for (const ref of snapshot.refs) {
    if (ref.kind !== "tag" || ref.commitID !== commitID) continue
    steps.push(["tag", "-d", ref.name])
  }
  if (steps.length === 0) return { ok: false, reason: "Nothing local points at this backup to delete." }
  return { ok: true, steps }
}

function rewindBranch(snapshot: GitGraphSnapshot, commitID: GitCommitID) {
  const current = snapshot.head.detached ? undefined : snapshot.head.branch
  if (current) {
    const tip = localBranches(snapshot).find((item) => item.name === current)?.commitID ?? snapshot.head.commitID
    if (tip && isLaterOnThread(snapshot, commitID, tip)) return current
  }
  return localBranches(snapshot).find((item) => isLaterOnThread(snapshot, commitID, item.commitID))?.name
}

function isLaterOnThread(snapshot: GitGraphSnapshot, ancestorID: GitCommitID, tipID: GitCommitID) {
  if (ancestorID === tipID) return false
  const parents = new Map(snapshot.commits.map((commit) => [commit.id, commit.parents]))
  const seen = new Set<GitCommitID>()
  const stack = [tipID]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (id === ancestorID) return true
    if (seen.has(id)) continue
    seen.add(id)
    const next = parents.get(id)
    if (!next) continue
    for (const parent of next) stack.push(parent)
  }
  return false
}

function localBranches(snapshot: GitGraphSnapshot) {
  const seen = new Set<string>()
  return snapshot.refs.flatMap((ref) => {
    if (ref.kind !== "local") return []
    if (seen.has(ref.name)) return []
    seen.add(ref.name)
    return [{ name: ref.name, commitID: ref.commitID }]
  })
}
