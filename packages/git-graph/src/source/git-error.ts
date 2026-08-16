import type { GitActionKind } from "./actions"

export function explainGitFailure(kind: GitActionKind, stdout: string, stderr: string) {
  const text = `${stderr}\n${stdout}`.replace(/\r/g, "")
  if (kind === "commit" && /nothing to commit/i.test(text)) {
    return { message: "No files have changed since the last backup, so there's nothing to backup." }
  }
  if (/please tell me who you are/i.test(text)) {
    return { message: "You need a name & email address to create a backup." }
  }
  if (/no space left on device|disk quota exceeded/i.test(text)) {
    return { message: "Your disk is full. There's no space to make a backup." }
  }
  if (/authentication failed|could not read username|permission denied \(publickey\)|repository not found|could not find remote|no upstream/i.test(text)) {
    return { message: "GitHub did not accept this backup. Check that this folder is connected to GitHub." }
  }
  if (/permission denied|read-only file system|unable to write|cannot unlink|index\.lock|file exists/i.test(text)) {
    return { message: "The file is locked. Is it in use somewhere else? Is there permission issues? Is it read-only?" }
  }
  if (/would be overwritten by checkout|would be overwritten by switch|please commit your changes or stash|untracked working tree files would be overwritten/i.test(text)) {
    const overwriteFiles = parseOverwriteFiles(text)
    return { message: overwritePrompt(overwriteFiles).body, overwrite: true, overwriteFiles }
  }
  if (/conflict/i.test(text) || /needs merge|fix conflicts|unmerged/i.test(text)) {
    const files = parseOverwriteFiles(text)
    return { message: conflictPrompt(files).body, conflict: true, overwriteFiles: files }
  }
  if (/hook declined|pre-push|pre-commit/i.test(text)) {
    return { message: "GitHub did not get this backup because a check in this folder blocked the send." }
  }
  const line = preferredGitLine(text)
  if (line) return { message: `There was an error: ${line}` }
  return { message: "There was an error." }
}

function preferredGitLine(text: string) {
  const lines = text
    .split("\n")
    .map((item) => item.trim().replace(/^(fatal|error):\s*/i, ""))
    .filter((item) => item && !item.startsWith("$") && !item.startsWith(">") && !item.startsWith("bun turbo"))
  return lines.find((item) => /^(error|fatal)/i.test(item)) || lines.at(-1) || lines[0]
}

export function parseOverwriteFiles(text: string) {
  const files: string[] = []
  let taking = false
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (/would be overwritten by (checkout|switch|merge)/i.test(line) || /untracked working tree files would be overwritten/i.test(line)) {
      taking = true
      continue
    }
    if (!taking) continue
    if (/^(please |aborting|error:|fatal:)/i.test(line.trim())) break
    const path = line.trim()
    if (path) files.push(path)
  }
  return files
}

export function listEnglish(items: readonly string[]) {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

export function overwritePrompt(files: readonly string[]) {
  const them = files.length === 1 ? "it" : "them"
  const they = files.length === 1 ? "it" : "they"
  const list = listEnglish(files)
  const body = list
    ? `You have changes to ${list} that you haven't backed up. If you switch to another backup, ${they} will be overwritten.`
    : `You have changes that you haven't backed up. If you switch to another backup, they will be overwritten.`
  return {
    body,
    question: `Do you want to overwrite ${them}, or do you want to back ${them} up?`,
    backup: files.length === 1 ? "Back it up" : "Back them up",
    overwrite: "Overwrite",
  }
}

export function conflictPrompt(files: readonly string[]) {
  const list = listEnglish(files)
  const them = files.length === 1 ? "it" : "them"
  const body = list
    ? `These backups both changed ${list} in different ways.`
    : "These backups both changed the same files in different ways."
  return {
    body,
    question: `Keep this branch's version, keep the other branch's version, edit ${them} yourself, or cancel?`,
    keepThis: "Keep this branch's version",
    keepOther: "Keep the other branch's version",
    edit: "I'll edit it",
    done: "Done",
    cancel: "Cancel",
  }
}
