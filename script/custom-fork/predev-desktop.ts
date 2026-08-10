#!/usr/bin/env bun

import { existsSync } from "node:fs"
import { join } from "node:path"
import { $ } from "bun"
import { downloadCliToResources, resolveChannel } from "../../packages/desktop/scripts/utils"

const root = join(import.meta.dir, "../..")
const desktop = join(root, "packages/desktop")
const opencode = join(root, "packages/opencode")
const channel = resolveChannel()
const electronBinary =
  process.platform === "win32"
    ? join(desktop, "node_modules/electron/dist/electron.exe")
    : join(desktop, "node_modules/electron/dist/electron")
const serverBundle = join(opencode, "dist/node/node.js")
const cliBinary = join(desktop, process.platform === "win32" ? "resources/opencode-cli.exe" : "resources/opencode-cli")

if (!existsSync(electronBinary)) {
  await $`bun run install-electron`.cwd(desktop)
}

await $`bun ./scripts/copy-icons.ts ${channel}`.cwd(desktop)

if (!existsSync(serverBundle) || process.env.OPENCODE_DEV_REBUILD === "1") {
  await $`bun script/build-node.ts`.cwd(opencode)
}

if (channel === "dev" && !existsSync(cliBinary)) {
  await downloadCliToResources()
}
