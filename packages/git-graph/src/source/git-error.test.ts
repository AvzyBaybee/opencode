import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import { explainGitFailure, overwritePrompt, parseOverwriteFiles } from "./git-error"
import { explainInProgress } from "./git-in-progress"

describe("git failure copy", () => {
  test("explains a clean working tree on backup", () => {
    expect(
      explainGitFailure("commit", "On branch Custom\nnothing to commit, working tree clean\n", "").message,
    ).toBe("No files have changed since the last backup, so there's nothing to backup.")
  })

  test("lists unbacked-up files that a switch would overwrite", () => {
    const stderr = `error: Your local changes to the following files would be overwritten by checkout:
	notes.txt
	src/app.ts
Please commit your changes or stash them before you switch branches.
Aborting`
    const result = explainGitFailure("switch", "", stderr)
    expect(result.overwrite).toBe(true)
    expect(result.overwriteFiles).toEqual(["notes.txt", "src/app.ts"])
    expect(result.message).toBe(
      "You have changes to notes.txt and src/app.ts that you haven't backed up. If you switch to another backup, they will be overwritten.",
    )
  })

  test("falls back to a cleaned git line", () => {
    expect(explainGitFailure("delete", "", "fatal: ambiguous argument 'abc'").message).toBe(
      "There was an error: ambiguous argument 'abc'",
    )
  })

  test("maps identity, lock, and disk-full failures", () => {
    expect(explainGitFailure("commit", "", "fatal: please tell me who you are").message).toBe(
      "You need a name & email address to create a backup.",
    )
    expect(explainGitFailure("commit", "", "fatal: Unable to write new index file").message).toBe(
      "The file is locked. Is it in use somewhere else? Is there permission issues? Is it read-only?",
    )
    expect(explainGitFailure("commit", "", "fatal: no space left on device").message).toBe(
      "Your disk is full. There's no space to make a backup.",
    )
  })
})

describe("overwrite copy", () => {
  test("uses it for one file and an oxford list for three", () => {
    expect(parseOverwriteFiles("error: would be overwritten by checkout:\n\ta\n\tb\n\tc\nAborting")).toEqual(["a", "b", "c"])
    expect(overwritePrompt(["notes.txt"])).toEqual({
      body: "You have changes to notes.txt that you haven't backed up. If you switch to another backup, it will be overwritten.",
      question: "Do you want to overwrite it, or do you want to back it up?",
      backup: "Back it up",
      overwrite: "Overwrite",
    })
    expect(overwritePrompt(["a", "b", "c"]).body).toBe(
      "You have changes to a, b, and c that you haven't backed up. If you switch to another backup, they will be overwritten.",
    )
  })
})

describe("in-progress git operations", () => {
  test("names the unfinished operation from git-dir files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "git-graph-"))
    await writeFile(join(dir, "CHERRY_PICK_HEAD"), "abc")
    expect(explainInProgress(dir)).toBe(
      "Can't make a backup. Your backup system is in the middle of doing something else. Wait and try again in a moment, or figure out what it's doing and cancel it.",
    )
  })
})
