import type { GitCommitID, GitGraphCommit, GitGraphSnapshot } from "../domain/contract"

export type GitActionKind = "branch" | "restore" | "delete" | "merge" | "move" | "commit" | "switch" | "rename"

export type GitPlan =
  | { readonly ok: true; readonly steps: readonly (readonly string[])[] }
  | { readonly ok: false; readonly reason: string }

export function hasLaterBackups(snapshot: GitGraphSnapshot, commitID: GitCommitID) {
  return snapshot.commits.some((commit) => commit.parents.includes(commitID))
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
  return moveTargets(snapshot).length > 0
}

export function sanitizeBranchName(raw: string) {
  const cleaned = raw.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._/-]/g, "")
  if (!cleaned) return
  if (cleaned.startsWith("-") || cleaned.startsWith("/") || cleaned.endsWith("/") || cleaned.endsWith(".")) return
  if (cleaned.includes("..") || cleaned.includes("@{") || cleaned === ".") return
  return cleaned
}

export function branchNameProblem(raw: string) {
  const name = raw.trim()
  if (!name) return "Your backup needs a name."
  const phrases: string[] = []
  if (name.startsWith("-")) phrases.push("start with a dash")
  if (name.startsWith("/")) phrases.push("start with a slash")
  if (name.includes("..")) phrases.push('contain ".."')
  if (name.includes("@{")) phrases.push('contain "@{"')
  if (name.includes("//")) phrases.push('contain "//"')
  for (const mark of illegalNameMarks(name)) phrases.push(mark)
  if (name.endsWith("/")) phrases.push("end with a slash")
  if (name.endsWith(".")) phrases.push("end with a period")
  if (phrases.length === 0) return
  if (phrases.length === 1) return `The name can't ${phrases[0]}.`
  return `The name can't ${phrases.slice(0, -1).join(", ")}, or ${phrases[phrases.length - 1]}.`
}

function illegalNameMarks(name: string) {
  const marks: string[] = []
  const seen = new Set<string>()
  for (const char of name) {
    if (!isForbiddenNameChar(char) || seen.has(char)) continue
    seen.add(char)
    if (char === " " || char === "\t") marks.push("contain a space")
    else marks.push(`contain "${char}"`)
  }
  return marks
}

