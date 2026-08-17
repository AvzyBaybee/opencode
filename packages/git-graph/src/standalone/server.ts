import { handleGitGraphRequest } from "../source/host-http"

const PORT = Number(process.env.GIT_GRAPH_API_PORT || 5200)

const server = Bun.serve({
  port: PORT,
  fetch: (request) => handleGitGraphRequest(request, { cors: true }),
})

console.log(`[git-graph] API http://127.0.0.1:${server.port}`)
