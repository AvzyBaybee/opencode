import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")
const repo = process.env.GIT_GRAPH_REPO || process.argv[2] || ""

const api = spawn("bun", ["run", "src/standalone/server.ts"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    GIT_GRAPH_API_PORT: process.env.GIT_GRAPH_API_PORT || "5200",
  },
})

const ui = spawn("bun", ["x", "vite", "--config", "vite.config.ts"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
  },
})

if (repo) {
  console.log(`[git-graph] default repo hint: ${repo}`)
  console.log(`[git-graph] open http://127.0.0.1:5199/?repo=${encodeURIComponent(repo)}`)
} else {
  console.log("[git-graph] UI http://127.0.0.1:5199")
}

const stop = () => {
  api.kill()
  ui.kill()
  process.exit(0)
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)

api.on("exit", (code) => {
  if (code) ui.kill()
})
ui.on("exit", (code) => {
  if (code) api.kill()
})
