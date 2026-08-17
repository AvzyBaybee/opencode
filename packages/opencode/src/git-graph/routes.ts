import { handleGitGraphRequest } from "@opencode-ai/git-graph/host-http"
import { Effect, Option } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

export const gitGraphRoutes = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const handle = (request: HttpServerRequest.HttpServerRequest) =>
      Effect.gen(function* () {
        const url = Option.getOrElse(HttpServerRequest.toURL(request), () => new URL(request.url, "http://localhost"))
        const directory = url.searchParams.get("directory") ?? ""
        const method = request.method
        const body =
          method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : yield* Effect.orDie(request.text)
        const web = new Request(url, {
          method,
          headers: { "content-type": request.headers["content-type"] ?? "application/json" },
          body,
        })
        const response = yield* Effect.promise(() => handleGitGraphRequest(web, { worktree: directory }))
        const contentType = response.headers.get("content-type") ?? "application/json"
        if (contentType.includes("event-stream")) {
          return HttpServerResponse.raw(response, {
            status: response.status,
            contentType,
            headers: {
              "cache-control": "no-cache, no-transform",
              "x-accel-buffering": "no",
            },
          })
        }
        const payload = yield* Effect.promise(() => response.json())
        return HttpServerResponse.jsonUnsafe(payload, { status: response.status })
      })

    yield* router.add("GET", "/ava/git-graph/graph", handle)
    yield* router.add("GET", "/ava/git-graph/watch", handle)
    yield* router.add("POST", "/ava/git-graph/action", handle)
    yield* router.add("POST", "/ava/git-graph/conflict", handle)
    yield* router.add("POST", "/ava/git-graph/init", handle)
  }),
)

export * as GitGraphRoutes from "./routes"
