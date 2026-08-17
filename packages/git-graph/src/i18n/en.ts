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
  readonly moveChoose: string
  readonly moveNeedsName: string
  readonly conflictEditHint: string
  readonly deleteBackup: string
  readonly confirmDelete: string
  readonly confirmDeleteLater: string
  readonly createThread: string
  readonly threadName: string
  readonly cancel: string
  readonly createBackup: string
  readonly savingBackup: string
  readonly backupName: string
  readonly backupCloud: string
  readonly backupDisk: string
  readonly goToHead: string
  readonly noBranch: string
  readonly noGit: string
  readonly makeGit: string
  readonly createRepository: string
  readonly firstThreadName: string
  readonly renameBranch: string
  readonly pushAllToCloud: string
  readonly pushingCloud: string
  readonly searchBackups: string
  readonly searchPlaceholder: string
}

export const en: GitGraphCopy = {
  title: "Backups",
  openRepository: "Open",
  openHint: "Paste the full path to a folder that contains a .git directory, then press Enter.",
  pathPlaceholder: "C:\\path\\to\\your\\project",
  empty: "No backups yet. Create one to get started.",
  unborn: "No backups yet. Create one to get started.",
  invalid: "This folder has no Git repository. Would you like to make one?",
  loading: "Loading backups…",
  error: "Could not read git history",
  stale: "History may be out of date",
  unsupported: "Repository type is unsupported",
  selectRepository: "Choose a repository to visualize",
  noSelection: "Select a backup",
  detachedHead: "You are here, with no branch name",
  pathSameThread: "Same branch",
  pathFork: "Branch off",
  pathMerge: "Merge",
  pathGrewFrom: "grew from",
  pathBranchedOff: "branched off",
  pathJoined: "joined",
  branchOff: "Create branch",
  restoreBackup: "Restore backup",
  mergeBackups: "Squash",
  mergeName: "Squashed backup name",
  mergeHint: "Click consecutive backups on this branch, then Squash.",
  confirmMerge: "Squash these backups into one? This cannot be undone from here.",
  confirmMergeTitle: "Squash backups",
  moveBranchTo: "Move branch to",
  confirmMove: "Move this branch to sit on top of another branch, instead of where it currently is.",
  moveChoose: "Choose another branch to move this to.",
  moveNeedsName: "In order to move this branch, you need to give it a name.",
  conflictEditHint: "Edit the files, then click Done.",
  deleteBackup: "Delete",
  confirmDelete: "Delete this backup? You will land on the backup before it.",
  confirmDeleteLater: "This backup and every newer one on this branch will be deleted. You will land on the backup before this.",
  createThread: "Create",
  threadName: "Branch name",
  cancel: "Cancel",
  createBackup: "Create backup",
  savingBackup: "Saving backup…",
  backupName: "Backup name",
  backupCloud: "Cloud",
  backupDisk: "Disk",
  goToHead: "Go to most recent backup",
  noBranch: "No branch name",
  noGit: "This folder has no Git repository. Would you like to make one?",
  makeGit: "Create",
  createRepository: "Create a repository",
  firstThreadName: "name your repository",
  renameBranch: "Rename",
  pushAllToCloud: "Push all backups to cloud",
  pushingCloud: "Pushing backups to cloud…",
  searchBackups: "Search backups",
  searchPlaceholder: "Backup name",
}

export function statusMessage(copy: GitGraphCopy, kind: string, fallback?: string) {
  if (kind === "empty") return copy.empty
  if (kind === "unborn") return copy.unborn
  if (kind === "invalid") return copy.invalid
  if (kind === "loading") return copy.loading
  if (kind === "error") {
    if (!fallback) return "There was an error."
    const line = fallback.trim().replace(/^(fatal|error):\s*/i, "")
    return line ? `There was an error: ${line}` : "There was an error."
  }
  if (kind === "stale") return fallback || copy.stale
  if (kind === "unsupported") return fallback || copy.unsupported
  return fallback || ""
}
