import type { GitCommitID, GitGraphCommit, GitGraphSnapshot } from "../domain/contract"

export type GitActionKind = "branch" | "restore" | "delete" | "merge" | "move" | "commit" | "switch"

export type GitPlan =
  | { readonly ok: true; readonly steps: readonly (readonly string[])[] }
  | { readonly ok: false; readonly reason: string }

const PROTECTED_BRANCHES = new Set(["main", "master", "Custom", "Official"])

export function hasLaterBackups(snapshot: GitGraphSnapshot, commitID: GitCommitID) {
  return snapshot.commits.some((commit) => commit.parents.includes(commitID))
}

export function isProtectedBranch(name: string) {
  return PROTECTED_BRANCHES.has(name)
}

export function canStartMerge(snapshot: GitGraphSnapshot, commitID: GitCommitID) {
  const commit = snapshot.commits.find((item) => item.id === commitID)
  if (!commit || !owningThread(snapshot, commitID)) return false
  if (commit.parents[0] && snapshot.commits.some((item) => item.id === commit.parents[0])) return true
  return snapshot.commits.some((item) => item.parents.length === 1 && item.parents[0] === commitID)
}

export function expandMergeRange(snapshot: GitGraphSnapshot, range: readonly GitCommitID[], clicked: GitCommitID) {
  if (range.length === 0) return [clicked]
  const oldest = range[0]!
  const newest = range[range.length - 1]!
  const current = firstParentChain(snapshot, newest, oldest)
  if (!current) return [clicked]
  if (current.includes(clicked)) return current
  const newer = firstParentChain(snapshot, clicked, newest)
  if (newer) return [...current, ...newer.slice(1)]
  const older = firstParentChain(snapshot, oldest, clicked)
  if (older) return [...older.slice(0, -1), ...current]
  return current
}

export function canDeleteBackup(snapshot: GitGraphSnapshot, commitID: GitCommitID) {
  return planDelete(snapshot, commitID).ok
}

export function localBranchNames(snapshot: GitGraphSnapshot) {
  return localBranches(snapshot).map((item) => item.name)
}

export function moveTargets(snapshot: GitGraphSnapshot) {
  const current = snapshot.head.detached ? undefined : snapshot.head.branch
  return localBranches(snapshot).filter((branch) => branch.name !== current)
}

export function canMoveCurrentBranch(snapshot: GitGraphSnapshot) {
  const current = snapshot.head.detached ? undefined : snapshot.head.branch
  if (!current || isProtectedBranch(current)) return false
  return moveTargets(snapshot).length > 0
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
  commitID?: GitCommitID
  name?: string
  target?: string
  endID?: GitCommitID
}): GitPlan {
  if (input.kind === "commit") return planCommit(input.name)
  if (input.kind === "switch") return planSwitch(input.snapshot, input.target)
  const commit = input.snapshot.commits.find((item) => item.id === input.commitID)
  if (!commit) return { ok: false, reason: "That backup is not in this graph." }
  if (input.kind === "branch") return planBranch(input.snapshot, commit.id, input.name)
  if (input.kind === "restore") return planRestore(input.snapshot, commit)
  if (input.kind === "delete") return planDelete(input.snapshot, commit.id)
  if (input.kind === "merge") return planMerge(input.snapshot, commit.id, input.endID, input.name)
  return planMove(input.snapshot, input.target)
}

function planCommit(name: string | undefined): GitPlan {
  const message = name?.trim()
  if (!message) return { ok: false, reason: "Enter a name for this backup." }
  return { ok: true, steps: [["add", "-A"], ["commit", "-m", message]] }
}

function planSwitch(snapshot: GitGraphSnapshot, target: string | undefined): GitPlan {
  if (!target) return { ok: false, reason: "Choose a thread to switch to." }
  if (snapshot.head.branch === target && !snapshot.head.detached) {
    return { ok: true, steps: [] }
  }
  if (!localBranches(snapshot).some((item) => item.name === target)) {
    return { ok: false, reason: "That thread is not a local branch." }
  }
  return { ok: true, steps: [["switch", target]] }
}

function planBranch(snapshot: GitGraphSnapshot, commitID: GitCommitID, name: string | undefined): GitPlan {
  const branch = sanitizeBranchName(name ?? "")
  if (!branch) return { ok: false, reason: "Enter a thread name using letters, numbers, dashes, or slashes." }
  if (localBranches(snapshot).some((item) => item.name === branch)) {
    return { ok: false, reason: "That thread name is already in use." }
  }
  return { ok: true, steps: [["switch", "-c", branch, commitID]] }
}

function planRestore(snapshot: GitGraphSnapshot, commit: GitGraphCommit): GitPlan {
  const branch = localBranches(snapshot).find((item) => item.commitID === commit.id)
  if (branch) return { ok: true, steps: [["switch", branch.name]] }
  const name = uniqueRestoreName(snapshot, commit)
  if (!name) return { ok: false, reason: "Could not name a new thread for this backup." }
  return { ok: true, steps: [["switch", "-c", name, commit.id]] }
}

