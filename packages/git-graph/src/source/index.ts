export { createLocalGitSource, bunGitRunner } from "./local"
export type { GitRunner, LocalGitSourceOptions, GitGraphScope } from "./local"
export { createOpenCodeGitSource } from "./opencode"
export { explainGitFailure, overwritePrompt, conflictPrompt } from "./git-error"
export { explainInProgress } from "./git-in-progress"
export {
  canDeleteBackup,
  canMoveCurrentBranch,
  canStartMerge,
  expandMergeRange,
  hasLaterBackups,
  localBranchNames,
  moveTargets,
  planGitAction,
  branchNameProblem,
  sanitizeBranchName,
} from "./actions"
export type { GitActionKind, GitPlan } from "./actions"
