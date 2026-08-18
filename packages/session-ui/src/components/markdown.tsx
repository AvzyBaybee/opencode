import { useI18n } from "@opencode-ai/ui/context/i18n"
import morphdom from "morphdom"
import { checksum } from "@opencode-ai/core/util/encode"
import {
  type Accessor,
  type ComponentProps,
  createEffect,
  createResource,
  createSignal,
  createUniqueId,
  onCleanup,
  type Setter,
  splitProps,
} from "solid-js"
import { isServer, render } from "solid-js/web"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { canReusePendingBlock, completedProjection } from "./markdown-projection"
import type { Block, Projection } from "./markdown-stream"
import {
  disposeMarkdownProjection,
  disposeStreamingCode,
  highlightStreamingCode,
  MarkdownWorkerDisposedError,
  MarkdownWorkerSupersededError,
  MarkdownWorkerUnavailableError,
  parseMarkdown,
  projectMarkdown,
} from "./markdown-worker"
import { markdownBlockKey, type MarkdownToken } from "./markdown-worker-protocol"
import { shouldResetCodeTokens, type RenderedCodeState } from "./markdown-code-state"
import { getCachedMarkdown, sanitizeMarkdown, touchCachedMarkdown, type MarkdownCacheEntry } from "./markdown-cache"
import { inlineCodeKind } from "./markdown-inline-code-kind"
import { resolvePathReference } from "./markdown-path-reference"

type RenderedBlock =
  | (MarkdownCacheEntry & { key: string; mode: Exclude<Block["mode"], "code"> })
  | {
      key: string
      mode: "code"
      raw: string
      hash: string
      language: string
      complete: boolean
      generation: number
      stable: MarkdownToken[]
      unstable: MarkdownToken[]
    }

type RenderResult = {
  text: string
  blocks: RenderedBlock[]
}

const renderedCodeTokens = new WeakMap<HTMLDivElement, RenderedCodeState>()

