export function parsePathReference(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { path: trimmed }

  const windows = trimmed.match(/^([a-zA-Z]:[\\/].+?):(\d+)(?::\d+)?$/)
  if (windows?.[1]) return { path: windows[1] }

  const column = trimmed.match(/^(.*):(\d+):(\d+)$/)
  if (column?.[1] && lineSuffixPath(column[1])) return { path: column[1] }

  const line = trimmed.match(/^(.*):(\d+)$/)
  if (line?.[1] && lineSuffixPath(line[1])) return { path: line[1] }

  return { path: trimmed }
}

function lineSuffixPath(candidate: string) {
  const base = candidate.split(/[/\\]/).pop() ?? ""
  return base.includes(".") || candidate.includes("/") || candidate.includes("\\")
}

export function resolvePathReference(text: string, directory?: string) {
  const { path } = parsePathReference(text)
  if (!path) return
  if (/^[a-zA-Z]:[\\/]/.test(path)) return path
  if (path.startsWith("/") || path.startsWith("\\\\")) return path
  if (!directory) return path

  const separator = directory.includes("\\") ? "\\" : "/"
  const normalized = path.replace(/[/\\]/g, separator)
  const base = directory.endsWith(separator) ? directory.slice(0, -1) : directory
  if (normalized.startsWith(separator)) return normalized
  return `${base}${separator}${normalized}`
}
