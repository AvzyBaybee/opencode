import { describe, expect, test } from "bun:test"
import type { GitGraphCommit, GitGraphSnapshot } from "../domain/contract"
import { hasLaterBackups, planGitAction, sanitizeBranchName } from "./actions"

describe("git action planner", () => {
  test("sanitizes thread names", () => {
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
    expect(plan.ok).toBe(false)
  })

  test("restores by switching to a local tip", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "restore", commitID: "c2" })
    expect(plan).toEqual({ ok: true, steps: [["switch", "main"]] })
  })

  test("restores a mid backup by detaching", () => {
    const plan = planGitAction({ snapshot: linear(), kind: "restore", commitID: "c1" })
    expect(plan).toEqual({ ok: true, steps: [["switch", "--detach", "c1"]] })
  })

  test("drops a branch tip with reset when it is HEAD", () => {
    expect(hasLaterBackups(linear(), "c2")).toBe(false)
    const plan = planGitAction({ snapshot: linear(), kind: "delete", commitID: "c2" })
    expect(plan).toEqual({ ok: true, steps: [["reset", "--hard", "c1"]] })
  })

  test("deletes a side-thread tip with branch -D", () => {
    const plan = planGitAction({ snapshot: branched(), kind: "delete", commitID: "s1" })
    expect(plan).toEqual({ ok: true, steps: [["branch", "-D", "feature"]] })
  })

  test("rewinds a thread to this backup and keeps it", () => {
    expect(hasLaterBackups(linear(), "c1")).toBe(true)
    const plan = planGitAction({ snapshot: linear(), kind: "delete", commitID: "c1" })
    expect(plan).toEqual({ ok: true, steps: [["reset", "--hard", "c1"]] })
  })

  test("switches to the descendant thread before rewind", () => {
    const plan = planGitAction({ snapshot: rewindOtherThread(), kind: "delete", commitID: "c1" })
    expect(plan).toEqual({
      ok: true,
      steps: [
        ["switch", "main"],
        ["reset", "--hard", "c1"],
      ],
    })
  })

  test("refuses rewind when only remotes sit after it", () => {
    const plan = planGitAction({ snapshot: remoteOnlyAfter(), kind: "delete", commitID: "c1" })
    expect(plan.ok).toBe(false)
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
      { name: "HEAD", kind: "head", commitID: "s1" },
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
