import type { GitGraphCommit, GitGraphRef, GitRefKind } from "../domain/contract"

const FIELD = "\x1f"
const RECORD = "\x1e"

export const COMMIT_FORMAT = ["%H", "%P", "%s", "%an", "%ae", "%at", "%cn", "%ce", "%ct"].join(FIELD)

export function parseCommitRecords(text: string): GitGraphCommit[] {
  return text
    .split(RECORD)
    .map((chunk) => chunk.replace(/^\n+|\n+$/g, ""))
    .filter(Boolean)
    .flatMap((chunk) => {
      const [id, parents, subject, authorName, authorEmail, authorAt, committerName, committerEmail, committerAt] =
        chunk.split(FIELD)
      if (!id) return []
      return [
        {
          id,
          parents: parents ? parents.trim().split(/\s+/).filter(Boolean) : [],
          subject: subject ?? "",
          authorName: authorName ?? "",
          authorEmail: authorEmail ?? "",
          authorAt: Number.parseInt(authorAt || "0", 10) * 1000,
          committerName: committerName ?? "",
          committerEmail: committerEmail ?? "",
          committerAt: Number.parseInt(committerAt || "0", 10) * 1000,
        } satisfies GitGraphCommit,
      ]
    })
}

export function parseRefLines(text: string): GitGraphRef[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [commitID, refname] = line.split("\t")
      if (!commitID || !refname) return []
      const parsed = classifyRef(refname)
      if (!parsed) return []
      return [{ commitID, ...parsed } satisfies GitGraphRef]
    })
}

function classifyRef(refname: string): { name: string; kind: GitRefKind; remote?: string } | undefined {
  if (refname === "HEAD") return { name: "HEAD", kind: "head" }
  if (refname.startsWith("refs/heads/")) return { name: refname.slice("refs/heads/".length), kind: "local" }
  if (refname.startsWith("refs/tags/")) return { name: refname.slice("refs/tags/".length), kind: "tag" }
  if (refname.startsWith("refs/stash")) return { name: "stash", kind: "stash" }
  if (refname.startsWith("refs/remotes/")) {
    const rest = refname.slice("refs/remotes/".length)
    const slash = rest.indexOf("/")
    if (slash === -1) return { name: rest, kind: "remote", remote: rest }
    return {
      name: rest.slice(slash + 1),
      kind: "remote",
      remote: rest.slice(0, slash),
    }
  }
}
