import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import { bunGitRunner } from "./local"

describe("bun git runner", () => {
  test("runs git from PATH or the usual Windows install location", async () => {
    const result = await bunGitRunner(["--version"], process.cwd())
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("git version")
  })

  test("explains a missing working folder instead of a generic spawn failure", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "git-graph-cwd-")), "missing")
    const result = await bunGitRunner(["--version"], dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("The folder does not exist")
  })
})
