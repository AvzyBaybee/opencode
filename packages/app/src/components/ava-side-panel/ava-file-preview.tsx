import { createEffect, createMemo, createResource, on, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import { useFileComponent } from "@opencode-ai/ui/context/file"
import { AvaEmptyState } from "@/components/ava-empty-state"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Markdown } from "@opencode-ai/session-ui/markdown"
import { SessionFilePanelV2Empty } from "@opencode-ai/session-ui/v2/session-file-panel-v2"
import { sampledChecksum } from "@opencode-ai/core/util/encode"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { isMarkdownFilePath } from "./ava-text-file"

function AvaFilePreviewEmpty() {
  const language = useLanguage()
  return (
    <SessionFilePanelV2Empty>
      <AvaEmptyState kind="file" label={language.t("ava.sidePanel.selectFile")} />
    </SessionFilePanelV2Empty>
  )
}

function AvaFilePreviewBody(props: { path: string; contents: string; loaded: boolean }) {
  const language = useLanguage()
  const fileComponent = useFileComponent()
  const [store, setStore] = createStore({ preview: true })
  const markdown = createMemo(() => isMarkdownFilePath(props.path))
  const cacheKey = createMemo(() => sampledChecksum(props.contents))
  const previewLabel = () => (store.preview ? language.t("ui.message.markdown") : language.t("ui.message.raw"))

  createEffect(
    on(
      () => props.path,
      () => setStore("preview", true),
      { defer: true },
    ),
  )

  return (
    <Show
      when={props.loaded}
      fallback={
        <div class="px-4 py-3 text-12-regular text-text-weak">
          {language.t("common.loading")}
          {language.t("common.loading.ellipsis")}
        </div>
      }
    >
      <div class="ava-file-preview-host h-full min-h-0">
        <Show when={markdown()}>
          <div data-slot="markdown-preview-button" class="ava-file-preview-toggle">
            <button
              type="button"
              class="markdown-preview-toggle"
              aria-label={previewLabel()}
              onClick={() => setStore("preview", (value) => !value)}
            >
              {previewLabel()}
            </button>
          </div>
        </Show>
        <ScrollView class="ava-file-preview-scroll" thumbVisibility="hover">
          <Show
            when={markdown() && store.preview}
            fallback={
              <Dynamic
                component={fileComponent}
                mode="text"
                file={{
                  name: props.path,
                  contents: props.contents,
                  cacheKey: cacheKey(),
                }}
                class="select-text"
              />
            }
          >
            <Markdown text={props.contents} cacheKey={cacheKey()} class="ava-file-preview-markdown select-text" />
          </Show>
        </ScrollView>
      </div>
    </Show>
  )
}

export function AvaProjectFilePreview(props: { path?: string }) {
  const file = useFile()

  createEffect(() => {
    const path = props.path
    if (!path) return
    void file.load(path)
  })

  const state = createMemo(() => {
    const path = props.path
    if (!path) return
    return file.get(path)
  })

  return (
    <Show when={props.path} fallback={<AvaFilePreviewEmpty />}>
      {(path) => (
        <AvaFilePreviewBody path={path()} contents={state()?.content?.content ?? ""} loaded={!!state()?.loaded} />
      )}
    </Show>
  )
}

export function AvaBrowseFilePreview(props: { path?: string }) {
  const platform = usePlatform()

  const [content] = createResource(
    () => props.path,
    async (path) => {
      if (!path || !platform.browseReadTextFile) return
      return platform.browseReadTextFile(path)
    },
  )

  return (
    <Show when={props.path} fallback={<AvaFilePreviewEmpty />}>
      {(path) => (
        <AvaFilePreviewBody path={path()} contents={content() ?? ""} loaded={!content.loading} />
      )}
    </Show>
  )
}