function escape(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function fallback(markdown: string) {
  return escape(markdown).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>")
}

async function code(text: string, language: string | undefined, key: string, complete = false) {
  try {
    const result = await highlightStreamingCode(key, text, language ?? "text", complete)
    return {
      language: result.language,
      generation: result.generation,
      stable: result.stable,
      unstable: result.unstable,
    }
  } catch (error) {
    if (
      !(error instanceof MarkdownWorkerDisposedError) &&
      !(error instanceof MarkdownWorkerSupersededError) &&
      !(error instanceof MarkdownWorkerUnavailableError)
    )
      console.error("Markdown highlighting worker failed", error)
    return { language: language ?? "text", generation: 0, stable: [], unstable: [[text, ""] as MarkdownToken] }
  }
}

type CopyLabels = {
  copy: string
  copied: string
}

type CopyButtonState = {
  setLabels: Setter<CopyLabels>
  setCopied: Setter<boolean>
  dispose: () => void
}

const copyButtonState = new WeakMap<HTMLElement, CopyButtonState>()

type PreviewLabels = {
  raw: string
  markdown: string
}

type PreviewButtonState = {
  setLabels: Setter<PreviewLabels>
  setPreview: Setter<boolean>
  dispose: () => void
}

const previewButtonState = new WeakMap<HTMLElement, PreviewButtonState>()
const floatingCopyButtons = new WeakMap<HTMLElement, HTMLElement>()
const copyPlaceholders = new WeakMap<HTMLElement, HTMLDivElement>()
const markdownActionOwner = new WeakMap<HTMLElement, HTMLDivElement>()
const copyButtonWrappers = new WeakMap<HTMLElement, HTMLElement>()

function writeClipboard(text: string) {
  const body = typeof document === "undefined" ? undefined : document.body
  if (body) {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    textarea.style.pointerEvents = "none"
    body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    body.removeChild(textarea)
    if (copied) return true
  }

  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
  if (!clipboard?.writeText) return false
  return clipboard.writeText(text).then(
    () => true,
    () => false,
  )
}

function codeCopyContent(button: HTMLElement) {
  const wrapper =
    button.closest<HTMLElement>('[data-component="markdown-code"]') ??
    copyButtonWrappers.get(button) ??
    copyPlaceholders.get(button)?.closest<HTMLElement>('[data-component="markdown-code"]')
  if (!wrapper) return ""
  return wrapper.querySelector("pre code")?.textContent ?? ""
}

const urlPattern = /^https?:\/\/[^\s<>()`"']+$/

function codeUrl(text: string) {
  const href = text.trim().replace(/[),.;!?]+$/, "")
  if (!urlPattern.test(href)) return
  try {
    const url = new URL(href)
    return url.toString()
  } catch {
    return
  }
}

function createCopyButton(labels: CopyLabels) {
  const host = document.createElement("div")
  host.setAttribute("data-slot", "markdown-copy-button")

  const state: Partial<CopyButtonState> = {}
  const dispose = render(() => {
    const [labelState, setLabels] = createSignal(labels, { equals: false })
    const [copied, setCopied] = createSignal(false)
    state.setLabels = setLabels
    state.setCopied = setCopied
    return <MarkdownCopyButton labels={labelState} copied={copied} />
  }, host)
  state.dispose = dispose
  copyButtonState.set(host, state as CopyButtonState)
  return host
}

function MarkdownCopyButton(props: { labels: Accessor<CopyLabels>; copied: Accessor<boolean> }) {
  const label = () => (props.copied() ? props.labels().copied : props.labels().copy)
  return (
    <TooltipV2 placement="top" value={label()}>
      <IconButtonV2
        type="button"
        size="normal"
        variant="ghost-muted"
        aria-label={label()}
        icon={
          <>
            <IconV2 name="outline-copy" data-copy-icon />
            <IconV2 name="check" data-check-icon />
          </>
        }
      />
    </TooltipV2>
  )
}

function createPreviewButton(labels: PreviewLabels) {
  const host = document.createElement("div")
  host.setAttribute("data-slot", "markdown-preview-button")

  const state: Partial<PreviewButtonState> = {}
  const dispose = render(() => {
    const [labelState, setLabels] = createSignal(labels, { equals: false })
    const [preview, setPreview] = createSignal(false)
    state.setLabels = setLabels
    state.setPreview = setPreview
    return <MarkdownPreviewButton labels={labelState} preview={preview} />
  }, host)
  state.dispose = dispose
  previewButtonState.set(host, state as PreviewButtonState)
  return host
}

function MarkdownPreviewButton(props: { labels: Accessor<PreviewLabels>; preview: Accessor<boolean> }) {
  const label = () => (props.preview() ? props.labels().markdown : props.labels().raw)
  return (
    <button type="button" class="markdown-preview-toggle" aria-label={label()}>
      {label()}
    </button>
  )
}

function setCopyState(host: HTMLElement, labels: CopyLabels, copied: boolean) {
  const state = copyButtonState.get(host)
  state?.setLabels(labels)
  state?.setCopied(copied)
  if (copied) {
    host.setAttribute("data-copied", "true")
    return
  }
  host.removeAttribute("data-copied")
}

function disposeCopyButton(host: HTMLElement) {
  copyButtonState.get(host)?.dispose()
  copyButtonState.delete(host)
}

function disposePreviewButton(host: HTMLElement) {
  previewButtonState.get(host)?.dispose()
  previewButtonState.delete(host)
}

function disposeCopyButtons(root: Element) {
  const hosts = [
    ...(root instanceof HTMLElement && root.getAttribute("data-slot") === "markdown-copy-button" ? [root] : []),
    ...Array.from(root.querySelectorAll('[data-slot="markdown-copy-button"]')).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    ),
  ]
  hosts.forEach(disposeCopyButton)
  Array.from(root.querySelectorAll('[data-slot="markdown-preview-button"]'))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .forEach(disposePreviewButton)
}

const shellLanguages = new Set(["bash", "sh", "shell", "zsh", "fish", "console", "terminal"])
const markdownLanguages = new Set(["md", "markdown", "mdx"])

function codeKind(language: string | undefined) {
  const value = language?.toLowerCase()
  if (!value) return "markdown"
  if (shellLanguages.has(value)) return "shell"
  if (markdownLanguages.has(value)) return "markdown"
}

function codeLanguage(block: HTMLPreElement) {
  const code = block.querySelector("code")
  if (!(code instanceof HTMLElement)) return
  return code.className.match(/(?:^|\s)language-([^\s]+)/)?.[1]
}

function applyCodeMetadata(wrapper: HTMLElement, language: string | undefined) {
  if (!document.body.hasAttribute("data-new-layout")) {
    delete wrapper.dataset.language
    delete wrapper.dataset.codeKind
    return
  }

  if (language) wrapper.dataset.language = language
  else delete wrapper.dataset.language

  const kind = codeKind(language)
  if (kind) wrapper.dataset.codeKind = kind
  else delete wrapper.dataset.codeKind
}

function ensureCodeActions(
  wrapper: HTMLElement,
  language: string | undefined,
  labels: CopyLabels,
  previewLabels: PreviewLabels,
) {
  const actions = wrapper.querySelector<HTMLElement>('[data-slot="markdown-code-actions"]')
  const floatingCopy = floatingCopyButtons.get(wrapper)
  if (!actions) {
    const next = document.createElement("div")
    next.setAttribute("data-slot", "markdown-code-actions")
    wrapper.prepend(next)
    return ensureCodeActions(wrapper, language, labels, previewLabels)
  }

  let copy = actions.querySelector<HTMLElement>('[data-slot="markdown-copy-button"]') ?? floatingCopy
  if (copy) {
    if (copy.parentElement !== actions && !floatingCopyButtons.has(wrapper)) actions.appendChild(copy)
  } else {
    copy = createCopyButton(labels)
    actions.appendChild(copy)
  }
  copyButtonWrappers.set(copy, wrapper)

  const isMarkdown = codeKind(language) === "markdown"
  const preview = actions.querySelector('[data-slot="markdown-preview-button"]')
  if (isMarkdown && !preview) {
    const next = createPreviewButton(previewLabels)
    const placeholder = copy ? copyPlaceholders.get(copy) : undefined
    if (copy?.parentElement === actions) actions.insertBefore(next, copy)
    else if (placeholder?.parentElement === actions) actions.insertBefore(next, placeholder)
    else actions.appendChild(next)
    return
  }
  if (
    isMarkdown &&
    preview instanceof HTMLElement &&
    copy?.parentElement === actions &&
    preview.nextElementSibling !== copy
  )
    actions.insertBefore(preview, copy)
  if (!isMarkdown && preview instanceof HTMLElement) {
    disposePreviewButton(preview)
    preview.remove()
  }
}

function ensureCodeWrapper(block: HTMLPreElement, labels: CopyLabels, previewLabels: PreviewLabels) {
  const parent = block.parentElement
  if (!parent) return
  const wrapped = parent.getAttribute("data-component") === "markdown-code"
  if (!wrapped) {
    const wrapper = document.createElement("div")
    wrapper.setAttribute("data-component", "markdown-code")
    const language = codeLanguage(block)
    applyCodeMetadata(wrapper, language)
    parent.replaceChild(wrapper, block)
    wrapper.appendChild(block)
    ensureCodeActions(wrapper, language, labels, previewLabels)
    return
  }

  const language = codeLanguage(block)
  applyCodeMetadata(parent, language)
  ensureCodeActions(parent, language, labels, previewLabels)
}

function markCodeLinks(root: HTMLDivElement) {
  const codeNodes = Array.from(root.querySelectorAll(":not(pre) > code"))
  for (const code of codeNodes) {
    const href = codeUrl(code.textContent ?? "")
    const parentLink =
      code.parentElement instanceof HTMLAnchorElement && code.parentElement.classList.contains("external-link")
        ? code.parentElement
        : null

    if (!href) {
      if (parentLink) parentLink.replaceWith(code)
      continue
    }

    if (parentLink) {
      parentLink.href = href
      continue
    }

    const link = document.createElement("a")
    link.href = href
    link.className = "external-link"
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    code.parentNode?.replaceChild(link, code)
    link.appendChild(code)
  }
}

function markInlineCode(root: HTMLDivElement) {
  const codeNodes = Array.from(root.querySelectorAll(":not(pre) > code"))
  for (const code of codeNodes) {
    if (!(code instanceof HTMLElement)) continue
    delete code.dataset.inlineCodeKind
    const kind = inlineCodeKind(code.textContent ?? "")
    if (kind) code.dataset.inlineCodeKind = kind
  }
}

function markPathLinks(root: HTMLDivElement, enabled: boolean) {
  const codeNodes = Array.from(root.querySelectorAll(":not(pre) > code"))
  for (const code of codeNodes) {
    if (!(code instanceof HTMLElement)) continue
    if (!enabled || code.dataset.inlineCodeKind !== "path") {
      delete code.dataset.pathLink
      code.draggable = false
      continue
    }
    code.dataset.pathLink = "true"
    code.draggable = true
  }
}

function setupPathReveal(
  root: HTMLDivElement,
  input: { directory: () => string | undefined; revealPath: (path: string) => void },
) {
  const handleClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const code = target.closest('code[data-path-link="true"]')
    if (!(code instanceof HTMLElement)) return
    event.preventDefault()
    event.stopPropagation()
    const resolved = resolvePathReference(code.textContent ?? "", input.directory())
    if (!resolved) return
    input.revealPath(resolved)
  }

  const handleDragStart = (event: DragEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const code = target.closest('code[data-path-link="true"]')
    if (!(code instanceof HTMLElement)) return
    const resolved = resolvePathReference(code.textContent ?? "", input.directory())
    if (!resolved) {
      event.preventDefault()
      return
    }
    event.dataTransfer?.setData("text/plain", `file:${resolved}`)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy"
  }

  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes("text/plain")) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = "none"
  }

  const handleDrop = (event: DragEvent) => {
    const plain = event.dataTransfer?.getData("text/plain")
    if (!plain?.startsWith("file:")) return
    event.preventDefault()
    event.stopPropagation()
  }

  root.addEventListener("click", handleClick)
  root.addEventListener("dragstart", handleDragStart)
  root.addEventListener("dragover", handleDragOver)
  root.addEventListener("drop", handleDrop)
  return () => {
    root.removeEventListener("click", handleClick)
    root.removeEventListener("dragstart", handleDragStart)
    root.removeEventListener("dragover", handleDragOver)
    root.removeEventListener("drop", handleDrop)
  }
}

function decorate(root: HTMLDivElement, labels: CopyLabels, previewLabels: PreviewLabels, pathLinks: boolean) {
  const blocks = Array.from(root.querySelectorAll("pre"))
  for (const block of blocks) {
    ensureCodeWrapper(block, labels, previewLabels)
  }
  if (!document.body.hasAttribute("data-new-layout")) return
  markInlineCode(root)
  markCodeLinks(root)
  markPathLinks(root, pathLinks)
}

function setupCodeCopy(root: HTMLDivElement, getLabels: () => CopyLabels, getPreviewLabels: () => PreviewLabels) {
  const timeouts = new Map<HTMLElement, ReturnType<typeof setTimeout>>()

  const updateLabel = (button: HTMLElement) => {
    const labels = getLabels()
    const copied = button.getAttribute("data-copied") === "true"
    setCopyState(button, labels, copied)
  }

  const updatePreviewLabel = (button: HTMLElement) => {
    previewButtonState.get(button)?.setLabels(getPreviewLabels())
  }

  const handleClick = async (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return

    const button = target.closest('[data-slot="markdown-copy-button"]')
    if (!(button instanceof HTMLElement)) return
    const content = codeCopyContent(button)
    if (!content) return
    if (!(await writeClipboard(content))) return
    const labels = getLabels()
    setCopyState(button, labels, true)
    const existing = timeouts.get(button)
    if (existing) clearTimeout(existing)
    const timeout = setTimeout(() => setCopyState(button, labels, false), 2000)
    timeouts.set(button, timeout)
  }

  const handlePreviewClick = async (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('[data-slot="markdown-preview-button"]')
    if (!(button instanceof HTMLElement)) return
    const wrapper = button.closest('[data-component="markdown-code"]')
    if (!(wrapper instanceof HTMLElement)) return
    const code = wrapper.querySelector("code")
    const pre = wrapper.querySelector("pre")
    if (!(code instanceof HTMLElement) || !(pre instanceof HTMLElement)) return

    if (wrapper.dataset.displayMode === "preview") {
      wrapper.dataset.displayMode = "raw"
      wrapper.querySelector('[data-slot="markdown-code-preview"]')?.remove()
      pre.hidden = false
      previewButtonState.get(button)?.setPreview(false)
      return
    }

    const preview = document.createElement("div")
    preview.setAttribute("data-slot", "markdown-code-preview")
    preview.setAttribute("data-component", "markdown")
    const parsed = await parseMarkdown(code.textContent ?? "").catch(() => "")
    preview.innerHTML = sanitizeMarkdown(parsed)
    wrapper.dataset.displayMode = "preview"
    pre.hidden = true
    wrapper.appendChild(preview)
    previewButtonState.get(button)?.setPreview(true)
  }

  const handleFloatingClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('[data-slot="markdown-copy-button"], [data-slot="markdown-preview-button"]')
    const actions = button?.closest<HTMLElement>('[data-slot="markdown-code-actions"]')
    if (!(button instanceof HTMLElement)) return
    const owner = markdownActionOwner.get(button) ?? (actions ? markdownActionOwner.get(actions) : undefined)
    if (owner !== root || root.contains(button)) return
    if (button.matches('[data-slot="markdown-copy-button"]')) {
      void handleClick(event)
      return
    }
    void handlePreviewClick(event)
  }

  const buttons = Array.from(root.querySelectorAll('[data-slot="markdown-copy-button"]'))
  for (const button of buttons) {
    if (button instanceof HTMLElement) updateLabel(button)
  }
  root.querySelectorAll<HTMLElement>('[data-slot="markdown-preview-button"]').forEach(updatePreviewLabel)

  root.addEventListener("click", handleClick)
  root.addEventListener("click", handlePreviewClick)
  document.addEventListener("click", handleFloatingClick)

  return () => {
    root.removeEventListener("click", handleClick)
    root.removeEventListener("click", handlePreviewClick)
    document.removeEventListener("click", handleFloatingClick)
    for (const timeout of timeouts.values()) {
      clearTimeout(timeout)
    }
    disposeCopyButtons(root)
  }
}

function setupStickyCodeActions(root: HTMLDivElement) {
  const scrollable = root.closest<HTMLElement>("[data-scrollable]")
  const tracked = new Set<HTMLElement>()
  let frame: number | undefined

  const reset = (copy: HTMLElement) => {
    const placeholder = copyPlaceholders.get(copy)
    const wrapper = placeholder?.parentElement
    if (placeholder?.parentElement) placeholder.after(copy)
    else if (copy.parentElement === document.body) copy.remove()
    if (wrapper) floatingCopyButtons.delete(wrapper)
    placeholder?.remove()
    copyPlaceholders.delete(copy)
    copy.style.position = ""
    copy.style.top = ""
    copy.style.left = ""
    copy.style.width = ""
    copy.classList.remove("markdown-copy-button-floating")
    delete copy.dataset.stuck
    markdownActionOwner.delete(copy)
  }

  const update = () => {
    frame = undefined
    const viewport = scrollable?.getBoundingClientRect()
    const viewportTop = Math.max(4, viewport?.top ?? 0)
    const header = scrollable?.querySelector<HTMLElement>("[data-session-title]")
    const headerRect = header?.getBoundingClientRect()
    const safeTop =
      headerRect && headerRect.top <= viewportTop + 1 && headerRect.bottom > viewportTop
        ? headerRect.bottom
        : viewportTop
    const viewportBottom = Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight)

    root
      .querySelectorAll<HTMLElement>('[data-slot="markdown-code-actions"] > [data-slot="markdown-copy-button"]')
      .forEach((copy) => tracked.add(copy))
    tracked.forEach((copy) => {
      const slot = copyPlaceholders.get(copy)
      const wrapper =
        copy.closest<HTMLElement>('[data-component="markdown-code"]') ??
        slot?.parentElement?.closest<HTMLElement>('[data-component="markdown-code"]')
      if (!wrapper) {
        reset(copy)
        tracked.delete(copy)
        return
      }

      markdownActionOwner.set(copy, root)
      copyButtonWrappers.set(copy, wrapper)
      const wrapperRect = wrapper.getBoundingClientRect()
      const copyRect = copy.getBoundingClientRect()
      const canPin =
        (copy.dataset.stuck ? wrapperRect.top : copyRect.top) < safeTop &&
        wrapperRect.bottom > safeTop + copyRect.height
      const visible = wrapperRect.bottom > safeTop && wrapperRect.top < viewportBottom
      if (!canPin || !visible) {
        if (copy.dataset.stuck) reset(copy)
        return
      }

      const top = Math.min(safeTop, wrapperRect.bottom - copyRect.height)
      if (copy.dataset.stuck) {
        copy.style.top = `${top}px`
        copy.style.left = `${wrapperRect.right - copyRect.width - 4}px`
        return
      }

      const placeholder = document.createElement("div")
      placeholder.setAttribute("data-slot", "markdown-copy-button-placeholder")
      placeholder.style.width = `${copyRect.width}px`
      placeholder.style.height = `${copyRect.height}px`
      copy.before(placeholder)
      copyPlaceholders.set(copy, placeholder)
      floatingCopyButtons.set(wrapper, copy)
      document.body.appendChild(copy)
      copy.classList.add("markdown-copy-button-floating")
      copy.style.position = "fixed"
      copy.style.top = `${top}px`
      copy.style.left = `${wrapperRect.right - copyRect.width - 4}px`
      copy.style.width = `${copyRect.width}px`
      copy.dataset.stuck = "true"
    })
  }

  const schedule = () => {
    if (frame !== undefined) return
    frame = requestAnimationFrame(update)
  }

  window.addEventListener("scroll", schedule, { passive: true })
  window.addEventListener("resize", schedule)
  scrollable?.addEventListener("scroll", schedule, { passive: true })
  const observer =
    typeof MutationObserver === "undefined"
      ? undefined
      : new MutationObserver((records) => {
          const changedOutsidePlaceholder = records.some((record) =>
            [...record.addedNodes, ...record.removedNodes].some(
              (node) =>
                !(node instanceof HTMLElement && node.getAttribute("data-slot") === "markdown-copy-button-placeholder"),
            ),
          )
          if (changedOutsidePlaceholder) schedule()
        })
  observer?.observe(root, { childList: true, subtree: true })
  update()

  return () => {
    window.removeEventListener("scroll", schedule)
    window.removeEventListener("resize", schedule)
    scrollable?.removeEventListener("scroll", schedule)
    observer?.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
    tracked.forEach(reset)
    tracked.clear()
  }
}

function initialResult(text: string, key: string | undefined, projection: Projection, owner: string): RenderResult {
  if (!text) return { text, blocks: [] }
  const base = key ?? checksum(text)
  if (base) {
    const blocks = projection.blocks.flatMap((block, index) => {
      if (block.mode === "code") return []
      const cacheKey = `${base}:${index}:${block.mode}`
      const cached = getCachedMarkdown(cacheKey)
      if (cached?.raw !== block.raw) return []
      return [{ key: `${owner}:${cacheKey}`, mode: block.mode, ...cached }]
    })
    if (blocks.length === projection.blocks.length) return { text, blocks }
  }
  return {
    text,
    blocks: [
      {
        key: "initial",
        mode: "full",
        raw: text,
        hash: checksum(text) ?? "",
        html: fallback(text),
      },
    ],
  }
}

function pendingProjection(text: string): Projection {
  return { text, blocks: text ? [{ raw: text, src: text, mode: "live" }] : [] }
}

export function Markdown(
  props: ComponentProps<"div"> & {
    text: string
    cacheKey?: string
    streaming?: boolean
    class?: string
    classList?: Record<string, boolean>
    directory?: string
    revealPath?: (path: string) => void
  },
) {
  const [local, others] = splitProps(props, [
    "text",
    "cacheKey",
    "streaming",
    "class",
    "classList",
    "directory",
    "revealPath",
  ])
  const i18n = useI18n()
  const [root, setRoot] = createSignal<HTMLDivElement>()
  const owner = createUniqueId()
  const activeCodeKeys = new Set<string>()
  const completedCode = new Map<string, Extract<RenderedBlock, { mode: "code" }>>()
  let streamed = false
  const [projection] = createResource(
    () => {
      if (isServer) return
      const live = local.streaming ?? false
      if (live) streamed = true
      if (!live && !streamed) return
      return { key: owner, text: local.text, live }
    },
    (src) => projectMarkdown(src.key, src.text, src.live),
    { initialValue: pendingProjection("") },
  )
  const currentProjection = () => {
    if (!(local.streaming ?? false) && !streamed) return completedProjection(local.text)
    const value = projection.latest
    if (value?.text === local.text) return value
    if (value?.text) return value
    return pendingProjection(local.text)
  }
  const [html] = createResource(
    () => {
      if (isServer)
        return {
          text: local.text,
          key: local.cacheKey,
          projection: pendingProjection(local.text),
        }
      const value = !(local.streaming ?? false) && !streamed ? completedProjection(local.text) : projection.latest
      if (!value || value.text !== local.text) return
      return {
        text: local.text,
        key: local.cacheKey,
        projection: value,
      }
    },
    async (src) => {
      if (isServer)
        return {
          text: src.text,
          blocks: [
            {
              key: "server",
              mode: "full" as const,
              raw: src.text,
              hash: checksum(src.text) ?? "",
              html: fallback(src.text),
            },
          ],
        } satisfies RenderResult
      if (!src.text) return { text: src.text, blocks: [] } satisfies RenderResult

      const base = src.key ?? checksum(src.text)
      return Promise.all(
        src.projection.blocks.map(async (block, index) => {
          const key = base ? `${base}:${index}:${block.mode}` : undefined
          const blockKey = markdownBlockKey(owner, src.key, index, block.mode)

          if (block.mode === "code") {
            const cached = completedCode.get(blockKey)
            if (block.complete && cached?.raw === block.raw) return cached
            const result = await code(block.src, block.language, blockKey, block.complete)
            const rendered = {
              key: blockKey,
              mode: block.mode,
              raw: block.raw,
              hash: String(block.raw.length),
              complete: !!block.complete,
              ...result,
            }
            if (block.complete) completedCode.set(blockKey, rendered)
            return rendered
          }

          if (key) {
            const cached = getCachedMarkdown(key)
            if (cached?.raw === block.raw) {
              touchCachedMarkdown(key, cached)
              return { key: blockKey, mode: block.mode, ...cached }
            }
          }

          const hash = checksum(block.raw)
          const safe = sanitizeMarkdown(await parseMarkdown(block.src))
          if (key && hash) touchCachedMarkdown(key, { raw: block.raw, hash, html: safe })
          return { key: blockKey, mode: block.mode, raw: block.raw, hash: hash ?? "", html: safe }
        }),
      )
        .then((blocks) => ({ text: src.text, blocks }) satisfies RenderResult)
        .catch(
          () =>
            ({
              text: src.text,
              blocks: [
                {
                  key: base ?? "fallback",
                  mode: "full" as const,
                  raw: src.text,
                  hash: checksum(src.text) ?? "",
                  html: fallback(src.text),
                },
              ],
            }) satisfies RenderResult,
        )
    },
    {
      initialValue: initialResult(
        local.text,
        local.cacheKey,
        local.streaming ? pendingProjection(local.text) : completedProjection(local.text),
        owner,
      ),
    },
  )

  let copyCleanup: (() => void) | undefined
  let stickyCleanup: (() => void) | undefined
  let pathRevealCleanup: (() => void) | undefined

  createEffect(() => {
    const container = root()
    const result = html.latest ?? html()
    const projected = currentProjection()
    const content = local.text ? pendingBlocks(result, projected, local.cacheKey, owner) : []
    if (!container) return
    if (isServer) return
    if (content.length === 0) {
      disposeCopyButtons(container)
      container.innerHTML = ""
      return
    }

    const labels = {
      copy: i18n.t("ui.message.copy"),
      copied: i18n.t("ui.message.copied"),
    }
    const previewLabels = {
      raw: i18n.t("ui.message.raw"),
      markdown: i18n.t("ui.message.markdown"),
    }
    const pathLinks = !!local.revealPath
    const nextCodeKeys = new Set(content.filter((block) => block.mode === "code").map((block) => block.key))
    activeCodeKeys.forEach((key) => {
      if (!nextCodeKeys.has(key)) disposeCode(key)
    })
    activeCodeKeys.clear()
    nextCodeKeys.forEach((key) => activeCodeKeys.add(key))
    content.forEach((block, index) => updateBlock(container, index, block, labels, previewLabels, pathLinks))
    while (container.children.length > content.length) {
      const child = container.lastElementChild
      if (!child) break
      disposeCopyButtons(child)
      child.remove()
    }
    container
      .querySelectorAll<HTMLElement>('[data-slot="markdown-copy-button"]')
      .forEach((button) => setCopyState(button, labels, button.dataset.copied === "true"))
    container
      .querySelectorAll<HTMLElement>('[data-slot="markdown-preview-button"]')
      .forEach((button) => previewButtonState.get(button)?.setLabels(previewLabels))
    if (!copyCleanup)
      copyCleanup = setupCodeCopy(
        container,
        () => ({
          copy: i18n.t("ui.message.copy"),
          copied: i18n.t("ui.message.copied"),
        }),
        () => ({
          raw: i18n.t("ui.message.raw"),
          markdown: i18n.t("ui.message.markdown"),
        }),
      )
    if (!stickyCleanup) stickyCleanup = setupStickyCodeActions(container)
    if (!pathRevealCleanup)
      pathRevealCleanup = setupPathReveal(container, {
        directory: () => local.directory,
        revealPath: (path) => local.revealPath?.(path),
      })
  })

  onCleanup(() => {
    if (pathRevealCleanup) pathRevealCleanup()
    if (stickyCleanup) stickyCleanup()
    if (copyCleanup) copyCleanup()
    disposeMarkdownProjection(owner)
    activeCodeKeys.forEach(disposeCode)
    completedCode.clear()
  })

  return (
    <div
      data-component="markdown"
      dir="auto"
      classList={{
        ...local.classList,
        [local.class ?? ""]: !!local.class,
      }}
      ref={setRoot}
      {...others}
    />
  )
}

function pendingBlocks(
  result: RenderResult | undefined,
  projection: Projection | undefined,
  cacheKey: string | undefined,
  owner: string,
) {
  if (!result) return []
  if (!projection || result.text === projection.text) return result.blocks
  const initial = result.blocks.length === 1 && result.blocks[0]?.key === "initial"
  return projection.blocks.map((block, index) => {
    const current = initial ? undefined : result.blocks[index]
    if (current && canReusePendingBlock(current, block)) return current
    const key = markdownBlockKey(owner, cacheKey, index, block.mode)
    if (block.mode !== "code")
      return { key, mode: block.mode, raw: block.raw, hash: String(block.raw.length), html: fallback(block.src) }
    return {
      key,
      mode: block.mode,
      raw: block.raw,
      hash: String(block.raw.length),
      language: block.language ?? "text",
      complete: !!block.complete,
      stable: [],
      generation: 0,
      unstable: [[block.src, ""] as MarkdownToken],
    }
  })
}

function disposeCode(key: string) {
  disposeStreamingCode(key)
}

function updateBlock(
  container: HTMLDivElement,
  index: number,
  block: RenderedBlock,
  labels: CopyLabels,
  previewLabels: PreviewLabels,
  pathLinks: boolean,
) {
  const current = container.children[index]
  if (block.mode === "code") {
    updateCodeBlock(container, current, block, labels, previewLabels)
    return
  }
  if (
    current instanceof HTMLDivElement &&
    current.dataset.markdownKey === block.key &&
    current.dataset.markdownHash === block.hash
  )
    return

  const next = document.createElement("div")
  next.dataset.markdownBlock = ""
  next.dataset.markdownKey = block.key
  next.dataset.markdownHash = block.hash
  next.style.display = "contents"
  next.innerHTML = block.html
  decorate(next, labels, previewLabels, pathLinks)

  if (!(current instanceof HTMLDivElement)) {
    container.appendChild(next)
    return
  }

  morphdom(current, next, {
    onBeforeElUpdated: (fromEl, toEl) => {
      if (
        fromEl instanceof HTMLElement &&
        toEl instanceof HTMLElement &&
        fromEl.getAttribute("data-slot") === "markdown-copy-button" &&
        toEl.getAttribute("data-slot") === "markdown-copy-button"
      ) {
        return false
      }
      if (fromEl.isEqualNode(toEl)) return false
      return true
    },
    onBeforeNodeDiscarded: (node) => {
      if (node instanceof Element) disposeCopyButtons(node)
      return true
    },
  })
}

function updateCodeBlock(
  container: HTMLDivElement,
  current: Element | undefined,
  block: Extract<RenderedBlock, { mode: "code" }>,
  labels: CopyLabels,
  previewLabels: PreviewLabels,
) {
  const existing = current instanceof HTMLDivElement && current.dataset.markdownKey === block.key ? current : undefined
  const next = existing ?? document.createElement("div")
  next.dataset.markdownBlock = ""
  next.dataset.markdownKey = block.key
  next.dataset.markdownHash = block.hash
  next.dataset.markdownComplete = block.complete ? "true" : "false"
  next.style.display = "contents"

  const code = existing?.querySelector("code")
  if (code instanceof HTMLElement) {
    const wrapper = code.closest('[data-component="markdown-code"]')
    if (wrapper instanceof HTMLElement) {
      applyCodeMetadata(wrapper, block.language)
      ensureCodeActions(wrapper, block.language, labels, previewLabels)
    }
    code.className = `language-${block.language}`
    const previous = renderedCodeTokens.get(next)
    const reset = shouldResetCodeTokens(previous, {
      language: block.language,
      generation: block.generation,
      stableCount: block.stable.length,
      raw: block.raw,
    })
    const stableCount = reset ? 0 : previous!.stableCount
    const tail = [...block.stable.slice(stableCount), ...block.unstable]
    const prior = reset ? [] : previous!.unstable
    const prefix = prior.findIndex((token, index) => !sameToken(token, tail[index]))
    const keep = stableCount + (prefix < 0 ? Math.min(prior.length, tail.length) : prefix)
    while (code.children.length > keep) code.lastElementChild?.remove()
    tail
      .slice(keep - stableCount)
      .map(createTokenSpan)
      .forEach((span) => code.appendChild(span))
    renderedCodeTokens.set(next, {
      language: block.language,
      generation: block.generation,
      stableCount: block.stable.length,
      unstable: block.unstable,
      raw: block.raw,
    })
    return
  }

  const wrapper = document.createElement("div")
  wrapper.setAttribute("data-component", "markdown-code")
  applyCodeMetadata(wrapper, block.language)
  const pre = document.createElement("pre")
  pre.className = "shiki OpenCode"
  const codeElement = document.createElement("code")
  codeElement.className = `language-${block.language}`
  ;[...block.stable, ...block.unstable].map(createTokenSpan).forEach((span) => codeElement.appendChild(span))
  pre.appendChild(codeElement)
  wrapper.appendChild(pre)
  ensureCodeActions(wrapper, block.language, labels, previewLabels)
  next.appendChild(wrapper)
  renderedCodeTokens.set(next, {
    language: block.language,
    generation: block.generation,
    stableCount: block.stable.length,
    unstable: block.unstable,
    raw: block.raw,
  })
  if (current) {
    disposeCopyButtons(current)
    current.replaceWith(next)
    return
  }
  container.appendChild(next)
}

function sameToken(left: MarkdownToken, right: MarkdownToken | undefined) {
  return !!right && left[0] === right[0] && left[1] === right[1]
}

function createTokenSpan(token: MarkdownToken) {
  const span = document.createElement("span")
  span.setAttribute("style", token[1])
  span.textContent = token[0]
  return span
}
