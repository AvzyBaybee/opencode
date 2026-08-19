import { For, Show, createEffect, createMemo, createResource, createSignal, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { DialogFooter, DialogHeader, DialogTitleGroup, DialogV2 } from "@opencode-ai/ui/v2/dialog-v2"
import { AvaEmptyState } from "@/components/ava-empty-state"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"
import { useServerSDK } from "@/context/server-sdk"
import { useSync } from "@/context/sync"
import { showToast } from "@/utils/toast"
import { AvaFileContextMenu, useAvaFileContextMenu } from "@/components/ava-side-panel/ava-file-context-menu"
import { TruncatedCursorTooltip, isTextTruncated } from "@/components/truncated-cursor-tooltip"
import { AvaAgentSettingsForm } from "./ava-agent-settings-form"
import {
  exclusiveInstructionPaths,
  extractAgentPromptFiles,
  isAgentsLibraryFile,
  loadAgents,
  loadInstructions,
  matchesInstructionPath,
} from "./ava-manage-agents-files"
import { avaAgentsLive, bumpAvaAgentsLibrary, clearAvaInstructionFocus, openAvaInstruction } from "./ava-manage-agents-live"
import {
  agentTemplate,
  documentId,
  instructionTemplate,
  joinPath,
  slugifyName,
  uniqueSlug,
  type AgentsDocument,
  type AgentsPane,
  type AgentsScope,
  type InstructionDocument,
} from "./ava-manage-agents-model"
import { emptyAgentSettings, parseAgentSettings, serializeAgentSettings, type AgentSettings } from "./ava-manage-agents-settings"
import "./ava-manage-agents.css"

type Draft = { scope: AgentsScope; value: string }

export function AvaManageAgentsPage(props: { pane: AgentsPane; active?: boolean; sidebarWidth?: () => number }) {
  const language = useLanguage()
  const dialog = useDialog()
  const platform = usePlatform()
  const sdk = useSDK()
  const serverSDK = useServerSDK()
  const sync = useSync()
  const [store, setStore] = createStore({
    selected: undefined as string | undefined,
    draft: undefined as Draft | undefined,
    query: "",
    body: "",
    settings: emptyAgentSettings() as AgentSettings,
    documentMode: false,
    document: "",
    dirty: false,
  })
  const access = {
    list: platform.browseListDirectory,
    read: platform.browseReadTextFile,
    write: platform.browseWriteTextFile,
    remove: platform.browseDeletePath,
  }
  const menu = useAvaFileContextMenu()
  const canReveal = () => platform.platform === "desktop" && !!platform.revealPath
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
  const [instructionDocs, { refetch: refetchInstructions }] = createResource(
    () => `${project()}\0${config()}`,
    () => loadInstructions({ access, project: project(), config: config() }),
    { initialValue: [] as InstructionDocument[] },
  )
  const items = createMemo(() => {
    const needle = store.query.trim().toLowerCase()
    const all = docs.latest ?? []
    if (!needle) return all
    return all.filter((item) => stickyName(item).toLowerCase().includes(needle))
  })
  const allDocs = () => docs.latest ?? []
  const selected = createMemo(() => allDocs().find((item) => item.id === store.selected))
  const stickyName = (item: AgentsDocument) => {
    if (item.kind !== "instruction" || !item.sticky) return item.name
    return language.t(item.scope === "project" ? "ava.agents.instruction.project" : "ava.agents.instruction.personal")
  }

  const loadSelected = async (item: AgentsDocument | undefined) => {
    if (!item) {
      setStore({ body: "", settings: emptyAgentSettings(), documentMode: false, document: "", dirty: false })
      return
    }
    const raw = (await access.read?.(item.path)) ?? ""
    if (item.kind === "agent") {
      if (store.documentMode) {
        if (raw === store.document) {
          setStore("dirty", false)
          return
        }
        setStore({ document: raw, dirty: false })
        return
      }
      const parsed = parseAgentSettings(raw || agentTemplate(item.name))
      parsed.settings.instructionPaths = exclusiveInstructionPaths(parsed.settings.instructionPaths)
      if (sameAgentDraft(parsed.settings, parsed.body, store.settings, store.body)) {
        setStore("dirty", false)
        return
      }
      setStore({ ...parsed, documentMode: false, document: "", dirty: false })
      return
    }
    if (raw === store.body) {
      setStore("dirty", false)
      return
    }
    setStore({ body: raw, documentMode: false, document: "", dirty: false })
  }

  createEffect(
    on(
      () => store.selected,
      (id) => {
        void loadSelected(allDocs().find((item) => item.id === id))
      },
    ),
  )

  let saveTimer: number | undefined
  const agentDocument = async () => {
    const settings = {
      ...store.settings,
      instructionPaths: exclusiveInstructionPaths(store.settings.instructionPaths),
    }
    return serializeAgentSettings(settings, store.body)
  }

  const persist = async () => {
    const item = selected()
    if (!item || !store.dirty) return
    if (!access.write) {
      showToast({ variant: "error", title: language.t("ava.agents.desktopOnly") })
      return
    }
    const content =
      item.kind === "agent"
        ? store.documentMode
          ? store.document
          : await agentDocument()
        : store.body
    await access.write(item.path, content).catch((error) => {
      showToast({
        variant: "error",
        title: language.t("ava.agents.saveFailed.title"),
        description: error instanceof Error ? error.message : String(error),
      })
    })
    setStore("dirty", false)
    bumpAvaAgentsLibrary()
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

  const toggleDocument = async () => {
    if (store.documentMode) {
      const parsed = parseAgentSettings(store.document)
      setStore({ documentMode: false, settings: parsed.settings, body: parsed.body, dirty: true })
      scheduleSave()
      return
    }
    await persist()
    setStore({ documentMode: true, document: await agentDocument() })
  }

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
      new Set(allDocs().filter((item) => item.scope === scope).map((item) => item.slug)),
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
    await refetch()
    bumpAvaAgentsLibrary()
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

  const live = avaAgentsLive()
  let reloadTimer: number | undefined
  const refreshLibrary = async () => {
    const next = (await refetch()) ?? []
    if (props.pane === "agents") await refetchInstructions()
    const item = next.find((entry) => entry.id === store.selected)
    if (!item) {
      if (store.selected) setStore("selected", undefined)
      return
    }
    if (store.dirty) return
    await loadSelected(item)
  }
  const scheduleLibraryReload = () => {
    if (reloadTimer !== undefined) window.clearTimeout(reloadTimer)
    reloadTimer = window.setTimeout(() => void refreshLibrary(), 200)
  }

  createEffect(
    on(
      () => `${project()}\0${config()}`,
      () => {
        void extractAgentPromptFiles({ access, project: project(), config: config() }).then(async (changed) => {
          if (!changed) return
          await refetch()
          await refetchInstructions()
          const id = store.selected
          if (!id) return
          await loadSelected((docs.latest ?? []).find((item) => item.id === id))
        })
      },
    ),
  )

  createEffect(
    on(
      () => live.revision,
      () => scheduleLibraryReload(),
      { defer: true },
    ),
  )

  createEffect(
    on(
      () => props.active,
      (active) => {
        if (active) scheduleLibraryReload()
      },
      { defer: true },
    ),
  )

  createEffect(() => {
    if (props.pane !== "instructions") return
    const path = live.focusPath
    if (!path) return
    const match = (docs.latest ?? []).find(
      (item) => item.kind === "instruction" && matchesInstructionPath(item, path),
    )
    if (!match) return
    void persist()
    setStore("selected", match.id)
    clearAvaInstructionFocus()
  })

  createEffect(() => {
    const client = sdk()
    const stop = client.event.listen((event) => {
      const details = event.details as { type: string; properties?: unknown }
      if (details.type !== "file.watcher.updated" && details.type !== "filesystem.changed") return
      const propsEvent =
        typeof details.properties === "object" && details.properties
          ? (details.properties as Record<string, unknown>)
          : undefined
      const file = typeof propsEvent?.file === "string" ? propsEvent.file : undefined
      if (!file || file.startsWith(".git/")) return
      if (!isAgentsLibraryFile(file, project(), config())) return
      scheduleLibraryReload()
    })
    onCleanup(stop)
  })
  onCleanup(() => {
    if (reloadTimer !== undefined) window.clearTimeout(reloadTimer)
  })

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
    bumpAvaAgentsLibrary()
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
      <aside
        class="ava-manage-agents-sidebar"
        style={
          props.sidebarWidth
            ? { width: `${props.sidebarWidth()}px`, "max-width": `${props.sidebarWidth()}px` }
            : undefined
        }
      >
        <div class="ava-manage-agents-search">
          <TextInputV2
            type="search"
            value={store.query}
            onInput={(event) => setStore("query", event.currentTarget.value)}
            placeholder={
              props.pane === "agents"
                ? language.t("ava.agents.search.agents")
                : language.t("ava.agents.search.instructions")
            }
            aria-label={
              props.pane === "agents"
                ? language.t("ava.agents.search.agents")
                : language.t("ava.agents.search.instructions")
            }
            showClearButton={store.query.length > 0}
            clearLabel={language.t("ava.agents.search.clear")}
            onClearClick={() => setStore("query", "")}
            leadingIcon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M12.25 12.25L10.0625 10.0625M11.0833 6.41667C11.0833 8.994 8.994 11.0833 6.41667 11.0833C3.83934 11.0833 1.75 8.994 1.75 6.41667C1.75 3.83934 3.83934 1.75 6.41667 1.75C8.994 1.75 11.0833 3.83934 11.0833 6.41667Z"
                  stroke="currentColor"
                  stroke-linecap="square"
                />
              </svg>
            }
          />
        </div>
        <ScrollView class="ava-manage-agents-list" thumbVisibility="hover">
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
            onContextMenu={(item, event) => {
              if (!canReveal()) return
              menu.show(item.path, event)
            }}
            onStartCreate={() => setStore("draft", { scope: "global", value: "" })}
            onDraft={(value) => setStore("draft", { scope: "global", value })}
            onCommit={(value) => void createItem("global", value)}
            onCancel={() => setStore("draft", undefined)}
          />
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
            onContextMenu={(item, event) => {
              if (!canReveal()) return
              menu.show(item.path, event)
            }}
            onStartCreate={() => setStore("draft", { scope: "project", value: "" })}
            onDraft={(value) => setStore("draft", { scope: "project", value })}
            onCommit={(value) => void createItem("project", value)}
            onCancel={() => setStore("draft", undefined)}
          />
        </ScrollView>
      </aside>
      <main class="ava-manage-agents-main">
        <Show
          when={selected()}
          fallback={
            <AvaEmptyState
              kind={props.pane === "agents" ? "agent" : "instruction"}
              label={language.t(props.pane === "agents" ? "ava.agents.empty.agent" : "ava.agents.empty.instruction")}
            />
          }
        >
          <Show
            when={selected()?.kind === "agent"}
            fallback={
              <AgentEditor
                value={store.body}
                onInput={(value) => {
                  setStore("body", value)
                  scheduleSave()
                }}
                onBlur={() => void persist()}
              />
            }
          >
            <div class="ava-agent-panel">
              <div class="ava-agent-toolbar">
                <button type="button" class="ava-agent-toggle" onClick={() => void toggleDocument()}>
                  {store.documentMode
                    ? language.t("ava.agents.form.showSettings")
                    : language.t("ava.agents.form.editDocument")}
                </button>
              </div>
              <Show
                when={store.documentMode}
                fallback={
                  <AvaAgentSettingsForm
                    settings={store.settings}
                    instructions={instructionDocs.latest ?? []}
                    instructionLabel={stickyName}
                    onOpenInstruction={(path) => {
                      void persist()
                      openAvaInstruction(path)
                    }}
                    onChange={(settings) => {
                      setStore("settings", settings)
                      scheduleSave()
                    }}
                  />
                }
              >
                <AgentEditor
                  value={store.document}
                  onInput={(value) => {
                    setStore("document", value)
                    scheduleSave()
                  }}
                  onBlur={() => void persist()}
                />
              </Show>
            </div>
          </Show>
        </Show>
      </main>
      <AvaFileContextMenu
        open={menu.open()}
        x={menu.point().x}
        y={menu.point().y}
        onClose={menu.close}
        onReveal={() => {
          const path = menu.path()
          if (path) void platform.revealPath?.(path)
        }}
      />
    </div>
  )
}

