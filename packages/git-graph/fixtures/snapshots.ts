import type { GitGraphCommit, GitGraphSnapshot } from "../src/domain/contract"
import { normalizeSnapshot } from "../src/domain/normalize"

function commit(
  id: string,
  parents: string[],
  subject: string,
  at: number,
): GitGraphCommit {
  return {
    id,
    parents,
    subject,
    authorName: "Ava",
    authorEmail: "ava@example.com",
    authorAt: at,
    committerName: "Ava",
    committerEmail: "ava@example.com",
    committerAt: at,
  }
}

const fixtures: Record<string, GitGraphSnapshot> = {
  linear: normalizeSnapshot({
    worktree: "fixture:linear",
    repositoryRoot: "fixture:linear",
    head: { commitID: "c3", branch: "main", detached: false },
    shallow: false,
    commits: [
      commit("c3", ["c2"], "Third backup", 3000),
      commit("c2", ["c1"], "Second backup", 2000),
      commit("c1", [], "First backup", 1000),
    ],
    refs: [
      { name: "main", kind: "local", commitID: "c3" },
      { name: "HEAD", kind: "head", commitID: "c3" },
    ],
  }),
  branched: normalizeSnapshot({
    worktree: "fixture:branched",
    repositoryRoot: "fixture:branched",
    head: { commitID: "c5", branch: "feature", detached: false },
    shallow: false,
    commits: [
      commit("c5", ["c4", "c3"], "Merge feature into mainline", 5000),
      commit("c4", ["c2"], "Feature work", 4000),
      commit("c3", ["c2"], "Hotfix on main", 3500),
      commit("c2", ["c1"], "Shared base", 2000),
      commit("c1", [], "Root backup", 1000),
    ],
    refs: [
      { name: "main", kind: "local", commitID: "c5" },
      { name: "feature", kind: "local", commitID: "c4" },
      { name: "main", kind: "remote", remote: "origin", commitID: "c3" },
      { name: "v1", kind: "tag", commitID: "c2" },
      { name: "HEAD", kind: "head", commitID: "c5" },
    ],
  }),
  empty: normalizeSnapshot({
    worktree: "fixture:empty",
    repositoryRoot: "fixture:empty",
    head: { detached: false },
    shallow: false,
    commits: [],
    refs: [],
    status: { kind: "empty" },
  }),
}

export function fixtureSnapshot(name: string): GitGraphSnapshot {
  return fixtures[name] ?? fixtures.branched!
}

export function fixtureNames() {
  return Object.keys(fixtures)
}
