import { watch } from "node:fs"
import { resolve } from "node:path"
import {
  bunGitRunner,
  createLocalGitSource,
  parseMaxCommits,
  parseScope,
  type GitGraphScope,
} from "../source/local"
import { planGitAction, type GitActionKind } from "../source/actions"
import type { GitGraphSnapshot } from "../domain/contract"
import { emptySnapshot } from "../domain/contract"
import { fixtureSnapshot } from "../../fixtures/snapshots"

const PORT = Number(process.env.GIT_GRAPH_API_PORT || 5200)
const DEFAULT_SCOPE = parseScope(process.env.GIT_GRAPH_SCOPE)

const sources = new Map<string, ReturnType<typeof createLocalGitSource>>()

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
    timer = setTimeout(() => onChange(), 150)
  }
  const watcher = watch(gitDir, { recursive: true }, schedule)
  return () => {
    if (timer) clearTimeout(timer)
    watcher.close()
  }
}

function requestOptions(url: URL) {
  return {
    scope: parseScope(url.searchParams.get("scope") || DEFAULT_SCOPE),
    maxCommits: parseMaxCommits(url.searchParams.get("max") ?? process.env.GIT_GRAPH_MAX_COMMITS),
  }
}

async function readGraph(repo: string, scope: GitGraphScope, maxCommits?: number): Promise<GitGraphSnapshot> {
  if (!repo) {
    return emptySnapshot({ worktree: "", status: { kind: "invalid", message: "Missing repo" } })
  }
  if (repo.startsWith("fixture:")) return fixtureSnapshot(repo.slice("fixture:".length))
  return sourceFor(repo, scope, maxCommits).refresh()
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() })
    }

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true }, { headers: cors() })
    }

    if (url.pathname === "/api/graph") {
      const repo = url.searchParams.get("repo") || ""
      const options = requestOptions(url)
      const snapshot = await readGraph(repo, options.scope, options.maxCommits)
      return Response.json(snapshot, { headers: cors() })
    }

    if (url.pathname === "/api/action" && request.method === "POST") {
      const body = readActionBody(await request.json())
      if (!body) return Response.json({ ok: false, message: "Invalid action" }, { status: 400, headers: cors() })
      if (!body.repo || body.repo.startsWith("fixture:")) {
        return Response.json({ ok: false, message: "This repository cannot be changed here." }, { status: 400, headers: cors() })
      }
      const snapshot = await readGraph(body.repo, body.scope, body.maxCommits)
      if (snapshot.status.kind !== "ready" && body.kind !== "commit") {
        return Response.json({ ok: false, message: "Could not read git history" }, { status: 400, headers: cors() })
      }
      const plan = planGitAction({
        snapshot,
        kind: body.kind,
        commitID: body.commitID,
        name: body.name,
        target: body.target,
        endID: body.endID,
      })
      if (!plan.ok) return Response.json({ ok: false, message: plan.reason }, { status: 400, headers: cors() })
      for (const args of plan.steps) {
        const result = await bunGitRunner(args, snapshot.worktree)
        if (result.exitCode === 0) continue
        return Response.json(
          { ok: false, message: result.stderr.trim() || "Git could not complete that action." },
          { status: 400, headers: cors() },
        )
      }
      return Response.json({ ok: true }, { headers: cors() })
    }

    if (url.pathname === "/api/watch") {
      const repo = url.searchParams.get("repo") || ""
      const options = requestOptions(url)
      if (!repo || repo.startsWith("fixture:")) {
        return new Response("event: ping\ndata: {}\n\n", {
          headers: {
            ...cors(),
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
          const source = sourceFor(repo, options.scope, options.maxCommits)
          stop = source.subscribe(() => send())
        },
        cancel() {
          stop?.()
        },
      })

      return new Response(stream, {
        headers: {
          ...cors(),
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    return new Response("Not found", { status: 404, headers: cors() })
  },
})

console.log(`[git-graph] API http://127.0.0.1:${server.port}`)

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}

function readActionBody(input: unknown) {
  if (!input || typeof input !== "object") return
  const repo = "repo" in input && typeof input.repo === "string" ? input.repo : undefined
  const kind = "kind" in input && isActionKind(input.kind) ? input.kind : undefined
  const commitID = "commitID" in input && typeof input.commitID === "string" ? input.commitID : undefined
  if (!repo || !kind) return
  if (kind !== "commit" && kind !== "switch" && !commitID) return
  const name = "name" in input && typeof input.name === "string" ? input.name : undefined
  const target = "target" in input && typeof input.target === "string" ? input.target : undefined
  const endID = "endID" in input && typeof input.endID === "string" ? input.endID : undefined
  const scope = parseScope("scope" in input && typeof input.scope === "string" ? input.scope : undefined)
  const maxCommits = parseMaxCommits("max" in input && typeof input.max === "string" ? input.max : undefined)
  return { repo, kind, commitID, name, target, endID, scope, maxCommits }
}

function isActionKind(value: unknown): value is GitActionKind {
  return value === "branch" || value === "restore" || value === "delete" || value === "merge" || value === "move" || value === "commit" || value === "switch"
}
