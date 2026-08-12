import { watch } from "node:fs"
import { resolve } from "node:path"
import { bunGitRunner, createLocalGitSource } from "../source/local"
import type { GitGraphSnapshot } from "../domain/contract"
import { emptySnapshot } from "../domain/contract"
import { fixtureSnapshot } from "../../fixtures/snapshots"

const PORT = Number(process.env.GIT_GRAPH_API_PORT || 5200)

const sources = new Map<string, ReturnType<typeof createLocalGitSource>>()

function sourceFor(repo: string) {
  const key = resolve(repo)
  const existing = sources.get(key)
  if (existing) return existing
  const source = createLocalGitSource({
    worktree: key,
    run: bunGitRunner,
    maxCommits: Number(process.env.GIT_GRAPH_MAX_COMMITS || 5000),
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

async function readGraph(repo: string): Promise<GitGraphSnapshot> {
  if (!repo) {
    return emptySnapshot({ worktree: "", status: { kind: "invalid", message: "Missing repo" } })
  }
  if (repo.startsWith("fixture:")) return fixtureSnapshot(repo.slice("fixture:".length))
  return sourceFor(repo).refresh()
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
      const snapshot = await readGraph(repo)
      return Response.json(snapshot, { headers: cors() })
    }

    if (url.pathname === "/api/watch") {
      const repo = url.searchParams.get("repo") || ""
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
          const source = sourceFor(repo)
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
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}
