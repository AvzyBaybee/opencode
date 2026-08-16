import { describe, expect, test } from "bun:test"
import type { GitGraphCommit } from "./contract"
import { cloudBackupIDs, withCloudFlags } from "./cloud"

describe("cloud backup flags", () => {
  test("marks a remote tip and its ancestors", () => {
    const commits = [
      commit("c2", ["c1"]),
      commit("c1", ["c0"]),
      commit("c0", []),
      commit("s1", ["c1"]),
    ]
    const onCloud = cloudBackupIDs(commits, ["c1"])
    expect([...onCloud].sort()).toEqual(["c0", "c1"])
  })

  test("marks every backup as on disk when there are no remotes", () => {
    const flagged = withCloudFlags([commit("c1", ["c0"]), commit("c0", [])], [])
    expect(flagged.every((item) => item.onCloud === false)).toBe(true)
  })

  test("does not treat a newer local backup as on the cloud", () => {
    const flagged = withCloudFlags(
      [commit("c2", ["c1"]), commit("c1", ["c0"]), commit("c0", [])],
      ["c1"],
    )
    expect(flagged.find((item) => item.id === "c2")?.onCloud).toBe(false)
    expect(flagged.find((item) => item.id === "c1")?.onCloud).toBe(true)
  })
})

function commit(id: string, parents: string[]): GitGraphCommit {
  return {
    id,
    parents,
    subject: id,
    authorName: "Ava",
    authorEmail: "ava@example.com",
    authorAt: 1,
    committerName: "Ava",
    committerEmail: "ava@example.com",
    committerAt: 1,
  }
}
