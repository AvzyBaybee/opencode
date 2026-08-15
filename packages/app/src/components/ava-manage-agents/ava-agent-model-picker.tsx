import { For, Show, createMemo, createSignal } from "solid-js"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { useLanguage } from "@/context/language"
import { useLocal } from "@/context/local"
import { useModels } from "@/context/models"
import { matchesModelSearch } from "@/components/dialog-select-model-search"
import {
  applyReasoningEffort,
  findModelByValue,
  modelValue,
  reasoningEffortChoices,
  selectedReasoningEffort,
} from "./ava-agent-model"

export function AvaAgentModelPicker(props: { value: string; onChange: (value: string) => void }) {
  const language = useLanguage()
  const models = useModels()
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")

  const visible = createMemo(() =>
    models.list().filter((item) => models.visible({ modelID: item.id, providerID: item.provider.id })),
  )
  const filtered = createMemo(() => {
    const needle = query()
    return visible().filter((item) =>
      matchesModelSearch(needle, [item.name, item.id, item.provider.name, item.provider.id, modelValue(item)]),
    )
  })
  const selected = createMemo(() => findModelByValue(visible(), props.value))
  const label = () => {
    const item = selected()
    if (item) return `${item.provider.name} / ${item.name}`
    if (props.value.trim()) return props.value.trim()
    return language.t("ava.agents.form.model.placeholder")
  }

  return (
    <div class="ava-agent-model-picker">
      <button
        type="button"
        class="ava-agent-input ava-agent-model-trigger"
        aria-expanded={open()}
        aria-label={language.t("ava.agents.form.model")}
        onClick={() => {
          setOpen((current) => !current)
          setQuery("")
        }}
      >
        {label()}
      </button>
      <Show when={open()}>
        <div class="ava-agent-picker ava-agent-model-menu">
          <input
            class="ava-agent-input"
            value={query()}
            placeholder={language.t("ava.agents.form.model.search")}
            onInput={(event) => setQuery(event.currentTarget.value)}
            ref={(element) => requestAnimationFrame(() => element.focus())}
          />
          <ScrollView class="ava-agent-picker-list" thumbVisibility="hover">
            <button
              type="button"
              class="ava-agent-picker-item"
              data-active={!props.value.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                props.onChange("")
                setOpen(false)
              }}
            >
              {language.t("ava.agents.form.model.placeholder")}
            </button>
            <For
              each={filtered()}
              fallback={<div class="ava-agent-picker-empty">{language.t("ava.agents.form.model.empty")}</div>}
            >
              {(item) => (
                <button
                  type="button"
                  class="ava-agent-picker-item"
                  data-active={props.value.trim() === modelValue(item)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    props.onChange(modelValue(item))
                    setOpen(false)
                  }}
                >
                  <span>{item.name}</span>
                  <span class="ava-agent-chip-scope">{item.provider.name}</span>
                </button>
              )}
            </For>
          </ScrollView>
        </div>
      </Show>
    </div>
  )
}

export function AvaAgentReasoningPicker(props: {
  model: string
  variant: string
  reasoningEffort: string
  onChange: (next: { model: string; variant: string; reasoningEffort: string }) => void
}) {
  const language = useLanguage()
  const models = useModels()
  const local = useLocal()
  const resolved = createMemo(() => {
    const pinned = findModelByValue(models.list(), props.model)
    if (pinned) return pinned
    if (props.model.trim()) return
    return local.model.current()
  })
  const choices = createMemo(() => reasoningEffortChoices(resolved()?.variants))
  const selected = createMemo(() =>
    selectedReasoningEffort({
      source: choices().source,
      values: choices().values,
      variant: props.variant,
      reasoningEffort: props.reasoningEffort,
    }),
  )

  return (
    <select
      class="ava-agent-input"
      value={selected()}
      aria-label={language.t("ava.agents.form.reasoning")}
      onChange={(event) => {
        const item = resolved()
        props.onChange(
          applyReasoningEffort({
            source: choices().source,
            value: event.currentTarget.value,
            model: props.model,
            resolvedModel: item ? modelValue(item) : undefined,
          }),
        )
      }}
    >
      <option value="">{language.t("ava.agents.form.default")}</option>
      <For each={choices().values}>
        {(value) => <option value={value}>{reasoningLabel(language, value)}</option>}
      </For>
    </select>
  )
}

function reasoningLabel(language: ReturnType<typeof useLanguage>, value: string) {
  if (value === "minimal") return language.t("ava.agents.form.reasoning.minimal")
  if (value === "low") return language.t("ava.agents.form.reasoning.low")
  if (value === "medium") return language.t("ava.agents.form.reasoning.medium")
  if (value === "high") return language.t("ava.agents.form.reasoning.high")
  return value
}
