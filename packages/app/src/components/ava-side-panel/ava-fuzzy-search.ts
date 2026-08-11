import fuzzysort from "fuzzysort"

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase()
}

export function fuzzyFilterPaths(query: string, paths: readonly string[], limit = 200) {
  const needle = normalizeSearchText(query.trim())
  if (!needle) return [] as string[]

  const ranked = fuzzysort.go(needle, paths as string[], {
    limit,
    threshold: -20000,
    all: false,
  })
  if (ranked.length > 0) return ranked.map((item) => item.target)

  // Fallback: normalized includes match (handles leading-dot names like .rooignore)
  return paths
    .filter((path) => {
      const full = normalizeSearchText(path)
      const base = normalizeSearchText(path.split(/[/\\]/).pop() ?? path)
      return full.includes(needle) || base.includes(needle)
    })
    .slice(0, limit)
}

export async function listFilesRecursive(
  list: (dir: string) => Promise<{ path: string; type: "file" | "directory" }[]>,
  root = "",
  limit = 5000,
) {
  const files: string[] = []
  const queue = [root]
  while (queue.length > 0 && files.length < limit) {
    const dir = queue.shift()!
    const entries = await list(dir).catch(() => [])
    for (const entry of entries) {
      if (entry.type === "directory") {
        queue.push(entry.path)
        continue
      }
      files.push(entry.path)
      if (files.length >= limit) break
    }
  }
  return files
}
