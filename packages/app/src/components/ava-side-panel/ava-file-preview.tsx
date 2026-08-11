import { createEffect, createMemo, createResource, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useFileComponent } from "@opencode-ai/ui/context/file"
import { Icon } from "@opencode-ai/ui/icon"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { SessionFilePanelV2Empty } from "@opencode-ai/session-ui/v2/session-file-panel-v2"
import { sampledChecksum } from "@opencode-ai/core/util/encode"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"

export function AvaProjectFilePreview(props: { path?: string }) {
  const file = useFile()
  const language = useLanguage()
  const fileComponent = useFileComponent()

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
  const contents = createMemo(() => state()?.content?.content ?? "")
  const cacheKey = createMemo(() => sampledChecksum(contents()))

  return (
    <Show
      when={props.path}
      fallback={
        <SessionFilePanelV2Empty>
          <div class="flex flex-col items-center gap-3 text-center text-text-weak">
            <Icon name="file-tree" size="large" />
            <div class="text-14-medium text-text-strong">{language.t("ava.sidePanel.selectFile")}</div>
          </div>
        </SessionFilePanelV2Empty>
      }
    >
      {(path) => (
        <Show
          when={state()?.loaded}
          fallback={
            <div class="px-4 py-3 text-12-regular text-text-weak">
              {language.t("common.loading")}
              {language.t("common.loading.ellipsis")}
            </div>
          }
        >
          <ScrollView class="ava-file-preview-scroll" thumbVisibility="hover">
            <Dynamic
              component={fileComponent}
              mode="text"
              file={{
                name: path(),
                contents: contents(),
                cacheKey: cacheKey(),
              }}
              class="select-text"
            />
          </ScrollView>
        </Show>
      )}
    </Show>
  )
}

export function AvaBrowseFilePreview(props: { path?: string }) {
  const language = useLanguage()
  const platform = usePlatform()
  const fileComponent = useFileComponent()

  const [content] = createResource(
    () => props.path,
    async (path) => {
      if (!path || !platform.browseReadTextFile) return
      return platform.browseReadTextFile(path)
    },
  )

  return (
    <Show
      when={props.path}
      fallback={
        <SessionFilePanelV2Empty>
          <div class="flex flex-col items-center gap-3 text-center text-text-weak">
            <Icon name="file-tree" size="large" />
            <div class="text-14-medium text-text-strong">{language.t("ava.sidePanel.selectFile")}</div>
          </div>
        </SessionFilePanelV2Empty>
      }
    >
      {(path) => (
        <Show
          when={!content.loading}
          fallback={
            <div class="px-4 py-3 text-12-regular text-text-weak">
              {language.t("common.loading")}
              {language.t("common.loading.ellipsis")}
            </div>
          }
        >
          <ScrollView class="ava-file-preview-scroll" thumbVisibility="hover">
            <Dynamic
              component={fileComponent}
              mode="text"
              file={{
                name: path(),
                contents: content() ?? "",
                cacheKey: sampledChecksum(content() ?? ""),
              }}
              class="select-text"
            />
          </ScrollView>
        </Show>
      )}
    </Show>
  )
}
