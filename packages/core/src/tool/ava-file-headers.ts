export type HeaderName = "SYNOPSIS" | "RULES"

export type Header = {
  readonly name: HeaderName
  readonly line: number
  readonly text: string
}

export type State = {
  readonly seen: Map<string, Set<HeaderName>>
}

export const MAX_SCAN_LINES = 30

const HEADER_NAMES = ["SYNOPSIS", "RULES"] as const
const HEADER_PATTERN = /^(SYNOPSIS|RULES)\s*:\s*(.*?)\s*$/i

export function createState(): State {
  return { seen: new Map() }
}

export function extract(lines: ReadonlyArray<string>, lineOffset = 1): Header[] {
  const headers: Header[] = []

  for (const [index, line] of lines.slice(0, MAX_SCAN_LINES).entries()) {
    const match = HEADER_PATTERN.exec(stripCommentPrefix(line))
    if (!match) continue

    const name = match[1]!.toUpperCase() as HeaderName
    if (!HEADER_NAMES.includes(name) || headers.some((header) => header.name === name)) continue

    headers.push({
      name,
      line: lineOffset + index,
      text: match[2]!,
    })
  }

  return headers
}

export function augment(input: {
  readonly state: State
  readonly filepath: string
  readonly headers: ReadonlyArray<Header>
  readonly pageStart: number
  readonly pageEnd: number
}): string | undefined {
  const seen = input.state.seen.get(input.filepath) ?? new Set<HeaderName>()
  const missing: Header[] = []

  for (const header of input.headers) {
    if (header.line >= input.pageStart && header.line <= input.pageEnd) {
      seen.add(header.name)
      continue
    }
    if (seen.has(header.name)) continue
    seen.add(header.name)
    missing.push(header)
  }

  if (missing.length === 0) {
    input.state.seen.set(input.filepath, seen)
    return
  }

  input.state.seen.set(input.filepath, seen)
  return format(missing, input.filepath)
}

export function format(headers: ReadonlyArray<Header>, filepath: string) {
  return [
    `[File context from ${filepath}]`,
    ...headers.map((header) => `${header.name}: ${header.text}`),
    "[End file context]",
  ].join("\n")
}

function stripCommentPrefix(line: string) {
  return line
    .replace(/^\s*(?:\/\/|#|--|\/\*+|\*+\/|\*)\s*/, "")
    .replace(/\s*\*\/\s*$/, "")
    .trim()
}
