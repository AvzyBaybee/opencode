import { For, Show, createMemo, type JSX } from "solid-js"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Switch } from "@opencode-ai/ui/v2/switch-v2"
import { useLanguage } from "@/context/language"
import type { InstructionDocument } from "./ava-manage-agents-model"
import {
  PERMISSION_TOOLS,
  type AgentMode,
  type AgentSettings,
  type PermissionAction,
  type PermissionTool,
} from "./ava-manage-agents-settings"

const MODES: AgentMode[] = ["primary", "subagent", "all"]
const ACTIONS: PermissionAction[] = ["allow", "ask", "deny"]
const EFFORTS = ["", "minimal", "low", "medium", "high"]

export function AvaAgentSettingsForm(props: {
  settings: AgentSettings
  instructions: InstructionDocument[]
  instructionLabel: (item: InstructionDocument) => string
  onChange: (settings: AgentSettings) => void
}) {
  const language = useLanguage()
  const ambient = createMemo(() =>
    [...props.instructions].sort((left, right) => {
      if (left.scope === right.scope) return 0
      return left.scope === "global" ? -1 : 1
    }),
  )
  const ambientPaths = createMemo(() => new Set(ambient().map((item) => item.path)))
  const exclusive = createMemo(() =>
    props.settings.instructionPaths.filter((path) => !ambientPaths().has(path) && !/(?:^|[\\/])AGENTS\.md$/i.test(path)),
  )
  const exclusiveDocs = createMemo(() =>
    exclusive().map((path) => ({
      path,
      name: path.split(/[\\/]/).pop() ?? path,
    })),
  )

  const patch = (next: Partial<AgentSettings>) => props.onChange({ ...props.settings, ...next })

  return (
    <ScrollView class="ava-agent-form" thumbVisibility="hover">
      <section class="ava-agent-form-section">
        <div class="ava-agent-form-heading">{language.t("ava.agents.form.instructions")}</div>
        <For
          each={ambient()}
          fallback={<div class="ava-agent-picker-empty">{language.t("ava.agents.form.instructions.none")}</div>}
        >
          {(item) => (
            <div class="ava-agent-chip" data-locked="true">
              <span class="ava-agent-chip-scope">
                {item.scope === "global"
                  ? language.t("ava.agents.form.instructions.scope.global")
                  : language.t("ava.agents.form.instructions.scope.project")}
              </span>
              <span>{props.instructionLabel(item)}</span>
            </div>
          )}
        </For>
        <For each={exclusiveDocs()}>
          {(item) => (
            <div class="ava-agent-chip">
              <span>{item.name}</span>
              <IconButtonV2
                type="button"
                size="small"
                variant="ghost-muted"
                aria-label={language.t("ava.agents.form.instructions.remove")}
                icon={<Icon name="close" />}
                onClick={() =>
                  patch({ instructionPaths: exclusive().filter((path) => path !== item.path) })
                }
              />
            </div>
          )}
        </For>
      </section>

      <Field label={language.t("ava.agents.form.description")}>
        <input
          class="ava-agent-input"
          value={props.settings.description}
          onInput={(event) => patch({ description: event.currentTarget.value })}
        />
      </Field>
      <Field label={language.t("ava.agents.form.role")}>
        <select
          class="ava-agent-input"
          value={props.settings.mode}
          onChange={(event) => patch({ mode: event.currentTarget.value as AgentMode | "" })}
        >
          <For each={MODES}>
            {(mode) => <option value={mode}>{roleLabel(language, mode)}</option>}
          </For>
        </select>
      </Field>
      <Field label={language.t("ava.agents.form.model")} hint={language.t("ava.agents.form.model.hint")}>
        <input
          class="ava-agent-input"
          value={props.settings.model}
          placeholder={language.t("ava.agents.form.model.placeholder")}
          onInput={(event) => patch({ model: event.currentTarget.value })}
        />
      </Field>
      <Field label={language.t("ava.agents.form.variant")}>
        <input
          class="ava-agent-input"
          value={props.settings.variant}
          onInput={(event) => patch({ variant: event.currentTarget.value })}
        />
      </Field>
      <SliderField
        label={language.t("ava.agents.form.temperature")}
        value={props.settings.temperature}
        fallback={0.5}
        onChange={(value) => patch({ temperature: value })}
      />
      <SliderField
        label={language.t("ava.agents.form.topP")}
        value={props.settings.topP}
        fallback={1}
        onChange={(value) => patch({ topP: value })}
      />
      <Field label={language.t("ava.agents.form.steps")} hint={language.t("ava.agents.form.steps.hint")}>
        <input
          class="ava-agent-input"
          inputMode="numeric"
          value={props.settings.steps}
          onInput={(event) => patch({ steps: event.currentTarget.value })}
        />
      </Field>
      <Field label={language.t("ava.agents.form.color")} hint={language.t("ava.agents.form.color.hint")}>
        <input
          class="ava-agent-input"
          value={props.settings.color}
          placeholder="#4C6FFF"
          onInput={(event) => patch({ color: event.currentTarget.value })}
        />
      </Field>
      <Field label={language.t("ava.agents.form.reasoning")} hint={language.t("ava.agents.form.reasoning.hint")}>
        <select
          class="ava-agent-input"
          value={props.settings.reasoningEffort}
          onChange={(event) => patch({ reasoningEffort: event.currentTarget.value })}
        >
          <For each={EFFORTS}>
            {(effort) => (
              <option value={effort}>
                {effort ? effortLabel(language, effort) : language.t("ava.agents.form.default")}
              </option>
            )}
          </For>
        </select>
      </Field>
      <div class="ava-agent-form-row ava-agent-form-switches">
        <Switch checked={props.settings.disable} onChange={(value) => patch({ disable: value })}>
          {language.t("ava.agents.form.disable")}
        </Switch>
        <Switch checked={props.settings.hidden} onChange={(value) => patch({ hidden: value })}>
          {language.t("ava.agents.form.hidden")}
        </Switch>
      </div>

      <section class="ava-agent-form-section">
        <div class="ava-agent-form-heading">{language.t("ava.agents.form.permissions")}</div>
        <For each={PERMISSION_TOOLS}>
          {(tool) => (
            <label class="ava-agent-perm">
              <span>{permissionLabel(language, tool)}</span>
              <select
                class="ava-agent-input ava-agent-perm-select"
                value={props.settings.permissions[tool] ?? ""}
                onChange={(event) =>
                  patch({
                    permissions: {
                      ...props.settings.permissions,
                      [tool]: event.currentTarget.value as PermissionAction | "",
                    },
                  })
                }
              >
                <option value="">{language.t("ava.agents.form.default")}</option>
                <For each={ACTIONS}>
                  {(action) => <option value={action}>{actionLabel(language, action)}</option>}
                </For>
              </select>
            </label>
          )}
        </For>
        <Field label={language.t("ava.agents.form.taskDefault")} hint={language.t("ava.agents.form.taskDefault.hint")}>
          <select
            class="ava-agent-input"
            value={props.settings.taskDefault}
            onChange={(event) => patch({ taskDefault: event.currentTarget.value as PermissionAction | "" })}
          >
            <option value="">{language.t("ava.agents.form.default")}</option>
            <For each={ACTIONS}>
              {(action) => <option value={action}>{actionLabel(language, action)}</option>}
            </For>
          </select>
        </Field>
        <div class="ava-agent-form-heading">{language.t("ava.agents.form.taskAgents")}</div>
        <For each={props.settings.taskAgents}>
          {(item, index) => (
            <div class="ava-agent-task-row">
              <input
                class="ava-agent-input"
                value={item.name}
                placeholder={language.t("ava.agents.form.taskAgents.name")}
                onInput={(event) => {
                  const taskAgents = props.settings.taskAgents.map((entry, i) =>
                    i === index() ? { ...entry, name: event.currentTarget.value } : entry,
                  )
                  patch({ taskAgents })
                }}
              />
              <select
                class="ava-agent-input ava-agent-perm-select"
                value={item.action}
                onChange={(event) => {
                  const taskAgents = props.settings.taskAgents.map((entry, i) =>
                    i === index() ? { ...entry, action: event.currentTarget.value as PermissionAction } : entry,
                  )
                  patch({ taskAgents })
                }}
              >
                <For each={ACTIONS}>
                  {(action) => <option value={action}>{actionLabel(language, action)}</option>}
                </For>
              </select>
              <IconButtonV2
                type="button"
                size="small"
                variant="ghost-muted"
                aria-label={language.t("ava.agents.form.taskAgents.remove")}
                icon={<Icon name="close" />}
                onClick={() => patch({ taskAgents: props.settings.taskAgents.filter((_, i) => i !== index()) })}
              />
            </div>
          )}
        </For>
        <button
          type="button"
          class="ava-agent-add"
          onClick={() => patch({ taskAgents: [...props.settings.taskAgents, { name: "", action: "allow" }] })}
        >
          {language.t("ava.agents.form.taskAgents.add")}
        </button>
      </section>
    </ScrollView>
  )
}

