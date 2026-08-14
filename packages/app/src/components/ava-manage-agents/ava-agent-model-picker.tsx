import { For, Show, createMemo, createSignal } from "solid-js"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { useLanguage } from "@/context/language"
import { useModels } from "@/context/models"
import { matchesModelSearch } from "@/components/dialog-select-model-search"

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
  const selected = createMemo(() => {
    const value = props.value.trim()
    if (!value) return
    return visible().find((item) => modelValue(item) === value)
  })
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

export function AvaAgentVariantPicker(props: {
  model: string
  value: string
  onChange: (value: string) => void
}) {
  const language = useLanguage()
  const models = useModels()
  const variants = createMemo(() => {
    const value = props.model.trim()
    if (!value) return [] as string[]
    const slash = value.indexOf("/")
    if (slash <= 0) return []
    const item = models.find({ providerID: value.slice(0, slash), modelID: value.slice(slash + 1) })
    return Object.keys(item?.variants ?? {})
  })

  return (
    <select
      class="ava-agent-input"
      value={props.value}
      disabled={variants().length === 0}
      onChange={(event) => props.onChange(event.currentTarget.value)}
    >
      <option value="">{language.t("ava.agents.form.variant.placeholder")}</option>
      <For each={variants()}>{(variant) => <option value={variant}>{variant}</option>}</For>
    </select>
  )
}

function modelValue(item: { id: string; provider: { id: string } }) {
  return `${item.provider.id}/${item.id}`
}
