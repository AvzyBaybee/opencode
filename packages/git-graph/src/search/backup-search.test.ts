import { describe, expect, test } from "bun:test"
import type { GitGraphCommit } from "../domain/contract"
import { fuzzyScore, rankBackups } from "./backup-search"

describe("backup search", () => {
  test("ranks a substring above a scattered fuzzy match", () => {
    const hits = rankBackups(
      [commit("a", "fix login button"), commit("b", "flatten logs in nightly")],
      "login button",
    )
    expect(hits[0]?.id).toBe("a")
  })

  test("matches letters in order when the full phrase is not there", () => {
    expect(fuzzyScore("fsh", "finish the search")).toBeGreaterThan(0)
    expect(fuzzyScore("fsh", "shape")).toBe(-1)
  })

  test("caps the result list", () => {
    const commits = Array.from({ length: 80 }, (_, index) => commit(`c${index}`, `backup ${index} note`))
    expect(rankBackups(commits, "backup", 12)).toHaveLength(12)
  })
})

function commit(id: string, subject: string): GitGraphCommit {
  return {
    id,
    parents: [],
    subject,
    authorName: "Ava",
    authorEmail: "ava@example.com",
    authorAt: 1,
    committerName: "Ava",
    committerEmail: "ava@example.com",
    committerAt: 1,
  }
}
