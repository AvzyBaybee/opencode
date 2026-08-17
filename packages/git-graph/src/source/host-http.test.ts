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
})
