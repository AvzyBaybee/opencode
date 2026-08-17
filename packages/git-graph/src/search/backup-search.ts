import { backupLabel, type GitGraphCommit } from "../domain/contract"

export type BackupSearchHit = {
  readonly id: string
  readonly label: string
  readonly score: number
}

const LIMIT = 50

export function rankBackups(commits: readonly GitGraphCommit[], query: string, limit = LIMIT) {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return commits
    .flatMap((commit) => {
      const label = backupLabel(commit)
      const score = Math.max(fuzzyScore(needle, label), fuzzyScore(needle, commit.id.slice(0, 12)))
      if (score < 0) return []
      return [{ id: commit.id, label, score }]
    })
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export function fuzzyScore(query: string, text: string) {
  const haystack = text.toLowerCase()
  const at = haystack.indexOf(query)
  if (at >= 0) return 2000 - at - Math.max(0, haystack.length - query.length)
  let qi = 0
  let score = 0
  let prev = -2
  for (let i = 0; i < haystack.length && qi < query.length; i++) {
    if (haystack[i] !== query[qi]) continue
    score += prev + 1 === i ? 6 : 1
    prev = i
    qi += 1
  }
  if (qi !== query.length) return -1
  return score
}
