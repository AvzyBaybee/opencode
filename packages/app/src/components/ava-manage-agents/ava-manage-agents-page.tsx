import { For, Show, createEffect, createMemo, createResource, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DialogFooter, DialogHeader, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"
import { useServerSDK } from "@/context/server-sdk"
import { useSync } from "@/context/sync"
import { showToast } from "@/utils/toast"
import { instructionConfigPath, loadAgents, loadInstructions } from "./ava-manage-agents-files"
import {
  agentTemplate,
  documentId,
  instructionTemplate,
  joinPath,
  parseAgentFile,
  serializeAgentFile,
  slugifyName,
  uniqueSlug,
  type AgentsDocument,
  type AgentsPane,
  type AgentsScope,
} from "./ava-manage-agents-model"
import "./ava-manage-agents.css"

type Draft = { scope: AgentsScope; value: string }

export function AvaManageAgentsPage(props: { pane: AgentsPane }) {
  const language = useLanguage()
  const dialog = useDialog()
  const platform = usePlatform()
  const sdk = useSDK()
  const serverSDK = useServerSDK()
  const sync = useSync()
  const [store, setStore] = createStore({
    selected: undefined as string | undefined,
    draft: undefined as Draft | undefined,
    body: "",
    frontmatter: "",
    dirty: false,
  })
  const access = {
    list: platform.browseListDirectory,
    read: platform.browseReadTextFile,
    write: platform.browseWriteTextFile,
    remove: platform.browseDeletePath,
  }
  const project = () => sdk().directory
  const config = () => sync().data.path.config
  const [docs, { refetch }] = createResource(
    () => `${props.pane}\0${project()}\0${config()}`,
    async (): Promise<AgentsDocument[]> => {
      if (props.pane === "agents") return loadAgents({ access, project: project(), config: config() })
      return loadInstructions({ access, project: project(), config: config() })
    },
    { initialValue: [] },
  )
  const items = createMemo(() => docs.latest ?? [])
  const selected = createMemo(() => items().find((item) => item.id === store.selected))
  const stickyName = (item: AgentsDocument) => {
    if (item.kind !== "instruction" || !item.sticky) return item.name
    return language.t(item.scope === "project" ? "ava.agents.instruction.project" : "ava.agents.instruction.personal")
  }

  const loadSelected = async (item: AgentsDocument | undefined) => {
    if (!item) {
      setStore({ body: "", frontmatter: "", dirty: false })
      return
    }
    const raw = (await access.read?.(item.path)) ?? ""
    if (item.kind === "agent") {
      const parsed = parseAgentFile(raw || agentTemplate(item.name))
      setStore({ frontmatter: parsed.frontmatter, body: parsed.body, dirty: false })
      return
    }
    setStore({ frontmatter: "", body: raw, dirty: false })
  }

  createEffect(
    on(
      () => store.selected,
      (id) => {
        void loadSelected(items().find((item) => item.id === id))
      },
    ),
  )

  let saveTimer: number | undefined
  const persist = async () => {
    const item = selected()
    if (!item || !store.dirty) return
    if (!access.write) {
      showToast({ variant: "error", title: language.t("ava.agents.desktopOnly") })
      return
    }
    const content = item.kind === "agent" ? serializeAgentFile(store.frontmatter, store.body) : store.body
    await access.write(item.path, content).catch((error) => {
      showToast({
        variant: "error",
        title: language.t("ava.agents.saveFailed.title"),
        description: error instanceof Error ? error.message : String(error),
      })
    })
    setStore("dirty", false)
  }

  const scheduleSave = () => {
    setStore("dirty", true)
    if (saveTimer !== undefined) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => void persist(), 400)
  }
  onCleanup(() => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer)
    void persist()
  })

  const createItem = async (scope: AgentsScope, name: string) => {
    const value = name.trim()
    setStore("draft", undefined)
    if (!value) return
    if (!access.write) {
      showToast({ variant: "error", title: language.t("ava.agents.desktopOnly") })
      return
    }
    const slug = uniqueSlug(
      slugifyName(value),
      new Set(items().filter((item) => item.scope === scope).map((item) => item.slug)),
    )
    const target =
      props.pane === "agents"
        ? scope === "project"
          ? joinPath(project(), ".opencode", "agents", `${slug}.md`)
          : joinPath(config(), "agents", `${slug}.md`)
        : scope === "project"
          ? joinPath(project(), ".opencode", "instructions", `${slug}.md`)
          : joinPath(config(), "instructions", `${slug}.md`)
    await access.write(target, props.pane === "agents" ? agentTemplate(value) : instructionTemplate(value))
    if (props.pane === "instructions") {
      const listed = instructionConfigPath(scope === "project" ? project() : config(), target)
      await updateInstructions(scope, (current) => (current.includes(listed) ? current : [...current, listed]))
    }
    await refetch()
    setStore({
      selected: documentId(props.pane === "agents" ? "agent" : "instruction", scope, target),
      draft: undefined,
    })
  }

  const updateInstructions = async (scope: AgentsScope, next: (current: string[]) => string[]) => {
    if (scope === "project") {
      const current = [...(sync().data.config.instructions ?? [])]
      await sdk().client.config.update({ directory: project(), config: { instructions: next(current) } })
      return
    }
    const current = [...((await serverSDK().client.global.config.get()).data?.instructions ?? [])]
    await serverSDK().client.global.config.update({ config: { instructions: next(current) } })
  }

  const removeItem = async (item: AgentsDocument) => {
    if (item.sticky || !access.remove) return
    await persist()
    await access.remove(item.path).catch((error) => {
      showToast({
        variant: "error",
        title: language.t("ava.agents.deleteFailed.title"),
        description: error instanceof Error ? error.message : String(error),
      })
    })
    if (item.kind === "instruction" && item.configPath) {
      await updateInstructions(item.scope, (current) => current.filter((value) => value !== item.configPath))
    }
    if (store.selected === item.id) setStore("selected", undefined)
    await refetch()
  }

  const askRemove = (item: AgentsDocument) => {
    const name = stickyName(item)
    const kind = item.kind === "agent" ? "agent" : "instruction"
    dialog.show(() => (
      <DialogDeleteDocument
        title={language.t(kind === "agent" ? "ava.agents.delete.title.agent" : "ava.agents.delete.title.instruction")}
        confirm={language.t(
          kind === "agent" ? "ava.agents.delete.confirm.agent" : "ava.agents.delete.confirm.instruction",
          { name },
        )}
        action={language.t("ava.agents.delete")}
        onConfirm={() => void removeItem(item)}
      />
    ))
  }

  const grouped = (scope: AgentsScope) => items().filter((item) => item.scope === scope)

  return (
    <div class="ava-manage-agents">
      <aside class="ava-manage-agents-sidebar">
        <div class="ava-manage-agents-list">
          <ScopeGroup
            title={language.t("ava.agents.scope.project")}
            items={grouped("project")}
            selected={store.selected}
            draft={store.draft?.scope === "project" ? store.draft.value : undefined}
            label={stickyName}
            newLabel={props.pane === "agents" ? language.t("ava.agents.new.agent") : language.t("ava.agents.new.instruction")}
            deleteLabel={language.t("ava.agents.delete")}
            placeholder={language.t("ava.agents.name.placeholder")}
            onSelect={(id) => {
              void persist()
              setStore("selected", id)
            }}
            onDelete={askRemove}
            onStartCreate={() => setStore("draft", { scope: "project", value: "" })}
            onDraft={(value) => setStore("draft", { scope: "project", value })}
            onCommit={(value) => void createItem("project", value)}
            onCancel={() => setStore("draft", undefined)}
          />
          <ScopeGroup
            title={language.t("ava.agents.scope.global")}
            items={grouped("global")}
            selected={store.selected}
            draft={store.draft?.scope === "global" ? store.draft.value : undefined}
            label={stickyName}
            newLabel={props.pane === "agents" ? language.t("ava.agents.new.agent") : language.t("ava.agents.new.instruction")}
            deleteLabel={language.t("ava.agents.delete")}
            placeholder={language.t("ava.agents.name.placeholder")}
            onSelect={(id) => {
              void persist()
              setStore("selected", id)
            }}
            onDelete={askRemove}
            onStartCreate={() => setStore("draft", { scope: "global", value: "" })}
            onDraft={(value) => setStore("draft", { scope: "global", value })}
            onCommit={(value) => void createItem("global", value)}
            onCancel={() => setStore("draft", undefined)}
          />
        </div>
      </aside>
      <main class="ava-manage-agents-main">
        <Show
          when={selected()}
          fallback={
            <div class="ava-manage-agents-empty">
              {language.t(props.pane === "agents" ? "ava.agents.empty.agent" : "ava.agents.empty.instruction")}
            </div>
          }
        >
          <textarea
            class="ava-manage-agents-editor"
            value={store.body}
            spellcheck={false}
            onInput={(event) => {
              setStore("body", event.currentTarget.value)
              scheduleSave()
            }}
            onBlur={() => void persist()}
          />
        </Show>
      </main>
    </div>
  )
}

