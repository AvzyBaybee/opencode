export type GitGraphCopy = {
  readonly title: string
  readonly openRepository: string
  readonly refresh: string
  readonly themeToggle: string
  readonly empty: string
  readonly unborn: string
  readonly invalid: string
  readonly loading: string
  readonly error: string
  readonly stale: string
  readonly unsupported: string
  readonly selectRepository: string
  readonly useFixture: string
  readonly noSelection: string
  readonly detachedHead: string
}

export const en: GitGraphCopy = {
  title: "Backups",
  openRepository: "Open repository",
  refresh: "Refresh",
  themeToggle: "Toggle theme",
  empty: "No backups yet",
  unborn: "Branch has no commits yet",
  invalid: "Not a git repository",
  loading: "Loading backups…",
  error: "Could not read git history",
  stale: "History may be out of date",
  unsupported: "Repository type is unsupported",
  selectRepository: "Choose a repository to visualize",
  useFixture: "Open sample repository",
  noSelection: "Select a backup",
  detachedHead: "Detached HEAD",
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