function sameAgentDraft(left: AgentSettings, leftBody: string, right: AgentSettings, rightBody: string) {
  return leftBody === rightBody && JSON.stringify(left) === JSON.stringify(right)
}

function growEditor(element: HTMLTextAreaElement) {
  const scroller = element.closest(".scroll-view__viewport")
  const top = scroller instanceof HTMLElement ? scroller.scrollTop : 0
  element.style.height = "auto"
  element.style.height = `${element.scrollHeight}px`
  if (!(scroller instanceof HTMLElement)) return
  const pin = () => {
    const caret = caretBottom(element)
    const viewBottom = top + scroller.clientHeight
    scroller.scrollTop = caret > viewBottom ? caret - scroller.clientHeight : top
  }
  pin()
  requestAnimationFrame(pin)
}

function caretBottom(textarea: HTMLTextAreaElement) {
  const style = getComputedStyle(textarea)
  const mirror = document.createElement("div")
  mirror.style.boxSizing = style.boxSizing
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.font = style.font
  mirror.style.letterSpacing = style.letterSpacing
  mirror.style.padding = style.padding
  mirror.style.border = style.border
  mirror.style.whiteSpace = "pre-wrap"
  mirror.style.overflowWrap = "break-word"
  mirror.style.position = "absolute"
  mirror.style.visibility = "hidden"
  mirror.style.pointerEvents = "none"
  mirror.textContent = textarea.value.slice(0, textarea.selectionEnd)
  const marker = document.createElement("span")
  marker.textContent = textarea.value.slice(textarea.selectionEnd, textarea.selectionEnd + 1) || "."
  mirror.appendChild(marker)
  textarea.after(mirror)
  const bottom = marker.offsetTop + marker.offsetHeight
  mirror.remove()
  return bottom
}

