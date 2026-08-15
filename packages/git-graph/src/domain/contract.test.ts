import { describe, expect, test } from "bun:test"
import { parseCommitRecords, parseRefLines, COMMIT_FORMAT } from "../source/parse"
import { assertSnapshotInvariants, normalizeSnapshot } from "./normalize"
import { backupLabel } from "./contract"
import type { GitGraphCommit } from "./contract"
import { layoutGraph, wrapText } from "../layout"
import { colorForLane } from "../render/lane-color"
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
    expect(a.commits.map((commit) => [commit.id, commit.lane, commit.row, commit.cardHeight])).toEqual(
      b.commits.map((commit) => [commit.id, commit.lane, commit.row, commit.cardHeight]),
    )
    expect(a.edges.length).toBeGreaterThan(0)
    expect(a.commits.some((commit) => commit.branches.includes("feature"))).toBe(true)
  })

  test("places newer commits above older commits", () => {
    const layout = layoutGraph(fixtureSnapshot("linear"))
    const rows = Object.fromEntries(layout.commits.map((commit) => [commit.id, commit.row]))
    expect(rows.c3!).toBeLessThan(rows.c2!)
    expect(rows.c2!).toBeLessThan(rows.c1!)
  })

  test("keeps a fixed card width and centers the stem", () => {
    const layout = layoutGraph(fixtureSnapshot("branched"))
    for (const commit of layout.commits) {
      expect(commit.cardWidth).toBe(260)
      expect(commit.cardHeight).toBe(40)
      expect(commit.x).toBe(commit.cardLeft + commit.cardWidth / 2)
      expect(commit.y).toBe(commit.cardTop + commit.cardHeight / 2)
    }
  })

  test("does not leave empty gaps on one lane for commits on another lane", () => {
    const layout = layoutGraph(fixtureSnapshot("branched"))
    const main = layout.commits.filter((commit) => commit.lane === 0).sort((a, b) => a.cardTop - b.cardTop)
    expect(main.length).toBeGreaterThan(1)
    for (let index = 1; index < main.length; index++) {
      const previous = main[index - 1]!
      const current = main[index]!
      const gap = current.cardTop - (previous.cardTop + previous.cardHeight)
      expect(gap).toBeLessThanOrEqual(30)
      expect(gap).toBeGreaterThanOrEqual(20)
    }
  })

  test("keeps a linear history on one lane even when parent and child share a timestamp", () => {
    const layout = layoutGraph({
      ...fixtureSnapshot("linear"),
      commits: [
        {
          id: "child",
          parents: ["parent"],
          subject: "child backup",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 1000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 1000,
        },
        {
          id: "parent",
          parents: [],
          subject: "parent backup",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 1000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 1000,
        },
      ],
      refs: [{ name: "main", kind: "local", commitID: "child" }],
      head: { commitID: "child", branch: "main", detached: false },
    })
    expect(new Set(layout.commits.map((commit) => commit.lane)).size).toBe(1)
    expect(layout.commits.find((commit) => commit.id === "child")!.cardTop).toBeLessThan(
      layout.commits.find((commit) => commit.id === "parent")!.cardTop,
    )
  })

  test("truncates long backup names to one line on a standard card", () => {
    const layout = layoutGraph({
      ...fixtureSnapshot("linear"),
      commits: [
        {
          id: "long",
          parents: [],
          subject: "Added a very long backup title that should wrap across multiple lines instead of truncating",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 1000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 1000,
        },
      ],
      refs: [{ name: "main", kind: "local", commitID: "long" }],
      head: { commitID: "long", branch: "main", detached: false },
    })
    expect(layout.commits[0]!.lines).toHaveLength(1)
    expect(layout.commits[0]!.lines[0]!.endsWith("…")).toBe(true)
    expect(new Set(layout.commits.map((commit) => commit.cardHeight)).size).toBe(1)
  })

  test("wraps a long token at a slash instead of leaving one letter behind", () => {
    const lines = wrapText("github.com:anomalyco/opencode", 176, 12)
    expect(lines.some((line) => line === "e")).toBe(false)
    expect(lines.join("")).toBe("github.com:anomalyco/opencode")
    expect(lines.some((line) => line.includes("opencode"))).toBe(true)
  })

  test("forks out the side of a card and merges into a new backup", () => {
    const layout = layoutGraph(fixtureSnapshot("branched"))
    const fork = layout.edges.find((edge) => edge.kind === "fork")
    const merge = layout.edges.find((edge) => edge.kind === "merge")
    const parent = layout.commits.find((commit) => commit.id === fork?.to)
    const child = layout.commits.find((commit) => commit.id === fork?.from)
    const mergeCommit = layout.commits.find((commit) => commit.id === "c5")
    expect(fork).toBeDefined()
    expect(merge).toBeDefined()
    expect(parent).toBeDefined()
    expect(child).toBeDefined()
    expect(Math.abs(child!.y - parent!.y)).toBeLessThan(8)
    expect(fork!.points[0]!.x).toBe(parent!.cardLeft + parent!.cardWidth)
    expect(fork!.points.at(-1)!.x).toBe(child!.cardLeft)
    expect(merge!.points.at(-1)!.x).toBe(mergeCommit!.cardLeft + mergeCommit!.cardWidth)
    expect(collinearOverlaps(layout)).toEqual([])
  })

  test("keeps fork and merge routes orthogonal and on card sides", () => {
    const layout = layoutGraph(fixtureSnapshot("branched"))
    const byId = new Map(layout.commits.map((commit) => [commit.id, commit]))
    for (const edge of layout.edges) {
      for (let index = 0; index < edge.points.length - 1; index++) {
        const start = edge.points[index]!
        const end = edge.points[index + 1]!
        expect(start.x === end.x || start.y === end.y).toBe(true)
      }
      if (edge.kind === "continue") continue
      const parent = byId.get(edge.to)!
      const child = byId.get(edge.from)!
      const first = edge.points[0]!
      const last = edge.points.at(-1)!
      expect(onCardSide(first, parent)).toBe(true)
      expect(onCardSide(last, child)).toBe(true)
      expect(first.y).toBeGreaterThanOrEqual(parent.cardTop)
      expect(first.y).toBeLessThanOrEqual(parent.cardTop + parent.cardHeight)
      expect(last.y).toBeGreaterThanOrEqual(child.cardTop)
      expect(last.y).toBeLessThanOrEqual(child.cardTop + child.cardHeight)
      const second = edge.points[1]!
      const prev = edge.points.at(-2)!
      expect(first.y).toBe(second.y)
      expect(last.y).toBe(prev!.y)
    }
  })

  test("gives overlapping fork and merge events separate gutters", () => {
    const layout = layoutGraph({
      ...fixtureSnapshot("linear"),
      commits: [
        {
          id: "m4",
          parents: ["m3", "s3"],
          subject: "second merge",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 8000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 8000,
        },
        {
          id: "m3",
          parents: ["m2"],
          subject: "main after first merge",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 7000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 7000,
        },
        {
          id: "s3",
          parents: ["s2"],
          subject: "more feature",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 6500,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 6500,
        },
        {
          id: "m2",
          parents: ["m1", "s1"],
          subject: "first merge",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 5000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 5000,
        },
        {
          id: "s2",
          parents: ["s1"],
          subject: "feature middle",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 4500,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 4500,
        },
        {
          id: "s1",
          parents: ["m0"],
          subject: "feature start",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 3000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 3000,
        },
        {
          id: "m1",
          parents: ["m0"],
          subject: "main continues",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 2500,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 2500,
        },
        {
          id: "m0",
          parents: [],
          subject: "root",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 1000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 1000,
        },
      ],
      refs: [
        { name: "main", kind: "local", commitID: "m4" },
        { name: "feature", kind: "local", commitID: "s3" },
      ],
      head: { commitID: "m4", branch: "main", detached: false },
    })
    const gutters = layout.edges.filter((edge) => edge.kind !== "continue")
    expect(gutters.length).toBeGreaterThan(1)
    const verticals = gutters.flatMap((edge) =>
      edge.points.slice(0, -1).flatMap((start, index) => {
        const end = edge.points[index + 1]!
        if (Math.abs(end.y - start.y) < 16 || Math.abs(end.y - start.y) < Math.abs(end.x - start.x)) return []
        return [{ key: edge.key, x: start.x, y0: Math.min(start.y, end.y), y1: Math.max(start.y, end.y) }]
      }),
    )
    for (let index = 0; index < verticals.length; index++) {
      const left = verticals[index]!
      for (const right of verticals.slice(index + 1)) {
        if (left.key === right.key) continue
        if (left.y1 < right.y0 + 12 || right.y1 < left.y0 + 12) continue
        expect(Math.abs(left.x - right.x)).toBeGreaterThanOrEqual(16)
      }
    }
    const horizontals = layout.edges.flatMap((edge) =>
      edge.points.slice(0, -1).flatMap((start, index) => {
        const end = edge.points[index + 1]!
        if (Math.abs(end.x - start.x) < 24 || Math.abs(end.x - start.x) < Math.abs(end.y - start.y)) return []
        return [{ key: edge.key, y: start.y, x0: Math.min(start.x, end.x), x1: Math.max(start.x, end.x) }]
      }),
    )
    for (let index = 0; index < horizontals.length; index++) {
      const left = horizontals[index]!
      for (const right of horizontals.slice(index + 1)) {
        if (left.key === right.key) continue
        if (Math.abs(left.y - right.y) >= 8) continue
        if (left.x1 < right.x0 + 16 || right.x1 < left.x0 + 16) continue
        expect(left.y).not.toBe(right.y)
      }
    }
    expect(collinearOverlaps(layout)).toEqual([])
  })

  test("keeps a merge off the fork's horizontal instead of riding it", () => {
    const person = {
      authorName: "Ava",
      authorEmail: "ava@example.com",
      committerName: "Ava",
      committerEmail: "ava@example.com",
    }
    const layout = layoutGraph({
      ...fixtureSnapshot("linear"),
      commits: [
        { id: "m3", parents: ["m2", "f1"], subject: "merge", authorAt: 5000, committerAt: 5000, ...person },
        { id: "m2", parents: ["m1"], subject: "main mid", authorAt: 4000, committerAt: 4000, ...person },
        { id: "f1", parents: ["m1"], subject: "fix", authorAt: 3500, committerAt: 3500, ...person },
        { id: "m1", parents: ["m0"], subject: "check", authorAt: 3000, committerAt: 3000, ...person },
        { id: "m0", parents: [], subject: "root", authorAt: 1000, committerAt: 1000, ...person },
      ],
      refs: [
        { name: "main", kind: "local", commitID: "m3" },
        { name: "feature", kind: "local", commitID: "f1" },
      ],
      head: { commitID: "m3", branch: "main", detached: false },
    })
    const fork = layout.edges.find((edge) => edge.kind === "fork")
    const merge = layout.edges.find((edge) => edge.kind === "merge")
    expect(fork).toBeDefined()
    expect(merge).toBeDefined()
    expect(collinearOverlaps(layout)).toEqual([])
    const mergeYs = new Set(
      merge!.points.slice(0, -1).flatMap((start, index) => {
        const end = merge!.points[index + 1]!
        if (start.y !== end.y) return []
        if (Math.abs(end.x - start.x) < 40) return []
        return [start.y]
      }),
    )
    const forkYs = new Set(
      fork!.points.slice(0, -1).flatMap((start, index) => {
        const end = fork!.points[index + 1]!
        if (start.y !== end.y) return []
        return [start.y]
      }),
    )
    for (const y of mergeYs) {
      for (const other of forkYs) {
        expect(Math.abs(y - other)).toBeGreaterThanOrEqual(8)
      }
    }
  })

  test("does not hold a corridor open for every historical fork", () => {
    const person = {
      authorName: "Ava",
      authorEmail: "ava@example.com",
      committerName: "Ava",
      committerEmail: "ava@example.com",
    }
    const commits: GitGraphCommit[] = [
      {
        id: "m0",
        parents: [],
        subject: "root",
        authorAt: 1000,
        committerAt: 1000,
        ...person,
      },
    ]
    for (let step = 1; step <= 8; step++) {
      commits.push({
        id: `f${step}`,
        parents: [`m${step - 1}`],
        subject: `fork ${step}`,
        authorAt: 1000 + step * 1000 - 200,
        committerAt: 1000 + step * 1000 - 200,
        ...person,
      })
      commits.push({
        id: `m${step}`,
        parents: [`m${step - 1}`, `f${step}`],
        subject: `merge ${step}`,
        authorAt: 1000 + step * 1000,
        committerAt: 1000 + step * 1000,
        ...person,
      })
    }
    const layout = layoutGraph({
      ...fixtureSnapshot("linear"),
      commits,
      refs: [{ name: "main", kind: "local", commitID: "m8" }],
      head: { commitID: "m8", branch: "main", detached: false },
    })
    const main = layout.commits.find((commit) => commit.id === "m8")!
    const neighbor = layout.commits.find((commit) => commit.lane === main.lane + 1)
    expect(neighbor).toBeDefined()
    expect(neighbor!.cardLeft - (main.cardLeft + main.cardWidth)).toBeLessThan(100)
  })

  test("lets a later fork sit in a column an earlier short branch has left", () => {
    const person = {
      authorName: "Ava",
      authorEmail: "ava@example.com",
      committerName: "Ava",
      committerEmail: "ava@example.com",
    }
    const commits: GitGraphCommit[] = [
      { id: "m0", parents: [], subject: "root", authorAt: 1000, committerAt: 1000, ...person },
    ]
    for (let step = 1; step <= 6; step++) {
      commits.push({
        id: `m${step}`,
        parents: [`m${step - 1}`],
        subject: `main ${step}`,
        authorAt: 1000 + step * 1000,
        committerAt: 1000 + step * 1000,
        ...person,
      })
    }
    for (let step = 4; step <= 6; step++) {
      commits.push({
        id: `early${step}`,
        parents: [`m${step}`],
        subject: `early ${step}`,
        authorAt: 1000 + step * 1000 + 100,
        committerAt: 1000 + step * 1000 + 100,
        ...person,
      })
    }
    commits.push({
      id: "late",
      parents: ["m1"],
      subject: "late fork",
      authorAt: 1500,
      committerAt: 1500,
      ...person,
    })
    const layout = layoutGraph({
      ...fixtureSnapshot("linear"),
      commits,
      refs: [{ name: "main", kind: "local", commitID: "m6" }],
      head: { commitID: "m6", branch: "main", detached: false },
    })
    const main = layout.commits.find((commit) => commit.id === "m1")!
    const late = layout.commits.find((commit) => commit.id === "late")!
    expect(main.lane).toBe(0)
    expect(late.lane).toBeGreaterThanOrEqual(1)
    expect(late.cardLeft).toBeGreaterThan(main.cardLeft)
  })

  test("keeps branch, tag, and remote labels distinct", () => {
    const layout = layoutGraph(fixtureSnapshot("branched"))
    const kinds = layout.commits.flatMap((commit) => commit.labels.map((label) => label.kind))
    expect(kinds).toContain("local")
    expect(kinds).toContain("tag")
    expect(kinds).toContain("remote")
    expect(layout.commits.some((commit) => commit.labels.some((label) => label.name === "v1"))).toBe(true)
    expect(layout.commits.some((commit) => commit.labels.some((label) => label.name === "origin/main"))).toBe(true)
  })

  test("places an older independent tip below a newer one", () => {
    const layout = layoutGraph({
      ...fixtureSnapshot("linear"),
      commits: [
        {
          id: "newer",
          parents: [],
          subject: "newer tip",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 3000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 3000,
        },
        {
          id: "older",
          parents: [],
          subject: "older tip",
          authorName: "Ava",
          authorEmail: "ava@example.com",
          authorAt: 1000,
          committerName: "Ava",
          committerEmail: "ava@example.com",
          committerAt: 1000,
        },
      ],
      refs: [
        { name: "Custom", kind: "local", commitID: "newer" },
        { name: "Official", kind: "local", commitID: "older" },
      ],
      head: { commitID: "newer", branch: "Custom", detached: false },
    })
    const newer = layout.commits.find((commit) => commit.id === "newer")!
    const older = layout.commits.find((commit) => commit.id === "older")!
    expect(older.cardTop).toBeGreaterThan(newer.cardTop)
    expect(newer.lane).not.toBe(older.lane)
    expect(newer.lane).toBe(0)
    expect(older.cardLeft).toBeGreaterThan(newer.cardLeft)
  })
})

