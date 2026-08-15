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
  readonly mergeBackups: string
  readonly mergeName: string
  readonly mergeHint: string
  readonly confirmMerge: string
  readonly confirmMergeTitle: string
  readonly moveBranchTo: string
  readonly confirmMove: string
  readonly deleteBackup: string
  readonly confirmDelete: string
  readonly confirmDeleteLater: string
  readonly createThread: string
  readonly threadName: string
  readonly cancel: string
  readonly createBackup: string
  readonly backupName: string
  readonly goToHead: string
  readonly noBranch: string
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
  restoreBackup: "Restore backup",
  mergeBackups: "Merge",
  mergeName: "Merged backup name",
  mergeHint: "Click consecutive backups on this thread, then Merge.",
  confirmMerge: "Merge these backups into one? This cannot be undone from here.",
  confirmMergeTitle: "Merge backups",
  moveBranchTo: "Move branch to",
  confirmMove: "This branch’s backups will sit on top of the one you pick. This branch name is then removed.",
  deleteBackup: "Delete",
  confirmDelete: "Delete this backup? You will land on the backup before it.",
  confirmDeleteLater: "This backup and every newer one on this thread will be deleted. You will land on the backup before this.",
  createThread: "Create",
  threadName: "Branch name",
  cancel: "Cancel",
  createBackup: "Create backup",
  backupName: "Backup name",
  goToHead: "Go to most recent backup",
  noBranch: "No branch name",
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
