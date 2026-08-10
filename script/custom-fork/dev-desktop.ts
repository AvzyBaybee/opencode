#!/usr/bin/env bun

import { join } from "node:path"

const root = join(import.meta.dir, "../..")
const desktop = join(root, "packages/desktop")
const opencode = join(root, "packages/opencode")

await import("./predev-desktop.ts")

const children: Bun.Subprocess[] = []

const watch = Bun.spawn(["bun", "--watch", "script/build-node.ts"], {
  cwd: opencode,
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
})
children.push(watch)

const dev = Bun.spawn(["bunx", "electron-vite", "dev"], {
  cwd: desktop,
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
})
children.push(dev)

const cleanup = () => {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

process.on("SIGINT", cleanup)
process.on("SIGTERM", cleanup)

const code = await dev.exited
cleanup()
process.exit(code ?? 1)
