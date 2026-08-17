import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { delimiter, join } from "node:path"
import type { GitGraphSnapshot, GitGraphSource } from "../domain/contract"
import { emptySnapshot } from "../domain/contract"
import { withCloudFlags } from "../domain/cloud"
import { loadingSnapshot, normalizeSnapshot } from "../domain/normalize"
import { COMMIT_FORMAT, parseCommitRecords, parseRefLines } from "./parse"

export type GitRunner = (
  args: readonly string[],
  cwd: string,
  env?: Record<string, string>,
) => Promise<{ exitCode: number; stdout: string; stderr: string }>

/**
 * current = checked-out branch only
 * local = every local branch (good default for forks)
 * all = local + remotes/tags (can be huge on upstream forks)
 */
export type GitGraphScope = "current" | "local" | "all"

export type LocalGitSourceOptions = {
  readonly worktree: string
  readonly run: GitRunner
  readonly watch?: (worktree: string, onChange: () => void) => () => void
  readonly maxCommits?: number
  readonly scope?: GitGraphScope
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

export function parseScope(value: string | null | undefined): GitGraphScope {
  if (value === "current" || value === "all" || value === "local") return value
  return "local"
}

export function parseMaxCommits(value: string | null | undefined) {
  if (value == null || value === "" || value === "all") return
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return
  return Math.floor(parsed)
}

async function readRepository(options: LocalGitSourceOptions): Promise<GitGraphSnapshot> {
  const scope = options.scope ?? "local"
  const root = await options.run(["rev-parse", "--show-toplevel"], options.worktree)
  if (root.exitCode !== 0) {
    return emptySnapshot({
      worktree: options.worktree,
      status: { kind: "invalid", message: root.stderr.trim() || "Not a git repository" },
    })
  }

  const repositoryRoot = root.stdout.trim().replace(/\\/g, "/")
  const head = await settleHead(options)
  const shallow = await options.run(["rev-parse", "--is-shallow-repository"], options.worktree)
  const detached = head.detached
  const branch = head.branch
  const commitID = head.commitID

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

  const logArgs = [
    "log",
    `--max-count=${options.maxCommits ?? -1}`,
    `--format=${COMMIT_FORMAT}%x1e`,
    "--date-order",
  ]
  if (scope === "all") logArgs.push("--all")
  if (scope === "local") logArgs.push("--branches")
  if (scope === "current") logArgs.push("--first-parent", "HEAD")

  const log = await options.run(logArgs, options.worktree)
  if (log.exitCode !== 0) {
    return emptySnapshot({
      worktree: options.worktree,
      repositoryRoot,
      status: { kind: "error", message: log.stderr.trim() || "Failed to read commit graph" },
    })
  }

  const commits = parseCommitRecords(log.stdout).map((commit) =>
    scope === "current" && commit.parents.length > 1 ? { ...commit, parents: commit.parents.slice(0, 1) } : commit,
  )

  const refs =
    scope === "all"
      ? await options.run(
          ["for-each-ref", "--format=%(objectname)%09%(refname)", "refs/heads", "refs/tags", "refs/remotes", "refs/stash"],
          options.worktree,
        )
      : scope === "local"
        ? await options.run(["for-each-ref", "--format=%(objectname)%09%(refname)", "refs/heads"], options.worktree)
        : { exitCode: 0, stdout: "", stderr: "" }

  const parsedRefs = (scope === "all" || scope === "local") && refs.exitCode === 0 ? parseRefLines(refs.stdout) : []
  if (branch) parsedRefs.push({ name: branch, kind: "local", commitID })
  parsedRefs.push({ name: "HEAD", kind: "head", commitID })

  const clouded = await withRemoteCloudFlags(options.run, options.worktree, commits)

  return normalizeSnapshot({
    worktree: options.worktree,
    repositoryRoot,
    head: { commitID, branch, detached },
    commits: clouded,
    refs: uniqueRefs(parsedRefs),
    shallow: shallow.stdout.trim() === "true",
  })
}

async function settleHead(options: LocalGitSourceOptions) {
  let detached = true
  let branch: string | undefined
  let commitID: string | undefined
  for (let attempt = 0; attempt < 8; attempt++) {
    const headSymbolic = await options.run(["symbolic-ref", "--quiet", "--short", "HEAD"], options.worktree)
    const headCommit = await options.run(["rev-parse", "--verify", "HEAD"], options.worktree)
    detached = headSymbolic.exitCode !== 0
    branch = headSymbolic.exitCode === 0 ? headSymbolic.stdout.trim() || undefined : undefined
    commitID = headCommit.exitCode === 0 ? headCommit.stdout.trim() || undefined : undefined
    if (!branch || !commitID) return { detached, branch, commitID }
    const tip = await options.run(["rev-parse", "--verify", branch], options.worktree)
    if (tip.exitCode === 0 && tip.stdout.trim() === commitID) return { detached, branch, commitID }
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  return { detached, branch, commitID }
}

async function withRemoteCloudFlags(
  run: GitRunner,
  worktree: string,
  commits: GitGraphSnapshot["commits"],
) {
  const refs = await run(["for-each-ref", "--format=%(objectname)", "refs/remotes"], worktree)
  if (refs.exitCode !== 0) return withCloudFlags(commits, [])
  const tips = refs.stdout.split(/\s+/).map((item) => item.trim()).filter(Boolean)
  return withCloudFlags(commits, tips)
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

export async function bunGitRunner(args: readonly string[], cwd: string, env?: Record<string, string>) {
  const git = gitCommand()
  const proc = spawn(
    git,
    ["--no-pager", "--no-optional-locks", "-c", "alias.log=", "-c", "log.maxCount=-1", ...args],
    {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: process.platform === "win32",
      env: { ...process.env, PATH: gitSearchPath(), ...env },
    },
  )
  const out: Buffer[] = []
  const err: Buffer[] = []
  proc.stdout?.on("data", (chunk) => out.push(chunk))
  proc.stderr?.on("data", (chunk) => err.push(chunk))
  const finished = await new Promise<{ exitCode: number; error?: unknown }>((resolve) => {
    proc.once("error", (error) => resolve({ exitCode: 1, error }))
    proc.once("close", (code) => resolve({ exitCode: code ?? 1 }))
  })
  const stdout = Buffer.concat(out).toString()
  const stderr = Buffer.concat(err).toString()
  if (finished.error) return { exitCode: 1, stdout, stderr: stderr || gitSpawnMessage(finished.error, cwd) }
  return { exitCode: finished.exitCode, stdout, stderr }
}

function gitCommand() {
  const names = process.platform === "win32" ? ["git.exe", "git.cmd", "git"] : ["git"]
  for (const dir of gitSearchPath().split(delimiter)) {
    if (!dir) continue
    for (const name of names) {
      const file = join(dir, name)
      if (existsSync(file)) return file
    }
  }
  return names[0] ?? "git"
}

function gitSearchPath() {
  const current = process.env.PATH ?? process.env.Path ?? ""
  if (process.platform !== "win32") return current
  const extra = [
    "C:\\Program Files\\Git\\cmd",
    "C:\\Program Files\\Git\\bin",
    "C:\\Program Files (x86)\\Git\\cmd",
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs", "Git", "cmd") : "",
  ].filter(Boolean)
  return [...extra, current].join(delimiter)
}

function gitSpawnMessage(error: unknown, cwd: string) {
  const text = error instanceof Error ? error.message : String(error)
  if (/executable not found/i.test(text)) {
    return "Could not start git. Install Git and make sure this app can find it."
  }
  if (/enoent/i.test(text)) {
    return `Could not start git. The folder does not exist: ${cwd}`
  }
  return `Could not start git. ${text}`
}
