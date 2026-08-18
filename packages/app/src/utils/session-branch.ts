export const BRANCH_TITLE_PREFIX = "[Branch]"

export type SessionBranchOrigin = {
  sessionID: string
  title: string
  afterUserMessageID?: string
}

export function sessionBranchOrigin(metadata: unknown): SessionBranchOrigin | undefined {
  if (!metadata || typeof metadata !== "object") return
  if (!("branchedFrom" in metadata)) return
  const origin = metadata.branchedFrom
  if (!origin || typeof origin !== "object") return
  if (!("sessionID" in origin) || !("title" in origin)) return
  if (typeof origin.sessionID !== "string" || typeof origin.title !== "string") return
  if (!origin.sessionID || !origin.title) return
  const afterUserMessageID =
    "afterUserMessageID" in origin && typeof origin.afterUserMessageID === "string" && origin.afterUserMessageID
      ? origin.afterUserMessageID
      : undefined
  return { sessionID: origin.sessionID, title: origin.title, afterUserMessageID }
}

export function withBranchTitleTag(title: string) {
  const trimmed = title.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith(`${BRANCH_TITLE_PREFIX} `) || trimmed === BRANCH_TITLE_PREFIX) return trimmed
  return `${BRANCH_TITLE_PREFIX} ${trimmed}`
}

export function branchRowInsertIndex(rows: ReadonlyArray<object>, afterUserMessageID?: string) {
  if (!afterUserMessageID) return 0
  let last = -1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !("userMessageID" in row)) continue
    if (row.userMessageID === afterUserMessageID) last = i
  }
  if (last < 0) return
  return last + 1
}

export function forkExclusiveAfter(messages: ReadonlyArray<{ id: string; role: string }>, fromMessageID: string) {
  const index = messages.findIndex((msg) => msg.id === fromMessageID)
  if (index < 0) return fromMessageID
  let end = index + 1
  if (messages[index]?.role === "user") {
    while (end < messages.length && messages[end]?.role === "assistant") end += 1
  }
  return messages[end]?.id
}
