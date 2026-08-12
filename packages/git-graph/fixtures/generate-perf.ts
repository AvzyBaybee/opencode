import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { GitGraphCommit, GitGraphSnapshot } from "../src/domain/contract"
import { normalizeSnapshot } from "../src/domain/normalize"
import { layoutGraph } from "../src/layout"

const outDir = join(import.meta.dir, "perf")
mkdirSync(outDir, { recursive: true })

const count = Number(process.env.GIT_GRAPH_PERF_COMMITS || 10_000)

function commit(id: string, parents: string[], subject: string, at: number): GitGraphCommit {
  return {
    id,
    parents,
    subject,
    authorName: "perf",
    authorEmail: "perf@example.com",
    authorAt: at,
    committerName: "perf",
    committerEmail: "perf@example.com",
    committerAt: at,
  }
}

function write(name: string, snapshot: GitGraphSnapshot) {
  const started = performance.now()
  const layout = layoutGraph(snapshot)
  const elapsed = performance.now() - started
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(snapshot))
  console.log(`${name}: ${snapshot.commits.length} commits, layout ${elapsed.toFixed(1)}ms, lanes width=${layout.width}`)
}

function linear(n: number): GitGraphSnapshot {
  const commits: GitGraphCommit[] = []
  for (let i = 1; i <= n; i++) {
    const id = `c${i}`
    const parents = i === 1 ? [] : [`c${i - 1}`]
    commits.push(commit(id, parents, `Backup ${i}`, i * 1000))
  }
  const tip = `c${n}`
  return normalizeSnapshot({
    worktree: `fixture:perf-linear-${n}`,
    repositoryRoot: `fixture:perf-linear-${n}`,
    head: { commitID: tip, branch: "main", detached: false },
    shallow: false,
    commits,
    refs: [
      { name: "main", kind: "local", commitID: tip },
      { name: "HEAD", kind: "head", commitID: tip },
    ],
  })
}

function branched(n: number, branches: number): GitGraphSnapshot {
  const commits: GitGraphCommit[] = [commit("root", [], "Root", 1000)]
  const refs: Array<GitGraphSnapshot["refs"][number]> = []
  for (let b = 0; b < branches; b++) {
    let parent = "root"
    let tip = parent
    const length = Math.max(2, Math.floor(n / branches))
    for (let i = 1; i <= length; i++) {
      const id = `b${b}c${i}`
      commits.push(commit(id, [parent], `Branch ${b} backup ${i}`, 2000 + b * 10000 + i))
      parent = id
      tip = id
    }
    refs.push({ name: `branch-${b}`, kind: "local", commitID: tip })
  }
  refs.push({ name: "HEAD", kind: "head", commitID: refs[0]?.commitID || "root" })
  return normalizeSnapshot({
    worktree: `fixture:perf-branched-${n}`,
    repositoryRoot: `fixture:perf-branched-${n}`,
    head: { commitID: refs[0]?.commitID, branch: "branch-0", detached: false },
    shallow: false,
    commits,
    refs,
  })
}

write(`linear-${count}`, linear(count))
write(`branched-${count}`, branched(count, 20))

if (process.env.GIT_GRAPH_PERF_HUGE === "1") {
  write("linear-100000", linear(100_000))
}
