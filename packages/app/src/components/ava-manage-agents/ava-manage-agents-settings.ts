export type AgentMode = "primary" | "subagent" | "all"
export type PermissionAction = "allow" | "ask" | "deny"

export const PERMISSION_TOOLS = [
  "read",
  "edit",
  "glob",
  "grep",
  "list",
  "bash",
  "external_directory",
  "todowrite",
  "question",
  "webfetch",
  "websearch",
  "lsp",
  "doom_loop",
  "skill",
] as const

export type PermissionTool = (typeof PERMISSION_TOOLS)[number]

export type AgentSettings = {
  description: string
  mode: AgentMode | ""
  model: string
  variant: string
  temperature: string
  topP: string
  steps: string
  disable: boolean
  hidden: boolean
  color: string
  reasoningEffort: string
  permissions: Record<string, PermissionAction | "">
  taskDefault: PermissionAction | ""
  taskAgents: { name: string; action: PermissionAction }[]
  instructionPaths: string[]
}

export function emptyAgentSettings(): AgentSettings {
  return {
    description: "",
    mode: "primary",
    model: "",
    variant: "",
    temperature: "",
    topP: "",
    steps: "",
    disable: false,
    hidden: false,
    color: "",
    reasoningEffort: "",
    permissions: {},
    taskDefault: "",
    taskAgents: [],
    instructionPaths: [],
  }
}

export function parseAgentSettings(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const yaml = match ? match[1] : ""
  const body = match ? raw.slice(match[0].length) : raw
  const data = parseYamlMap(yaml)
  const permission = isMap(data.permission) ? data.permission : {}
  const options = isMap(data.options) ? data.options : {}
  const task = permission.task
  const settings = emptyAgentSettings()
  settings.description = stringValue(data.description)
  settings.mode = modeValue(data.mode)
  settings.model = stringValue(data.model)
  settings.variant = stringValue(data.variant)
  settings.temperature = numberValue(data.temperature)
  settings.topP = numberValue(data.top_p ?? data.topP)
  settings.steps = numberValue(data.steps ?? data.maxSteps)
  settings.disable = data.disable === true
  settings.hidden = data.hidden === true
  settings.color = stringValue(data.color)
  settings.reasoningEffort = stringValue(options.reasoningEffort)
  settings.instructionPaths = stringList(data.instructions)
  if (typeof task === "string") {
    settings.taskDefault = actionValue(task)
  }
  if (isMap(task)) {
    settings.taskDefault = actionValue(task["*"])
    settings.taskAgents = Object.entries(task).flatMap(([name, value]) => {
      if (name === "*") return []
      const action = actionValue(value)
      if (!action) return []
      return [{ name, action }]
    })
  }
  for (const tool of PERMISSION_TOOLS) {
    const value = actionValue(permission[tool])
    if (value) settings.permissions[tool] = value
  }
  return { settings, body }
}

export function serializeAgentSettings(settings: AgentSettings, fallbackBody = "") {
  const permission: Record<string, unknown> = {}
  for (const tool of PERMISSION_TOOLS) {
    const value = settings.permissions[tool]
    if (value) permission[tool] = value
  }
  if (settings.taskAgents.length > 0) {
    const task: Record<string, string> = {}
    if (settings.taskDefault) task["*"] = settings.taskDefault
    for (const item of settings.taskAgents) {
      if (!item.name.trim()) continue
      task[item.name.trim()] = item.action
    }
    permission.task = task
  } else if (settings.taskDefault) {
    permission.task = settings.taskDefault
  }

  const data: Record<string, unknown> = {}
  if (settings.description.trim()) data.description = settings.description.trim()
  if (settings.mode) data.mode = settings.mode
  if (settings.model.trim()) data.model = settings.model.trim()
  if (settings.variant.trim()) data.variant = settings.variant.trim()
  const temperature = parseOptionalNumber(settings.temperature)
  if (temperature !== undefined) data.temperature = temperature
  const topP = parseOptionalNumber(settings.topP)
  if (topP !== undefined) data.top_p = topP
  const steps = parseOptionalInteger(settings.steps)
  if (steps !== undefined) data.steps = steps
  if (settings.disable) data.disable = true
  if (settings.hidden) data.hidden = true
  if (settings.color.trim()) data.color = settings.color.trim()
  if (settings.instructionPaths.length > 0) data.instructions = settings.instructionPaths
  if (Object.keys(permission).length > 0) data.permission = permission
  if (settings.reasoningEffort.trim()) data.options = { reasoningEffort: settings.reasoningEffort.trim() }

  const body = settings.instructionPaths.length > 0 ? "" : fallbackBody.trim()
  const comments = exampleComments(settings)
  return `---\n${stringifyYaml(data)}${comments}---\n${body ? `\n${body}\n` : "\n"}`
}

