import { describe, expect, test } from "bun:test"
import type { GitGraphCommit, GitGraphSnapshot } from "../domain/contract"
import {
  canMoveCurrentBranch,
  canStartMerge,
  expandMergeRange,
  hasLaterBackups,
  planGitAction,
  sanitizeBranchName,
} from "./actions"

describe("git action planner", () => {
  test("sanitizes auto-generated thread names", () => {
    expect(sanitizeBranchName("  fix stuff  ")).toBe("fix-stuff")
    expect(sanitizeBranchName("bad name!")).toBe("bad-name")
    expect(sanitizeBranchName("..nope")).toBe(undefined)
    expect(sanitizeBranchName("-hidden")).toBe(undefined)
    expect(sanitizeBranchName("")).toBe(undefined)
  })

  test("branches off with switch -c", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "branch", commitID: "c1", name: "feature" })
    expect(plan).toEqual({ ok: true, steps: [["switch", "-c", "feature", "c1"]] })
  })

  test("refuses a duplicate thread name", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "branch", commitID: "c1", name: "main" })
    expect(plan).toEqual({ ok: false, reason: "A branch with that name already exists." })
  })

  test("explains which part of a branch name is invalid", () => {
    expect(planGitAction({ snapshot: linear(), kind: "branch", commitID: "c1", name: "" })).toEqual({
      ok: false,
      reason: "Your backup needs a name.",
    })
    expect(planGitAction({ snapshot: linear(), kind: "branch", commitID: "c1", name: "-hidden." })).toEqual({
      ok: false,
      reason: 'The name can\'t start with a dash, or end with a period.',
    })
    expect(planGitAction({ snapshot: linear(), kind: "branch", commitID: "c1", name: "bad name.." })).toEqual({
      ok: false,
      reason: 'The name can\'t contain "..", contain a space, or end with a period.',
    })
    expect(planGitAction({ snapshot: linear(), kind: "branch", commitID: "c1", name: "feature" })).toEqual({
      ok: true,
      steps: [["switch", "-c", "feature", "c1"]],
    })
  })

  test("restores by switching to a local tip", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "restore", commitID: "c2" })
    expect(plan).toEqual({ ok: true, steps: [["switch", "main"]] })
  })

  test("restores an older backup on the same branch", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "restore", commitID: "c1" })
    expect(plan).toEqual({ ok: true, steps: [["reset", "--hard", "c1"]] })
  })

  test("restores by switching when another branch already points there", () => {
    const plan = planGitAction({ snapshot: namedBranch("one"), kind: "restore", commitID: "c2" })
    expect(plan).toEqual({ ok: true, steps: [["switch", "main"]] })
  })

  test("drops a branch tip by resetting to its parent", () => {
    expect(hasLaterBackups(linear(), "c2")).toBe(false)
    const plan = planGitAction({ snapshot: linear(), kind: "delete", commitID: "c2" })
    expect(plan).toEqual({ ok: true, steps: [["reset", "--soft", "c1"]] })
  })

  test("deletes a side-thread tip by resetting that thread to its parent", () => {
    const plan = planGitAction({ snapshot: branched(), kind: "delete", commitID: "s1" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["switch", "feature"],
        ["reset", "--soft", "c1"],
      ],
    })
  })

  test("deletes this backup and newer ones on the thread", () => {
    expect(hasLaterBackups(linear(), "c1")).toBe(true)
    const plan = planGitAction({ snapshot: linear(), kind: "delete", commitID: "c1" })
    expect(plan).toEqual({ ok: true, steps: [["reset", "--soft", "c0"]] })
  })

  test("switches to the descendant thread before deleting through it", () => {
    const plan = planGitAction({ snapshot: rewindOtherThread(), kind: "delete", commitID: "c1" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["switch", "main"],
        ["reset", "--soft", "c0"],
      ],
    })
  })

  test("deletes a local tip even if a remote backup sits after it", () => {
    const plan = planGitAction({ snapshot: remoteOnlyAfter(), kind: "delete", commitID: "c1" })
    expect(plan).toEqual({ ok: true, steps: [["reset", "--soft", "c0"]] })
  })

  test("refuses to delete the first backup", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "delete", commitID: "c0" })
    expect(plan).toEqual({
      ok: false,
      reason: "You can't delete the first backup. This is the foundation of all other backups.",
    })
  })

  test("grows a merge range along consecutive backups", () => {
    expect(expandMergeRange(linear(), [], "c1")).toEqual(["c1"])
    expect(expandMergeRange(linear(), ["c1"], "c2")).toEqual(["c1", "c2"])
    expect(expandMergeRange(linear(), ["c2"], "c0")).toEqual(["c0", "c1", "c2"])
    expect(expandMergeRange(linear(), ["c1", "c2"], "s1")).toEqual(["c1", "c2"])
  })

  test("merges a selected range at the tip into one commit", () => {
    expect(canStartMerge(linear(), "c2")).toBe(true)
    const plan = planGitAction({ snapshot: linear(), kind: "merge", commitID: "c1", endID: "c2", name: "tidy" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["reset", "--soft", "c1"],
        ["commit", "--amend", "-m", "tidy"],
      ],
    })
  })

  test("collapses a range that includes the first backup", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "merge", commitID: "c0", endID: "c2", name: "tidy" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["reset", "--soft", "c0"],
        ["commit", "--amend", "-m", "tidy"],
      ],
    })
  })

  test("replays later backups when the merge range is not the tip", () => {
    const plan = planGitAction({ snapshot: longer(), kind: "merge", commitID: "c1", endID: "c2", name: "tidy" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["switch", "--detach", "c2"],
        ["reset", "--soft", "c1"],
        ["commit", "--amend", "-m", "tidy"],
        ["rebase", "--onto", "HEAD", "c2", "main"],
        ["switch", "main"],
      ],
    })
  })

  test("refuses merge without a name or a second backup", () => {
    expect(planGitAction({ snapshot: linear(), kind: "merge", commitID: "c1", endID: "c2" }).ok).toBe(false)
    expect(planGitAction({ snapshot: linear(), kind: "merge", commitID: "c2", name: "tidy" }).ok).toBe(false)
  })

  test("refuses merge when a join sits in the range", () => {
    const plan = planGitAction({ snapshot: joined(), kind: "merge", commitID: "c1", endID: "m1", name: "tidy" })
    expect(plan.ok).toBe(false)
  })

  test("moves the current thread onto another and deletes it", () => {
    expect(canMoveCurrentBranch(onFeature())).toBe(true)
    const plan = planGitAction({ snapshot: onFeature(), kind: "move", commitID: "s1", target: "main" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["rebase", "main"],
        ["switch", "main"],
        ["merge", "--ff-only", "feature"],
        ["branch", "-D", "feature"],
      ],
    })
  })

  test("names a nameless thread before moving it", () => {
    const detached = snapshot({
      ...branched(),
      head: { commitID: "s1", detached: true },
    })
    expect(canMoveCurrentBranch(detached)).toBe(true)
    const plan = planGitAction({ snapshot: detached, kind: "move", commitID: "s1", name: "side", target: "main" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["switch", "-c", "side"],
        ["rebase", "main"],
        ["switch", "main"],
        ["merge", "--ff-only", "side"],
        ["branch", "-D", "side"],
      ],
    })
  })

  test("can move the current thread even if it is named main", () => {
    const plan = planGitAction({ snapshot: branched(), kind: "move", commitID: "c2", target: "feature" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["rebase", "feature"],
        ["switch", "feature"],
        ["merge", "--ff-only", "main"],
        ["branch", "-D", "main"],
      ],
    })
  })

  test("creates a backup with add and commit", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "commit", name: "save point" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["add", "-A"],
        ["commit", "-m", "save point"],
      ],
    })
  })

  test("refuses an unnamed backup", () => {
    expect(planGitAction({ snapshot: linear(), kind: "commit", name: "  " })).toEqual({
      ok: false,
      reason: "Your backup needs a name.",
    })
  })

  test("renames a local branch", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "rename", target: "main", name: "trunk" })
    expect(plan).toEqual({ ok: true, steps: [["branch", "-m", "main", "trunk"]] })
  })

  test("refuses renaming onto a name that already exists", () => {
    const plan = planGitAction({ snapshot: branched(), kind: "rename", target: "feature", name: "main" })
    expect(plan).toEqual({ ok: false, reason: "A branch with that name already exists." })
  })

  test("switches to another local thread", () => {
    const plan = planGitAction({ snapshot: branched(), kind: "switch", target: "feature" })
    expect(plan).toEqual({ ok: true, steps: [["switch", "feature"]] })
  })

  test("discards desk changes when a switch is forced", () => {
    const plan = planGitAction({
      snapshot: branched(),
      kind: "switch",
      target: "feature",
      force: true,
      paths: ["notes.txt"],
    })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["clean", "-f", "--", "notes.txt"],
        ["switch", "-f", "feature"],
      ],
    })
  })
})

