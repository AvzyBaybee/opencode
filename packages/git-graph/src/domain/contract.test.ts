import { describe, expect, test } from "bun:test"
import { parseCommitRecords, parseRefLines, COMMIT_FORMAT } from "../source/parse"
import { assertSnapshotInvariants, normalizeSnapshot } from "./normalize"
import { backupLabel } from "./contract"
import { layoutGraph } from "../layout"
import { fixtureSnapshot } from "../../fixtures/snapshots"
import { createLocalGitSource } from "../source/local"

describe("parse", () => {
  test("parses commit records with multiple parents", () => {
    const text = ["abc", "def ghi", "Merge", "Ava", "a@x", "10", "Ava", "a@x", "10"].join("\x1f") + "\x1e"
    const commits = parseCommitRecords(text)
    expect(commits).toHaveLength(1)
    expect(commits[0]?.parents).toEqual(["def", "ghi"])
    expect(commits[0]?.subject).toBe("Merge")
  })

  test("classifies refs", () => {
    const refs = parseRefLines(
      ["aaa\trefs/heads/main", "bbb\trefs/remotes/origin/dev", "ccc\trefs/tags/v1", "ddd\trefs/stash"].join("\n"),
    )
    expect(refs.map((ref) => ref.kind)).toEqual(["local", "remote", "tag", "stash"])
    expect(refs[1]?.remote).toBe("origin")
  })

  test("commit format stays machine-readable", () => {
    expect(COMMIT_FORMAT.includes("%H")).toBe(true)
    expect(COMMIT_FORMAT.includes("%s")).toBe(true)
  })
})

describe("normalize", () => {
  test("rejects missing parents via invariants", () => {
    const snapshot = {
      repositoryRoot: "/tmp",
      worktree: "/tmp",
      head: { commitID: "a", detached: false },
      shallow: false,
      commits: [
        {
          id: "a",
          parents: ["missing"],
          subject: "x",
          authorName: "",
          authorEmail: "",
          authorAt: 0,
          committerName: "",
          committerEmail: "",
          committerAt: 0,
        },
      ],
      refs: [],
      status: { kind: "ready" as const },
      generatedAt: Date.now(),
    }
    expect(() => assertSnapshotInvariants(snapshot)).toThrow(/Missing parent/)
  })

  test("normalize drops parents outside the loaded window", () => {
    const snapshot = normalizeSnapshot({
      worktree: "/tmp",
      repositoryRoot: "/tmp",
      head: { commitID: "a", detached: false },
      shallow: false,
      commits: [
        {
          id: "a",
          parents: ["missing"],
          subject: "x",
          authorName: "",
          authorEmail: "",
          authorAt: 0,
          committerName: "",
          committerEmail: "",
          committerAt: 0,
        },
      ],
      refs: [],
    })
    expect(snapshot.commits[0]?.parents).toEqual([])
    assertSnapshotInvariants(snapshot)
  })

  test("backup label prefers subject", () => {
    expect(
      backupLabel({
        id: "abcdef0",
        parents: [],
        subject: "Hello",
        authorName: "",
        authorEmail: "",
        authorAt: 0,
        committerName: "",
        committerEmail: "",
        committerAt: 0,
      }),
    ).toBe("Hello")
  })
})

describe("layout", () => {
  test("is deterministic for branched fixture", () => {
    const snapshot = fixtureSnapshot("branched")
    const a = layoutGraph(snapshot)
    const b = layoutGraph(snapshot)
    expect(a.commits.map((commit) => [commit.id, commit.lane, commit.row])).toEqual(
      b.commits.map((commit) => [commit.id, commit.lane, commit.row]),
    )
    expect(a.edges.length).toBeGreaterThan(0)
    expect(a.refs.some((ref) => ref.name === "feature")).toBe(true)
  })

  test("places newer commits above older commits", () => {
    const layout = layoutGraph(fixtureSnapshot("linear"))
    const rows = Object.fromEntries(layout.commits.map((commit) => [commit.id, commit.row]))
    expect(rows.c3!).toBeLessThan(rows.c2!)
    expect(rows.c2!).toBeLessThan(rows.c1!)
  })
})

describe("local source", () => {
  test("returns invalid for missing repository", async () => {
    const source = createLocalGitSource({
      worktree: "/path/does/not/exist",
      run: async () => ({ exitCode: 128, stdout: "", stderr: "not a git repository" }),
    })
    const snapshot = await source.refresh()
    expect(snapshot.status.kind).toBe("invalid")
  })

  test("reads mocked repository graph", async () => {
    const source = createLocalGitSource({
      worktree: "/repo",
      run: async (args) => {
        const key = args.join(" ")
        if (key.startsWith("rev-parse --show-toplevel")) {
          return { exitCode: 0, stdout: "/repo\n", stderr: "" }
        }
        if (key.startsWith("symbolic-ref")) {
          return { exitCode: 0, stdout: "main\n", stderr: "" }
        }
        if (key.startsWith("rev-parse --verify HEAD")) {
          return { exitCode: 0, stdout: "c2\n", stderr: "" }
        }
        if (key.startsWith("rev-parse --is-shallow-repository")) {
          return { exitCode: 0, stdout: "false\n", stderr: "" }
        }
        if (args[0] === "log") {
          const records = [
            ["c2", "c1", "Second", "A", "a@x", "2", "A", "a@x", "2"].join("\x1f"),
            ["c1", "", "First", "A", "a@x", "1", "A", "a@x", "1"].join("\x1f"),
          ]
          return { exitCode: 0, stdout: `${records.join("\x1e")}\x1e`, stderr: "" }
        }
        if (args[0] === "for-each-ref") {
          return { exitCode: 0, stdout: "c2\trefs/heads/main\n", stderr: "" }
        }
        return { exitCode: 1, stdout: "", stderr: `unexpected ${key}` }
      },
    })
    const snapshot = await source.refresh()
    expect(snapshot.status.kind).toBe("ready")
    expect(snapshot.commits).toHaveLength(2)
    assertSnapshotInvariants(snapshot)
  })
})