function roleLabel(language: ReturnType<typeof useLanguage>, mode: AgentMode) {
  if (mode === "primary") return language.t("ava.agents.form.role.chat")
  if (mode === "subagent") return language.t("ava.agents.form.role.helper")
  return language.t("ava.agents.form.role.both")
}

function actionLabel(language: ReturnType<typeof useLanguage>, action: PermissionAction) {
  if (action === "allow") return language.t("ava.agents.form.action.allow")
  if (action === "ask") return language.t("ava.agents.form.action.ask")
  return language.t("ava.agents.form.action.deny")
}

function effortLabel(language: ReturnType<typeof useLanguage>, effort: string) {
  if (effort === "minimal") return language.t("ava.agents.form.reasoning.minimal")
  if (effort === "low") return language.t("ava.agents.form.reasoning.low")
  if (effort === "medium") return language.t("ava.agents.form.reasoning.medium")
  return language.t("ava.agents.form.reasoning.high")
}

function permissionLabel(language: ReturnType<typeof useLanguage>, tool: PermissionTool) {
  if (tool === "read") return language.t("ava.agents.form.permission.read")
  if (tool === "edit") return language.t("ava.agents.form.permission.edit")
  if (tool === "glob") return language.t("ava.agents.form.permission.glob")
  if (tool === "grep") return language.t("ava.agents.form.permission.grep")
  if (tool === "list") return language.t("ava.agents.form.permission.list")
  if (tool === "bash") return language.t("ava.agents.form.permission.bash")
  if (tool === "external_directory") return language.t("ava.agents.form.permission.outside")
  if (tool === "todowrite") return language.t("ava.agents.form.permission.todos")
  if (tool === "question") return language.t("ava.agents.form.permission.question")
  if (tool === "webfetch") return language.t("ava.agents.form.permission.webfetch")
  if (tool === "websearch") return language.t("ava.agents.form.permission.websearch")
  if (tool === "lsp") return language.t("ava.agents.form.permission.lsp")
  if (tool === "doom_loop") return language.t("ava.agents.form.permission.loop")
  return language.t("ava.agents.form.permission.skill")
}

function unitValue(raw: string, fallback: number) {
  const parsed = Number(raw)
  if (!raw.trim() || !Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

function SliderField(props: { label: string; value: string; fallback: number; onChange: (value: string) => void }) {
  const current = () => unitValue(props.value, props.fallback)
  return (
    <label class="ava-agent-field">
      <span class="ava-agent-field-label">{props.label}</span>
      <div class="ava-agent-slider">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={current()}
          aria-label={props.label}
          onInput={(event) => props.onChange(Number(event.currentTarget.value).toFixed(2))}
        />
        <span class="ava-agent-slider-value">{current().toFixed(2)}</span>
      </div>
    </label>
  )
}

function Field(props: { label: string; hint?: string; children: JSX.Element }) {
  return (
    <label class="ava-agent-field">
      <span class="ava-agent-field-label">{props.label}</span>
      {props.children}
      <Show when={props.hint}>{(hint) => <span class="ava-agent-field-hint">{hint()}</span>}</Show>
    </label>
  )
}