function commit(id: string, parents: string[], subject: string): GitGraphCommit {
  return {
    id,
    parents,
    subject,
    authorName: "Ava",
    authorEmail: "ava@example.com",
    authorAt: 1,
    committerName: "Ava",
    committerEmail: "ava@example.com",
    committerAt: 1,
  }
}

function snapshot(input: Partial<GitGraphSnapshot> & Pick<GitGraphSnapshot, "commits" | "refs" | "head">): GitGraphSnapshot {
  return {
    repositoryRoot: "/repo",
    worktree: "/repo",
    shallow: false,
    status: { kind: "ready" },
    generatedAt: 1,
    ...input,
  }
}

function linear() {
  return snapshot({
    head: { commitID: "c2", branch: "main", detached: false },
    commits: [commit("c2", ["c1"], "two"), commit("c1", ["c0"], "one"), commit("c0", [], "root")],
    refs: [
      { name: "main", kind: "local", commitID: "c2" },
      { name: "HEAD", kind: "head", commitID: "c2" },
    ],
  })
}

function longer() {
  return snapshot({
    head: { commitID: "c3", branch: "main", detached: false },
    commits: [
      commit("c3", ["c2"], "three"),
      commit("c2", ["c1"], "two"),
      commit("c1", ["c0"], "one"),
      commit("c0", [], "root"),
    ],
    refs: [
      { name: "main", kind: "local", commitID: "c3" },
      { name: "HEAD", kind: "head", commitID: "c3" },
    ],
  })
}

