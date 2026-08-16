import { existsSync } from "node:fs"
import { join } from "node:path"
import type { GitRunner } from "./local"

export type ConflictHow = "abort" | "keep-this" | "keep-other" | "edited"

export function conflictKind(gitDir: string) {
  if (existsSync(join(gitDir, "MERGE_HEAD"))) return "merge"
  if (existsSync(join(gitDir, "REBASE_HEAD")) || existsSync(join(gitDir, "rebase-merge")) || existsSync(join(gitDir, "rebase-apply"))) {
    return "rebase"
  }
}

export async function unmergedFiles(run: GitRunner, worktree: string) {
  const result = await run(["diff", "--name-only", "--diff-filter=U"], worktree)
  if (result.exitCode !== 0 && !result.stdout.trim()) return []
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export async function resolveConflict(run: GitRunner, worktree: string, gitDir: string, how: ConflictHow) {
  const kind = conflictKind(gitDir)
  if (!kind) return { exitCode: 1, stdout: "", stderr: "No clash is in progress." }
  if (how === "abort") {
    if (kind === "rebase") return run(["rebase", "--abort"], worktree)
    return run(["merge", "--abort"], worktree)
  }
  if (how === "keep-this" || how === "keep-other") {
    const side = kind === "rebase" ? (how === "keep-this" ? "--theirs" : "--ours") : how === "keep-this" ? "--ours" : "--theirs"
    const checkout = await run(["checkout", side, "--", "."], worktree)
    if (checkout.exitCode !== 0) return checkout
  }
  const add = await run(["add", "-A"], worktree)
  if (add.exitCode !== 0) return add
  if (kind === "rebase") {
    const editor = process.platform === "win32" ? "cmd.exe /c exit 0" : "true"
    return run(["rebase", "--continue"], worktree, { GIT_EDITOR: editor, GIT_SEQUENCE_EDITOR: editor })
  }
  const commit = await run(["commit", "--no-edit"], worktree)
  if (commit.exitCode === 0) return commit
  return run(["commit", "-m", "Merge"], worktree)
}