function onCardSide(point: { x: number; y: number }, commit: { cardLeft: number; cardWidth: number }) {
  return point.x === commit.cardLeft || point.x === commit.cardLeft + commit.cardWidth
}

function collinearOverlaps(layout: { edges: readonly { key: string; kind: string; points: readonly { x: number; y: number }[] }[] }) {
  const segments = layout.edges
    .filter((edge) => edge.kind !== "continue")
    .flatMap((edge) =>
      edge.points.slice(0, -1).map((start, index) => ({
        key: edge.key,
        start,
        end: edge.points[index + 1]!,
      })),
    )
  return segments.flatMap((left, index) =>
    segments.slice(index + 1).flatMap((right) => {
      if (left.key === right.key) return []
      const leftDx = left.end.x - left.start.x
      const leftDy = left.end.y - left.start.y
      const rightDx = right.end.x - right.start.x
      const rightDy = right.end.y - right.start.y
      const leftH = Math.abs(leftDx) >= Math.abs(leftDy)
      const rightH = Math.abs(rightDx) >= Math.abs(rightDy)
      if (leftH !== rightH) return []
      if (leftH) {
        if (Math.abs(left.start.y - right.start.y) >= 8) return []
        const overlap =
          Math.min(Math.max(left.start.x, left.end.x), Math.max(right.start.x, right.end.x)) -
          Math.max(Math.min(left.start.x, left.end.x), Math.min(right.start.x, right.end.x))
        if (overlap <= 4) return []
        return [`${left.key} x ${right.key}`]
      }
      if (Math.abs(left.start.x - right.start.x) >= 8) return []
      const overlap =
        Math.min(Math.max(left.start.y, left.end.y), Math.max(right.start.y, right.end.y)) -
        Math.max(Math.min(left.start.y, left.end.y), Math.min(right.start.y, right.end.y))
      if (overlap <= 4) return []
      return [`${left.key} x ${right.key}`]
    }),
  )
}

describe("lane colors", () => {
  test("keeps consecutive lane hues far apart", () => {
    const hue = (color: string) => Number(color.slice(color.indexOf("(") + 1, color.indexOf(" ")))
    const a = hue(colorForLane(0))
    const b = hue(colorForLane(1))
    const delta = Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
    expect(delta).toBeGreaterThan(100)
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
          expect(args).toContain("--max-count=-1")
          const records = [
            ["c2", "c1", "Second", "A", "a@x", "2", "A", "a@x", "2"].join("\x1f"),
            ["c1", "", "First", "A", "a@x", "1", "A", "a@x", "1"].join("\x1f"),
          ]
          return { exitCode: 0, stdout: `${records.join("\x1e")}\x1e`, stderr: "" }
        }
        if (args[0] === "rev-list") {
          return { exitCode: 0, stdout: "", stderr: "" }
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