function namedBranch(name: string) {
  const base = linear()
  return snapshot({
    ...base,
    refs: [
      { name: "main", kind: "local", commitID: "c2" },
      { name, kind: "local", commitID: "c2" },
      { name: "HEAD", kind: "head", commitID: "c2" },
    ],
  })
}

function branched() {
  return snapshot({
    head: { commitID: "c2", branch: "main", detached: false },
    commits: [
      commit("c2", ["c1"], "main tip"),
      commit("s1", ["c1"], "feature tip"),
      commit("c1", ["c0"], "base"),
      commit("c0", [], "root"),
    ],
    refs: [
      { name: "main", kind: "local", commitID: "c2" },
      { name: "feature", kind: "local", commitID: "s1" },
      { name: "HEAD", kind: "head", commitID: "c2" },
    ],
  })
}

function onFeature() {
  return snapshot({
    ...branched(),
    head: { commitID: "s1", branch: "feature", detached: false },
  })
}

function rewindOtherThread() {
  return snapshot({
    head: { commitID: "s1", branch: "feature", detached: false },
    commits: [
      commit("c2", ["c1"], "main tip"),
      commit("s1", ["c0"], "feature tip"),
      commit("c1", ["c0"], "main mid"),
      commit("c0", [], "root"),
    ],
    refs: [
      { name: "main", kind: "local", commitID: "c2" },
      { name: "feature", kind: "local", commitID: "s1" },
      { name: "HEAD", kind: "head", commitID: "c2" },
    ],
  })
}

function remoteOnlyAfter() {
  return snapshot({
    head: { commitID: "c1", branch: "main", detached: false },
    commits: [commit("c2", ["c1"], "remote only"), commit("c1", ["c0"], "here"), commit("c0", [], "root")],
    refs: [
      { name: "main", kind: "local", commitID: "c1" },
      { name: "origin/main", kind: "remote", commitID: "c2", remote: "origin" },
      { name: "HEAD", kind: "head", commitID: "c1" },
    ],
  })
}

function joined() {
  return snapshot({
    head: { commitID: "m1", branch: "main", detached: false },
    commits: [
      commit("m1", ["c2", "s1"], "join"),
      commit("c2", ["c1"], "main tip"),
      commit("s1", ["c1"], "feature tip"),
      commit("c1", ["c0"], "base"),
      commit("c0", [], "root"),
    ],
    refs: [
      { name: "main", kind: "local", commitID: "m1" },
      { name: "HEAD", kind: "head", commitID: "m1" },
    ],
  })
}
