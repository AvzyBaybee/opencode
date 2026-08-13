export type GitGraphCopy = {
  readonly title: string
  readonly openRepository: string
  readonly openHint: string
  readonly pathPlaceholder: string
  readonly empty: string
  readonly unborn: string
  readonly invalid: string
  readonly loading: string
  readonly error: string
  readonly stale: string
  readonly unsupported: string
  readonly selectRepository: string
  readonly noSelection: string
  readonly detachedHead: string
  readonly pathSameThread: string
  readonly pathFork: string
  readonly pathMerge: string
  readonly pathGrewFrom: string
  readonly pathBranchedOff: string
  readonly pathJoined: string
  readonly branchOff: string
  readonly restoreBackup: string
  readonly deleteBackup: string
  readonly confirmDelete: string
  readonly confirmRewind: string
  readonly createThread: string
  readonly threadName: string
  readonly cancel: string
}

export const en: GitGraphCopy = {
  title: "Backups",
  openRepository: "Open",
  openHint: "Paste the full path to a folder that contains a .git directory, then press Enter.",
  pathPlaceholder: "C:\\path\\to\\your\\project",
  empty: "No backups yet",
  unborn: "Branch has no commits yet",
  invalid: "Not a git repository",
  loading: "Loading backups…",
  error: "Could not read git history",
  stale: "History may be out of date",
  unsupported: "Repository type is unsupported",
  selectRepository: "Choose a repository to visualize",
  noSelection: "Select a backup",
  detachedHead: "You are here, with no branch name",
  pathSameThread: "Same thread",
  pathFork: "Branch off",
  pathMerge: "Merge",
  pathGrewFrom: "grew from",
  pathBranchedOff: "branched off",
  pathJoined: "joined",
  branchOff: "Create branch",
  restoreBackup: "Switch",
  deleteBackup: "Reset",
  confirmDelete: "Reset this backup?",
  confirmRewind: "This will delete all backups past this point on this thread. This backup stays.",
  createThread: "Create",
  threadName: "Branch name",
  cancel: "Cancel",
}

export function statusMessage(copy: GitGraphCopy, kind: string, fallback?: string) {
  if (kind === "empty") return copy.empty
  if (kind === "unborn") return copy.unborn
  if (kind === "invalid") return copy.invalid
  if (kind === "loading") return copy.loading
  if (kind === "error") return fallback || copy.error
  if (kind === "stale") return fallback || copy.stale
  if (kind === "unsupported") return fallback || copy.unsupported
  return fallback || ""
}
