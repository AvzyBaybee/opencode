import type { GitCommitID, GitGraphCommit } from "./contract"

export function cloudBackupIDs(commits: readonly GitGraphCommit[], remoteTips: readonly string[]) {
  const byID = new Map(commits.map((commit) => [commit.id, commit]))
  const onCloud = new Set<GitCommitID>()
  const stack = [...remoteTips]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (onCloud.has(id)) continue
    onCloud.add(id)
    const commit = byID.get(id)
    if (!commit) continue
    for (const parent of commit.parents) stack.push(parent)
  }
  return onCloud
}

export function withCloudFlags(commits: readonly GitGraphCommit[], remoteTips: readonly string[]) {
  if (remoteTips.length === 0) {
    return commits.map((commit) => ({ ...commit, onCloud: false }))
  }
  const onCloud = cloudBackupIDs(commits, remoteTips)
  return commits.map((commit) => ({ ...commit, onCloud: onCloud.has(commit.id) }))
}
