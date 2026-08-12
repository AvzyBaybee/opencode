import type { GitGraphSnapshot, GitGraphSource } from "../domain/contract"
import { emptySnapshot } from "../domain/contract"
import { loadingSnapshot, normalizeSnapshot } from "../domain/normalize"
import { COMMIT_FORMAT, parseCommitRecords, parseRefLines } from "./parse"

export type GitRunner = (args: readonly string[], cwd: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>

export type LocalGitSourceOptions = {
  readonly worktree: string
  readonly run: GitRunner
  readonly watch?: (worktree: string, onChange: () => void) => () => void
  readonly maxCommits?: number
}

export function createLocalGitSource(options: LocalGitSourceOptions): GitGraphSource {
  const listeners = new Set<(snapshot: GitGraphSnapshot) => void>()
  let current = loadingSnapshot(options.worktree)
  let inflight: Promise<GitGraphSnapshot> | undefined
  let stopWatch: (() => void) | undefined

  const emit = (snapshot: GitGraphSnapshot) => {
    current = snapshot
    for (const listener of listeners) listener(snapshot)
  }

  const load = async () => {
    if (inflight) return inflight
    inflight = (async () => {
      const snapshot = await readRepository(options)
      emit(snapshot)
      return snapshot
    })().finally(() => {
      inflight = undefined
    })
    return inflight
  }

  return {
    getSnapshot: async () => {
      if (current.status.kind === "loading") return load()
      return current
    },
    refresh: () => load(),
    subscribe: (listener) => {
      listeners.add(listener)
      listener(current)
      if (!stopWatch && options.watch) {
        stopWatch = options.watch(options.worktree, () => {
          void load()
        })
      }
      if (current.status.kind === "loading") void load()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && stopWatch) {
          stopWatch()
          stopWatch = undefined
        }
      }
    },
  }
}

async function readRepository(options: LocalGitSourceOptions): Promise<GitGraphSnapshot> {
  const root = await options.run(["rev-parse", "--show-toplevel"], options.worktree)
  if (root.exitCode !== 0) {
    return emptySnapshot({
      worktree: options.worktree,
      status: { kind: "invalid", message: root.stderr.trim() || "Not a git repository" },
    })
  }

  const repositoryRoot = root.stdout.trim().replace(/\\/g, "/")
  const headSymbolic = await options.run(["symbolic-ref", "--quiet", "--short", "HEAD"], options.worktree)
  const headCommit = await options.run(["rev-parse", "--verify", "HEAD"], options.worktree)
  const shallow = await options.run(["rev-parse", "--is-shallow-repository"], options.worktree)
  const detached = headSymbolic.exitCode !== 0
  const branch = headSymbolic.exitCode === 0 ? headSymbolic.stdout.trim() || undefined : undefined
  const commitID = headCommit.exitCode === 0 ? headCommit.stdout.trim() || undefined : undefined

  if (!commitID) {
    return normalizeSnapshot({
      worktree: options.worktree,
      repositoryRoot,
      head: { detached, branch },
      commits: [],
      refs: [],
      shallow: shallow.stdout.trim() === "true",
      status: branch ? { kind: "unborn" } : { kind: "empty" },
    })
  }

  const max = options.maxCommits ?? 5000
  const log = await options.run(
    ["log", `--max-count=${max}`, `--format=${COMMIT_FORMAT}%x1e`, "--date-order", "--all"],
    options.worktree,
  )
  if (log.exitCode !== 0) {
    return emptySnapshot({
      worktree: options.worktree,
      repositoryRoot,
      status: { kind: "error", message: log.stderr.trim() || "Failed to read commit graph" },
    })
  }

  const refs = await options.run(
    ["for-each-ref", "--format=%(objectname)%09%(refname)", "refs/heads", "refs/tags", "refs/remotes", "refs/stash"],
    options.worktree,
  )

  const commits = parseCommitRecords(log.stdout)
  const parsedRefs = refs.exitCode === 0 ? parseRefLines(refs.stdout) : []
  if (branch) {
    parsedRefs.push({ name: branch, kind: "local", commitID })
  }
  parsedRefs.push({ name: "HEAD", kind: "head", commitID })

  return normalizeSnapshot({
    worktree: options.worktree,
    repositoryRoot,
    head: { commitID, branch, detached },
    commits,
    refs: uniqueRefs(parsedRefs),
    shallow: shallow.stdout.trim() === "true",
  })
}

function uniqueRefs(refs: ReturnType<typeof parseRefLines>) {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    if (!ref.commitID) return false
    const key = `${ref.kind}:${ref.remote ?? ""}:${ref.name}:${ref.commitID}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function bunGitRunner(args: readonly string[], cwd: string) {
  const proc = Bun.spawn(["git", "--no-optional-locks", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { exitCode, stdout, stderr }
}