function exampleComments(settings: AgentSettings) {
  const lines: string[] = []
  if (!settings.model.trim()) lines.push("# model: anthropic/claude-sonnet-4-5")
  if (!settings.variant.trim()) lines.push("# variant: high")
  if (parseOptionalNumber(settings.temperature) === undefined) lines.push("# temperature: 0.5")
  if (parseOptionalNumber(settings.topP) === undefined) lines.push("# top_p: 1")
  if (parseOptionalInteger(settings.steps) === undefined) lines.push("# steps: 20")
  if (!settings.disable) lines.push("# disable: true")
  if (!settings.hidden) lines.push("# hidden: true")
  if (!settings.color.trim()) lines.push('# color: "#4C6FFF"')
  if (!settings.reasoningEffort.trim()) {
    lines.push("# options:")
    lines.push("#   reasoningEffort: medium")
  }
  const missing = PERMISSION_TOOLS.filter((tool) => !settings.permissions[tool])
  if (missing.length > 0 || (!settings.taskDefault && settings.taskAgents.length === 0)) {
    lines.push("# permission:")
    for (const tool of missing) lines.push(`#   ${tool}: allow`)
    if (!settings.taskDefault && settings.taskAgents.length === 0) {
      lines.push("#   task: ask")
      lines.push("#   # or per helper:")
      lines.push('#   # task:')
      lines.push('#   #   "*": deny')
      lines.push("#   #   explore: allow")
    }
  }
  if (lines.length === 0) return ""
  return `# You can also set:\n${lines.join("\n")}\n`
}

export function parseOptionalNumber(value: string) {
  const next = value.trim()
  if (!next) return
  const parsed = Number(next)
  if (!Number.isFinite(parsed)) return
  return parsed
}

export function parseOptionalInteger(value: string) {
  const parsed = parseOptionalNumber(value)
  if (parsed === undefined) return
  return Math.max(1, Math.round(parsed))
}

function modeValue(value: unknown): AgentMode | "" {
  if (value === "primary" || value === "subagent" || value === "all") return value
  return ""
}

function actionValue(value: unknown): PermissionAction | "" {
  if (value === "allow" || value === "ask" || value === "deny") return value
  return ""
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return value.trim()
  return ""
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item] : []))
}

function isMap(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

type YamlValue = string | number | boolean | YamlValue[] | { [key: string]: YamlValue }

function parseYamlMap(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/)
  const parsed = parseYamlBlock(lines, 0, 0)
  if (isMap(parsed.value)) return parsed.value
  return {}
}

function parseYamlBlock(lines: string[], index: number, indent: number): { value: YamlValue; next: number } {
  const map: Record<string, YamlValue> = {}
  const list: YamlValue[] = []
  let i = index
  let isList: boolean | undefined
  while (i < lines.length) {
    const raw = lines[i] ?? ""
    if (!raw.trim() || raw.trim().startsWith("#")) {
      i += 1
      continue
    }
    const current = leadingSpaces(raw)
    if (current < indent) break
    if (current > indent && i === index) break
    if (current > indent) {
      i += 1
      continue
    }
    const trimmed = raw.slice(current)
    if (trimmed.startsWith("- ")) {
      if (isList === false) break
      isList = true
      const rest = trimmed.slice(2)
      list.push(parseScalar(rest))
      i += 1
      continue
    }
    const entry = trimmed.match(/^("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[A-Za-z0-9_*-]+)\s*:\s*(.*)$/)
    if (!entry) {
      i += 1
      continue
    }
    if (isList === true) break
    isList = false
    const key = unquote(entry[1])
    const after = entry[2].trim()
    if (!after) {
      const nested = parseYamlBlock(lines, i + 1, indent + 2)
      map[key] = nested.value
      i = nested.next
      continue
    }
    map[key] = parseScalar(after)
    i += 1
  }
  return { value: isList ? list : map, next: i }
}

function parseScalar(value: string): YamlValue {
  if (value === "true") return true
  if (value === "false") return false
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return unquote(value)
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return value
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function leadingSpaces(value: string) {
  return value.match(/^ */)?.[0].length ?? 0
}

function stringifyYaml(value: Record<string, unknown>, indent = 0): string {
  const pad = " ".repeat(indent)
  return Object.entries(value)
    .flatMap(([key, item]) => {
      if (item === undefined || item === "") return []
      if (Array.isArray(item)) {
        if (item.length === 0) return []
        return [`${pad}${formatKey(key)}:`, ...item.map((entry) => `${pad}  - ${formatScalar(entry)}`)]
      }
      if (item && typeof item === "object") {
        const nested = stringifyYaml(item as Record<string, unknown>, indent + 2)
        if (!nested.trim()) return []
        return [`${pad}${formatKey(key)}:`, nested.trimEnd()]
      }
      return [`${pad}${formatKey(key)}: ${formatScalar(item)}`]
    })
    .join("\n")
    .concat("\n")
}

function formatKey(key: string) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return key
  return JSON.stringify(key)
}

function formatScalar(value: unknown) {
  if (typeof value === "boolean" || typeof value === "number") return String(value)
  const text = String(value)
  if (text === "" || /[:#\n]/.test(text) || text.includes(" ")) return JSON.stringify(text)
  return text
}