function isForbiddenNameChar(char: string) {
  return /[\s~^:?*\[\\]/.test(char)
}

export function planGitAction(input: {
  snapshot: GitGraphSnapshot
  kind: GitActionKind
  commitID?: GitCommitID
  name?: string
  target?: string
  endID?: GitCommitID
  force?: boolean
  paths?: readonly string[]
}): GitPlan {
  const plan = buildPlan(input)
  if (!plan.ok || !input.force) return plan
  return { ok: true, steps: forceSwitchSteps(plan.steps, input.paths) }
}

function buildPlan(input: {
  snapshot: GitGraphSnapshot
  kind: GitActionKind
  commitID?: GitCommitID
  name?: string
  target?: string
  endID?: GitCommitID
}): GitPlan {
  if (input.kind === "commit") return planCommit(input.name)
  if (input.kind === "switch") return planSwitch(input.snapshot, input.target)
  if (input.kind === "rename") return planRename(input.snapshot, input.target, input.name)
  const commit = input.snapshot.commits.find((item) => item.id === input.commitID)
  if (!commit) return { ok: false, reason: "That backup is not in this graph." }
  if (input.kind === "branch") return planBranch(input.snapshot, commit.id, input.name)
  if (input.kind === "restore") return planRestore(input.snapshot, commit)
  if (input.kind === "delete") return planDelete(input.snapshot, commit.id)
  if (input.kind === "merge") return planMerge(input.snapshot, commit.id, input.endID, input.name)
  return planMove(input.snapshot, input.target, input.name)
}

function forceSwitchSteps(steps: readonly (readonly string[])[], paths: readonly string[] | undefined) {
  const forced = steps.map((step) => (step[0] === "switch" ? ["switch", "-f", ...step.slice(1)] : [...step]))
  if (!paths?.length) return forced
  return [["clean", "-f", "--", ...paths], ...forced]
}

function planCommit(name: string | undefined): GitPlan {
  const message = name?.trim()
  if (!message) return { ok: false, reason: "Your backup needs a name." }
  return { ok: true, steps: [["add", "-A"], ["commit", "-m", message]] }
}

function planSwitch(snapshot: GitGraphSnapshot, target: string | undefined): GitPlan {
  if (!target) return { ok: false, reason: "Choose a branch to switch to." }
  if (snapshot.head.branch === target && !snapshot.head.detached) {
    return { ok: true, steps: [] }
  }
  if (!localBranches(snapshot).some((item) => item.name === target)) {
    return { ok: false, reason: "That name is not a branch on this computer." }
  }
  return { ok: true, steps: [["switch", target]] }
}

function planRename(snapshot: GitGraphSnapshot, from: string | undefined, to: string | undefined): GitPlan {
  if (!from || !localBranches(snapshot).some((item) => item.name === from)) {
    return { ok: false, reason: "That name is not a branch on this computer." }
  }
  const problem = branchNameProblem(to ?? "")
  if (problem) return { ok: false, reason: problem }
  const next = (to ?? "").trim()
  if (next === from) return { ok: true, steps: [] }
  if (localBranches(snapshot).some((item) => item.name === next)) {
    return { ok: false, reason: "A branch with that name already exists." }
  }
  return { ok: true, steps: [["branch", "-m", from, next]] }
}

function planBranch(snapshot: GitGraphSnapshot, commitID: GitCommitID, name: string | undefined): GitPlan {
  const problem = branchNameProblem(name ?? "")
  if (problem) return { ok: false, reason: problem }
  const branch = (name ?? "").trim()
  if (localBranches(snapshot).some((item) => item.name === branch)) {
    return { ok: false, reason: "A branch with that name already exists." }
  }
  return { ok: true, steps: [["switch", "-c", branch, commitID]] }
}

function planRestore(snapshot: GitGraphSnapshot, commit: GitGraphCommit): GitPlan {
  const atTip = localBranches(snapshot).find((item) => item.commitID === commit.id)
  if (atTip) return { ok: true, steps: [["switch", atTip.name]] }
  const branch = (snapshot.head.detached ? undefined : snapshot.head.branch) || owningThread(snapshot, commit.id)
  if (!branch) return { ok: false, reason: "That backup is not in this graph." }
  const steps: string[][] = []
  if (snapshot.head.branch !== branch || snapshot.head.detached) steps.push(["switch", branch])
  steps.push(["reset", "--hard", commit.id])
  return { ok: true, steps }
}

function planDelete(snapshot: GitGraphSnapshot, commitID: GitCommitID): GitPlan {
  const commit = snapshot.commits.find((item) => item.id === commitID)
  const parent = commit?.parents[0]
  if (!parent) return { ok: false, reason: "You can't delete the first backup. This is the foundation of all other backups." }
  const branch = owningThread(snapshot, commitID)
  if (!branch) {
    return { ok: false, reason: "This backup is not on a branch on this computer, so it cannot be deleted here." }
  }
  const steps: string[][] = []
  if (snapshot.head.branch !== branch || snapshot.head.detached) steps.push(["switch", branch])
  steps.push(["reset", "--soft", parent])
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
  const branch = owningThread(snapshot, newest)
  if (!branch) return { ok: false, reason: "These backups are not on a branch on this computer, so they cannot be merged here." }
  const tip = localBranches(snapshot).find((item) => item.name === branch)?.commitID
  if (!tip || (tip !== newest && !isLaterOnThread(snapshot, newest, tip))) {
    return { ok: false, reason: "These backups are not on a branch on this computer, so they cannot be merged here." }
  }
  const message = name?.trim()
  if (!message) return { ok: false, reason: "Your backup needs a name." }
  const steps: string[][] = []
  if (snapshot.head.branch !== branch || snapshot.head.detached) steps.push(["switch", branch])
  if (tip === newest) {
    steps.push(["reset", "--soft", oldest], ["commit", "--amend", "-m", message])
    return { ok: true, steps }
  }
  steps.push(
    ["switch", "--detach", newest],
    ["reset", "--soft", oldest],
    ["commit", "--amend", "-m", message],
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

function planMove(snapshot: GitGraphSnapshot, target: string | undefined, name: string | undefined): GitPlan {
  const named = snapshot.head.detached ? undefined : snapshot.head.branch
  const steps: string[][] = []
  const current = named ?? namedFromMove(snapshot, name, steps)
  if (typeof current !== "string") return current
  if (!target || target === current) return { ok: false, reason: "Choose another branch to move onto." }
  if (!localBranches(snapshot).some((item) => item.name === target)) {
    return { ok: false, reason: "That name is not a branch on this computer." }
  }
  steps.push(["rebase", target], ["switch", target], ["merge", "--ff-only", current], ["branch", "-D", current])
  return { ok: true, steps }
}

function namedFromMove(snapshot: GitGraphSnapshot, name: string | undefined, steps: string[][]): string | GitPlan {
  const problem = branchNameProblem(name ?? "")
  if (problem) return { ok: false, reason: problem }
  const branch = (name ?? "").trim()
  if (localBranches(snapshot).some((item) => item.name === branch)) {
    return { ok: false, reason: "A branch with that name already exists." }
  }
  steps.push(["switch", "-c", branch])
  return branch
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