function AgentEditor(props: { value: string; onInput: (value: string) => void; onBlur: () => void }) {
  let element: HTMLTextAreaElement | undefined
  createEffect(() => {
    props.value
    if (element) growEditor(element)
  })
  return (
    <ScrollView class="ava-manage-agents-editor-scroll" thumbVisibility="hover">
      <textarea
        class="ava-manage-agents-editor"
        value={props.value}
        spellcheck={false}
        ref={(node) => {
          element = node
          growEditor(node)
        }}
        onInput={(event) => {
          growEditor(event.currentTarget)
          props.onInput(event.currentTarget.value)
        }}
        onBlur={() => props.onBlur()}
      />
    </ScrollView>
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
  onContextMenu: (item: AgentsDocument, event: MouseEvent) => void
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
          icon={<IconV2 name="plus" />}
          onClick={props.onStartCreate}
        />
      </div>
      <For each={props.items}>
        {(item) => (
          <AgentListRow
            item={item}
            selected={props.selected}
            label={props.label(item)}
            deleteLabel={props.deleteLabel}
            onSelect={() => props.onSelect(item.id)}
            onDelete={() => props.onDelete(item)}
            onContextMenu={(event) => props.onContextMenu(item, event)}
          />
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

function AgentListRow(props: {
  item: AgentsDocument
  selected?: string
  label: string
  deleteLabel: string
  onSelect: () => void
  onDelete: () => void
  onContextMenu: (event: MouseEvent) => void
}) {
  const [nameEl, setNameEl] = createSignal<HTMLSpanElement>()
  const [truncated, setTruncated] = createSignal(false)
  return (
    <TruncatedCursorTooltip text={props.label} disabled={!truncated()}>
      {(handlers) => (
        <div
          class="ava-manage-agents-row"
          data-active={props.selected === props.item.id}
          ref={(element) => {
            if (props.selected !== props.item.id) return
            requestAnimationFrame(() => element.scrollIntoView({ block: "nearest" }))
          }}
          onClick={props.onSelect}
          onContextMenu={props.onContextMenu}
          onMouseEnter={(event) => {
            setTruncated(isTextTruncated(nameEl()))
            handlers.onMouseEnter(event)
          }}
          onMouseLeave={handlers.onMouseLeave}
          onMouseMove={handlers.onMouseMove}
        >
          <span ref={setNameEl} class="ava-manage-agents-row-label">
            {props.label}
          </span>
          <Show when={!props.item.sticky}>
            <IconButtonV2
              type="button"
              size="small"
              variant="ghost-muted"
              class="ava-manage-agents-row-delete"
              aria-label={props.deleteLabel}
              icon={<IconV2 name="trash" />}
              onClick={(event) => {
                event.stopPropagation()
                props.onDelete()
              }}
            />
          </Show>
        </div>
      )}
    </TruncatedCursorTooltip>
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
