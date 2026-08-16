import { existsSync } from "node:fs"
import { join } from "node:path"

const IN_PROGRESS =
  "Can't make a backup. Your backup system is in the middle of doing something else. Wait and try again in a moment, or figure out what it's doing and cancel it."

export function explainInProgress(gitDir: string) {
  if (existsSync(join(gitDir, "CHERRY_PICK_HEAD")) || existsSync(join(gitDir, "REVERT_HEAD")) || existsSync(join(gitDir, "index.lock"))) {
    return IN_PROGRESS
  }
}