function ScopeGroup(props: {
  title: string
  items: AgentsDocument[]
  selected?: string
  draft?: string
  label: (item: AgentsDocument) => string
  newLabel: string
  deleteLabel: string
  placeholder: string
  onSelect: (id: string) => void
  onDelete: (item: AgentsDocument) => void
  onStartCreate: () => void
  onDraft: (value: string) => void
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  return (
    <section class="ava-manage-agents-group">
      <div class="ava-manage-agents-group-title">
        <span>{props.title}</span>
        <IconButtonV2
          type="button"
          size="small"
          variant="ghost-muted"
          aria-label={props.newLabel}
          icon={<Icon name="plus" />}
          onClick={props.onStartCreate}
        />
      </div>
      <For each={props.items}>
        {(item) => (
          <div class="ava-manage-agents-row" data-active={props.selected === item.id} onClick={() => props.onSelect(item.id)}>
            <span class="ava-manage-agents-row-label">{props.label(item)}</span>
            <Show when={!item.sticky}>
              <IconButtonV2
                type="button"
                size="small"
                variant="ghost-muted"
                class="ava-manage-agents-row-delete"
                aria-label={props.deleteLabel}
                icon={<Icon name="trash" />}
                onClick={(event) => {
                  event.stopPropagation()
                  props.onDelete(item)
                }}
              />
            </Show>
          </div>
        )}
      </For>
      <Show when={props.draft !== undefined}>
        <div class="ava-manage-agents-create">
          <input
            ref={(element) => requestAnimationFrame(() => element.focus())}
            value={props.draft}
            placeholder={props.placeholder}
            aria-label={props.newLabel}
            onInput={(event) => props.onDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                props.onCommit(props.draft ?? "")
                return
              }
              if (event.key === "Escape") {
                event.preventDefault()
                props.onCancel()
              }
            }}
            onBlur={() => {
              if (props.draft?.trim()) props.onCommit(props.draft)
              else props.onCancel()
            }}
          />
        </div>
      </Show>
    </section>
  )
}

function DialogDeleteDocument(props: {
  title: string
  confirm: string
  action: string
  onConfirm: () => void
}) {
  const language = useLanguage()
  const dialog = useDialog()
  return (
    <DialogV2 fit>
      <DialogHeader hideClose>
        <DialogTitleGroup title={props.title} description={props.confirm} />
      </DialogHeader>
      <DialogFooter>
        <ButtonV2 variant="ghost" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </ButtonV2>
        <ButtonV2
          variant="danger"
          onClick={() => {
            dialog.close()
            props.onConfirm()
          }}
        >
          {props.action}
        </ButtonV2>
      </DialogFooter>
    </DialogV2>
  )
}
