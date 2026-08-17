import { mkdir } from "node:fs/promises"
import { watch } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { emptySnapshot, type GitGraphSnapshot } from "../domain/contract"
import { fixtureSnapshot } from "../../fixtures/snapshots"
import { branchNameProblem, planGitAction, type GitActionKind } from "./actions"
import { resolveConflict, unmergedFiles, type ConflictHow } from "./conflict"
import { conflictPrompt, explainGitFailure } from "./git-error"
import { explainInProgress, gitWriteInProgress } from "./git-in-progress"
import {
  bunGitRunner,
  createLocalGitSource,
  parseMaxCommits,
  parseScope,
  type GitGraphScope,
} from "./local"

const sources = new Map<string, ReturnType<typeof createLocalGitSource>>()
const DEFAULT_SCOPE = parseScope(process.env.GIT_GRAPH_SCOPE)

export type GitGraphHttpOptions = {
  readonly cors?: boolean
  readonly worktree?: string
}

export async function handleGitGraphRequest(request: Request, options: GitGraphHttpOptions = {}) {
  const url = new URL(request.url)
  const headers = options.cors ? cors() : {}
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers })

  if (request.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  const kind = routeKind(url.pathname)
  if (!kind) return new Response("Not found", { status: 404, headers })
  if (kind === "health") return json({ ok: true })

  const worktree = options.worktree?.trim() || url.searchParams.get("repo") || ""
  const requestOpts = {
    scope: parseScope(url.searchParams.get("scope") || DEFAULT_SCOPE),
    maxCommits: parseMaxCommits(url.searchParams.get("max") ?? process.env.GIT_GRAPH_MAX_COMMITS),
  }

  if (kind === "graph") {
    return json(await readGraph(worktree, requestOpts.scope, requestOpts.maxCommits))
  }

  if (kind === "watch") {
    if (!worktree || worktree.startsWith("fixture:")) {
      return new Response("event: ping\ndata: {}\n\n", {
        headers: {
          ...headers,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }
    let stop: (() => void) | undefined
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const send = () => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ at: Date.now() })}\n\n`))
        send()
        stop = sourceFor(worktree, requestOpts.scope, requestOpts.maxCommits).subscribe(() => send())
      },
      cancel() {
        stop?.()
      },
    })
    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  if (request.method !== "POST") return new Response("Not found", { status: 404, headers })
  const body = await request.json().catch(() => undefined)

  if (kind === "action") {
    const parsed = readActionBody(body, worktree)
    if (!parsed) return json({ ok: false, message: "Invalid action" }, 400)
    if (!parsed.repo || parsed.repo.startsWith("fixture:")) {
      return json({ ok: false, message: "This repository cannot be changed here." }, 400)
    }
    const snapshot = await readGraph(parsed.repo, parsed.scope, parsed.maxCommits)
    if (snapshot.status.kind !== "ready" && parsed.kind !== "commit") {
      return json({ ok: false, message: "Could not read git history" }, 400)
    }
    const plan = planGitAction({
      snapshot,
      kind: parsed.kind,
      commitID: parsed.commitID,
      name: parsed.name,
      target: parsed.target,
      endID: parsed.endID,
      force: parsed.force,
      paths: parsed.paths,
    })
    if (!plan.ok) return json({ ok: false, message: plan.reason }, 400)
    const steps = [...plan.steps]
    if (parsed.kind === "commit" && parsed.cloud) {
      const remote = await firstRemote(snapshot.worktree)
      if (!remote) return json({ ok: false, message: "This folder is not connected to GitHub." }, 400)
      steps.push(["push", "--no-verify", "-u", remote, "HEAD"])
    }
    for (const args of steps) {
      const result = await bunGitRunner(args, snapshot.worktree, args[0] === "push" ? { GIT_TERMINAL_PROMPT: "0" } : undefined)
      if (result.exitCode === 0) continue
      const gitDir = await bunGitRunner(["rev-parse", "--git-dir"], snapshot.worktree)
      const dir = gitDir.exitCode === 0 ? resolveGitDir(snapshot.worktree, gitDir.stdout.trim()) : ""
      const files = dir ? await unmergedFiles(bunGitRunner, snapshot.worktree) : []
      if (files.length) {
        return json({ ok: false, message: conflictPrompt(files).body, conflict: true, overwriteFiles: files }, 400)
      }
      const progress = dir ? explainInProgress(dir) : undefined
      const explained = explainGitFailure(parsed.kind, result.stdout, result.stderr)
      return json(
        {
          ok: false,
          message: progress || explained.message,
          overwrite: progress ? undefined : explained.overwrite,
          conflict: progress ? undefined : explained.conflict,
          overwriteFiles: progress ? undefined : explained.overwriteFiles,
        },
        400,
      )
    }
    if (parsed.kind === "publish") {
      const pushed = await pushAllToCloud(snapshot.worktree)
      if (!pushed.ok) return json({ ok: false, message: pushed.message }, 400)
      return json({ ok: true })
    }
    await syncCloud(snapshot.worktree, parsed.kind)
    return json({ ok: true })
  }

  if (kind === "conflict") {
    const repo = worktree || (body && typeof body === "object" && "repo" in body && typeof body.repo === "string" ? body.repo : "")
    const how = body && typeof body === "object" && "how" in body && isConflictHow(body.how) ? body.how : undefined
    if (!repo || repo.startsWith("fixture:") || !how) return json({ ok: false, message: "Invalid action" }, 400)
    const dir = resolve(repo)
    const gitDir = await bunGitRunner(["rev-parse", "--git-dir"], dir)
    if (gitDir.exitCode !== 0) return json({ ok: false, message: "Could not read git history" }, 400)
    const result = await resolveConflict(bunGitRunner, dir, resolveGitDir(dir, gitDir.stdout.trim()), how)
    if (result.exitCode !== 0) {
      const files = await unmergedFiles(bunGitRunner, dir)
      if (files.length) {
        return json({ ok: false, message: conflictPrompt(files).body, conflict: true, overwriteFiles: files }, 400)
      }
      return json({ ok: false, message: explainGitFailure("merge", result.stdout, result.stderr).message }, 400)
    }
    return json({ ok: true })
  }

  if (kind === "init") {
    const repo = worktree || (body && typeof body === "object" && "repo" in body && typeof body.repo === "string" ? body.repo : "")
    const name = body && typeof body === "object" && "name" in body && typeof body.name === "string" ? body.name : ""
    if (!repo || repo.startsWith("fixture:")) {
      return json({ ok: false, message: "This repository cannot be changed here." }, 400)
    }
    const problem = branchNameProblem(name)
    if (problem) return json({ ok: false, message: problem }, 400)
    const dir = resolve(repo)
    await mkdir(dir, { recursive: true })
    const existing = await bunGitRunner(["rev-parse", "--show-toplevel"], dir)
    if (existing.exitCode === 0) {
      return json({ ok: false, message: "This folder already has a Git repository." }, 400)
    }
    const init = await bunGitRunner(["init"], dir)
    if (init.exitCode !== 0) {
      return json({ ok: false, message: explainGitFailure("commit", init.stdout, init.stderr).message }, 400)
    }
    const branch = name.trim()
    const point = await bunGitRunner(["symbolic-ref", "HEAD", `refs/heads/${branch}`], dir)
    if (point.exitCode !== 0) {
      return json({ ok: false, message: explainGitFailure("branch", point.stdout, point.stderr).message }, 400)
    }
    return json({ ok: true })
  }

  return new Response("Not found", { status: 404, headers })
}

function routeKind(pathname: string) {
  const leaf = pathname.replace(/\/+$/, "").split("/").pop()
  if (leaf === "health" || leaf === "graph" || leaf === "watch" || leaf === "action" || leaf === "conflict" || leaf === "init") {
    return leaf
  }
}

function sourceKey(repo: string, scope: GitGraphScope, maxCommits?: number) {
  return `${resolve(repo)}|${scope}|${maxCommits ?? "all"}`
}

function sourceFor(repo: string, scope: GitGraphScope, maxCommits?: number) {
  const key = sourceKey(repo, scope, maxCommits)
  const existing = sources.get(key)
  if (existing) return existing
  const source = createLocalGitSource({
    worktree: resolve(repo),
    run: bunGitRunner,
    maxCommits,
    scope,
    watch: (worktree, onChange) => watchRepository(worktree, onChange),
  })
  sources.set(key, source)
  return source
}

function watchRepository(worktree: string, onChange: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const gitDir = resolve(worktree, ".git")
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (gitWriteInProgress(gitDir)) {
        schedule()
        return
      }
      onChange()
    }, 220)
  }
  try {
    const watcher = watch(gitDir, { recursive: true }, schedule)
    return () => {
      if (timer) clearTimeout(timer)
      watcher.close()
    }
  } catch {
    return () => {
      if (timer) clearTimeout(timer)
    }
  }
}

async function readGraph(repo: string, scope: GitGraphScope, maxCommits?: number): Promise<GitGraphSnapshot> {
  if (!repo) {
    return emptySnapshot({ worktree: "", status: { kind: "invalid", message: "Missing repo" } })
  }
  if (repo.startsWith("fixture:")) return fixtureSnapshot(repo.slice("fixture:".length))
  return sourceFor(repo, scope, maxCommits).refresh()
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

function readActionBody(input: unknown, worktree?: string) {
  if (!input || typeof input !== "object") return
  const repo = worktree || ("repo" in input && typeof input.repo === "string" ? input.repo : undefined)
  const kind = "kind" in input && isActionKind(input.kind) ? input.kind : undefined
  const commitID = "commitID" in input && typeof input.commitID === "string" ? input.commitID : undefined
  if (!repo || !kind) return
  if (kind !== "commit" && kind !== "switch" && kind !== "publish" && !commitID) return
  const name = "name" in input && typeof input.name === "string" ? input.name : undefined
  const target = "target" in input && typeof input.target === "string" ? input.target : undefined
  const endID = "endID" in input && typeof input.endID === "string" ? input.endID : undefined
  const force = "force" in input && input.force === true
  const paths =
    "paths" in input && Array.isArray(input.paths)
      ? input.paths.filter((item): item is string => typeof item === "string")
      : undefined
  const cloud = "cloud" in input && input.cloud === true
  const scope = parseScope("scope" in input && typeof input.scope === "string" ? input.scope : undefined)
  const maxCommits = parseMaxCommits("max" in input && typeof input.max === "string" ? input.max : undefined)
  return { repo, kind, commitID, name, target, endID, force, cloud, paths, scope, maxCommits }
}

function isActionKind(value: unknown): value is GitActionKind {
  return (
    value === "branch" ||
    value === "restore" ||
    value === "delete" ||
    value === "merge" ||
    value === "move" ||
    value === "commit" ||
    value === "switch" ||
    value === "rename" ||
    value === "publish"
  )
}

function isConflictHow(value: unknown): value is ConflictHow {
  return value === "abort" || value === "keep-this" || value === "keep-other" || value === "edited"
}

function resolveGitDir(worktree: string, gitDir: string) {
  if (isAbsolute(gitDir)) return gitDir
  return join(worktree, gitDir)
}

async function firstRemote(worktree: string) {
  const remotes = await bunGitRunner(["remote"], worktree)
  return remotes.stdout
    .split(/\s+/)
    .map((item) => item.trim())
    .find(Boolean)
}

async function pushAllToCloud(worktree: string) {
  const remote = await firstRemote(worktree)
  if (!remote) return { ok: false as const, message: "This folder is not connected to GitHub." }
  const result = await bunGitRunner(["push", "--no-verify", "-u", remote, "--all"], worktree, { GIT_TERMINAL_PROMPT: "0" })
  if (result.exitCode === 0) return { ok: true as const }
  return { ok: false as const, message: explainGitFailure("publish", result.stdout, result.stderr).message }
}

async function syncCloud(worktree: string, kind: GitActionKind) {
  if (kind === "switch" || kind === "publish" || kind === "commit") return
  const remote = await firstRemote(worktree)
  if (!remote) return
  const named = await bunGitRunner(["symbolic-ref", "--quiet", "--short", "HEAD"], worktree)
  if (named.exitCode !== 0) return
  const rewrite = kind === "delete" || kind === "restore" || kind === "merge" || kind === "move"
  const args = rewrite
    ? ["push", "--no-verify", "--force-with-lease", remote, "HEAD"]
    : ["push", "--no-verify", "-u", remote, "HEAD"]
  await bunGitRunner(args, worktree, { GIT_TERMINAL_PROMPT: "0" })
}