function planDelete(snapshot: GitGraphSnapshot, commitID: GitCommitID): GitPlan {
  const commit = snapshot.commits.find((item) => item.id === commitID)
  const parent = commit?.parents[0]
  if (!parent) return { ok: false, reason: "The first backup cannot be deleted." }
  const branch = owningThread(snapshot, commitID)
  if (!branch) {
    return { ok: false, reason: "No local thread holds this backup, so it cannot be deleted here." }
  }
  const steps: string[][] = []
  if (snapshot.head.branch !== branch || snapshot.head.detached) steps.push(["switch", branch])
  steps.push(["reset", "--hard", parent])
  return { ok: true, steps }
}

function planMerge(
  snapshot: GitGraphSnapshot,
  startID: GitCommitID,
  endID: GitCommitID | undefined,
  name: string | undefined,
): GitPlan {
  const range = orderedMergeRange(snapshot, startID, endID ?? startID)
  if (!range || range.length < 2) {
    return { ok: false, reason: "Select at least two consecutive backups to merge." }
  }
  const oldest = range[0]!
  const newest = range[range.length - 1]!
  const oldestCommit = snapshot.commits.find((item) => item.id === oldest)
  const parent = oldestCommit?.parents[0]
  if (!parent) return { ok: false, reason: "Nothing earlier to merge these backups into." }
  const branch = owningThread(snapshot, newest)
  if (!branch) return { ok: false, reason: "No local thread holds these backups, so they cannot be merged here." }
  const tip = localBranches(snapshot).find((item) => item.name === branch)?.commitID
  if (!tip || (tip !== newest && !isLaterOnThread(snapshot, newest, tip))) {
    return { ok: false, reason: "No local thread holds these backups, so they cannot be merged here." }
  }
  const message = name?.trim()
  if (!message) return { ok: false, reason: "Enter a name for the merged backup." }
  const steps: string[][] = []
  if (snapshot.head.branch !== branch || snapshot.head.detached) steps.push(["switch", branch])
  if (tip === newest) {
    steps.push(["reset", "--soft", parent], ["commit", "-m", message])
    return { ok: true, steps }
  }
  steps.push(
    ["switch", "--detach", newest],
    ["reset", "--soft", parent],
    ["commit", "-m", message],
    ["rebase", "--onto", "HEAD", newest, branch],
    ["switch", branch],
  )
  return { ok: true, steps }
}

function orderedMergeRange(snapshot: GitGraphSnapshot, startID: GitCommitID, endID: GitCommitID) {
  return firstParentChain(snapshot, endID, startID) ?? firstParentChain(snapshot, startID, endID)
}

function firstParentChain(snapshot: GitGraphSnapshot, newerID: GitCommitID, olderID: GitCommitID) {
  const byID = new Map(snapshot.commits.map((commit) => [commit.id, commit]))
  const ids: GitCommitID[] = []
  let id: GitCommitID | undefined = newerID
  const seen = new Set<GitCommitID>()
  while (id) {
    if (seen.has(id)) return
    seen.add(id)
    const commit = byID.get(id)
    if (!commit) return
    ids.push(id)
    if (id === olderID) {
      if (commit.parents.length > 1) return
      return ids.reverse()
    }
    if (commit.parents.length !== 1) return
    id = commit.parents[0]
  }
}

function planMove(snapshot: GitGraphSnapshot, target: string | undefined): GitPlan {
  const current = snapshot.head.detached ? undefined : snapshot.head.branch
  if (!current) return { ok: false, reason: "Restore a named thread before moving it." }
  if (isProtectedBranch(current)) {
    return { ok: false, reason: "This line is kept. Move a side branch onto it instead." }
  }
  if (!target || target === current) return { ok: false, reason: "Choose another thread to move onto." }
  if (!localBranches(snapshot).some((item) => item.name === target)) {
    return { ok: false, reason: "That thread is not a local branch." }
  }
  return {
    ok: true,
    steps: [
      ["rebase", target],
      ["switch", target],
      ["merge", "--ff-only", current],
      ["branch", "-D", current],
    ],
  }
}

function uniqueRestoreName(snapshot: GitGraphSnapshot, commit: GitGraphCommit) {
  const taken = new Set(localBranches(snapshot).map((item) => item.name))
  const short = commit.id.slice(0, 7)
  const base = sanitizeBranchName(commit.subject) || sanitizeBranchName(`from-${short}`)
  if (base && !taken.has(base)) return base
  const withId = sanitizeBranchName(`${base ?? "from"}-${short}`) || sanitizeBranchName(`from-${short}`)
  if (withId && !taken.has(withId)) return withId
  if (!withId) return
  let n = 2
  while (taken.has(`${withId}-${n}`)) n += 1
  return `${withId}-${n}`
}

function owningThread(snapshot: GitGraphSnapshot, commitID: GitCommitID) {
  const current = snapshot.head.detached ? undefined : snapshot.head.branch
  if (current) {
    const tip = localBranches(snapshot).find((item) => item.name === current)?.commitID ?? snapshot.head.commitID
    if (tip && (tip === commitID || isLaterOnThread(snapshot, commitID, tip))) return current
  }
  const atTip = localBranches(snapshot).find((item) => item.commitID === commitID)
  if (atTip) return atTip.name
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
