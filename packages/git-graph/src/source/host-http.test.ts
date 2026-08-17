import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import { handleGitGraphRequest } from "./host-http"

describe("git graph host http", () => {
  test("answers health on the OpenCode prefix", async () => {
    const response = await handleGitGraphRequest(new Request("http://localhost/ava/git-graph/health"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  test("answers health on the standalone prefix", async () => {
    const response = await handleGitGraphRequest(new Request("http://localhost/api/health"), { cors: true })
    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  test("creates a repository in a folder that does not exist yet", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "git-graph-init-")), "nested", "repo")
    const response = await handleGitGraphRequest(
      new Request("http://localhost/ava/git-graph/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo: dir, name: "main" }),
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
