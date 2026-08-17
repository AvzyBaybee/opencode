import { ErrorBoundary, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { GitGraphPanel } from "@opencode-ai/git-graph"
import { emptySnapshot, type GitGraphSnapshot } from "@opencode-ai/git-graph/contract"
import { createOpenCodeGitSource, type GitActionKind } from "@opencode-ai/git-graph/source"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSDK } from "@/context/sdk"
import { useServer, type ServerConnection } from "@/context/server"
import { authTokenFromCredentials } from "@/utils/server"

type ActionBody = {
  ok?: boolean
  message?: string
  overwrite?: boolean
  conflict?: boolean
  overwriteFiles?: string[]
}

export function AvaGitGraphPanel() {
  const sdk = useSDK()
  const language = useLanguage()
  const platform = usePlatform()
  const server = useServer()
  const [scheme, setScheme] = createSignal<"light" | "dark">(readScheme())
  const directory = () => sdk().directory
  const copy = createMemo(() => gitGraphCopy(language.t))
  const host = createMemo(() => createHost(directory(), sdk().url, server.current, platform.fetch ?? fetch))

  onMount(() => {
    const root = document.documentElement
    const apply = () => setScheme(readScheme())
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(root, { attributes: true, attributeFilter: ["data-color-scheme"] })
    onCleanup(() => observer.disconnect())
  })

  return (
    <ErrorBoundary
      fallback={() => (
        <div class="flex size-full items-center justify-center p-6 text-center text-14-regular text-text-weak">
          {language.t("ava.gitGraph.error")}
        </div>
      )}
    >
      <GitGraphPanel
        class="absolute inset-0"
        source={host().source}
        actions={host().actions}
        copy={copy()}
        colorScheme={scheme()}
      />
    </ErrorBoundary>
  )
}

export default AvaGitGraphPanel

function readScheme(): "light" | "dark" {
  if (typeof document !== "object") return "dark"
  return document.documentElement.dataset.colorScheme === "light" ? "light" : "dark"
}

function gitGraphCopy(t: ReturnType<typeof useLanguage>["t"]) {
  return {
    title: t("ava.gitGraph.title"),
    openRepository: t("ava.gitGraph.openRepository"),
    openHint: t("ava.gitGraph.openHint"),
    pathPlaceholder: t("ava.gitGraph.pathPlaceholder"),
    empty: t("ava.gitGraph.empty"),
    unborn: t("ava.gitGraph.unborn"),
    invalid: t("ava.gitGraph.invalid"),
    loading: t("ava.gitGraph.loading"),
    error: t("ava.gitGraph.error"),
    stale: t("ava.gitGraph.stale"),
    unsupported: t("ava.gitGraph.unsupported"),
    selectRepository: t("ava.gitGraph.selectRepository"),
    noSelection: t("ava.gitGraph.noSelection"),
    detachedHead: t("ava.gitGraph.detachedHead"),
    pathSameThread: t("ava.gitGraph.pathSameThread"),
    pathFork: t("ava.gitGraph.pathFork"),
    pathMerge: t("ava.gitGraph.pathMerge"),
    pathGrewFrom: t("ava.gitGraph.pathGrewFrom"),
    pathBranchedOff: t("ava.gitGraph.pathBranchedOff"),
    pathJoined: t("ava.gitGraph.pathJoined"),
    branchOff: t("ava.gitGraph.branchOff"),
    restoreBackup: t("ava.gitGraph.restoreBackup"),
    mergeBackups: t("ava.gitGraph.mergeBackups"),
    mergeName: t("ava.gitGraph.mergeName"),
    mergeHint: t("ava.gitGraph.mergeHint"),
    confirmMerge: t("ava.gitGraph.confirmMerge"),
    confirmMergeTitle: t("ava.gitGraph.confirmMergeTitle"),
    moveBranchTo: t("ava.gitGraph.moveBranchTo"),
    confirmMove: t("ava.gitGraph.confirmMove"),
    moveChoose: t("ava.gitGraph.moveChoose"),
    moveNeedsName: t("ava.gitGraph.moveNeedsName"),
    conflictEditHint: t("ava.gitGraph.conflictEditHint"),
    deleteBackup: t("ava.gitGraph.deleteBackup"),
    confirmDelete: t("ava.gitGraph.confirmDelete"),
    confirmDeleteLater: t("ava.gitGraph.confirmDeleteLater"),
    createThread: t("ava.gitGraph.createThread"),
    threadName: t("ava.gitGraph.threadName"),
    cancel: t("ava.gitGraph.cancel"),
    createBackup: t("ava.gitGraph.createBackup"),
    savingBackup: t("ava.gitGraph.savingBackup"),
    backupName: t("ava.gitGraph.backupName"),
    backupCloud: t("ava.gitGraph.backupCloud"),
    backupDisk: t("ava.gitGraph.backupDisk"),
    goToHead: t("ava.gitGraph.goToHead"),
    noBranch: t("ava.gitGraph.noBranch"),
    noGit: t("ava.gitGraph.noGit"),
    makeGit: t("ava.gitGraph.makeGit"),
    createRepository: t("ava.gitGraph.createRepository"),
    firstThreadName: t("ava.gitGraph.firstThreadName"),
    renameBranch: t("ava.gitGraph.renameBranch"),
    pushAllToCloud: t("ava.gitGraph.pushAllToCloud"),
    pushingCloud: t("ava.gitGraph.pushingCloud"),
    searchBackups: t("ava.gitGraph.searchBackups"),
    searchPlaceholder: t("ava.gitGraph.searchPlaceholder"),
  }
}

function createHost(directory: string, baseUrl: string, conn: ServerConnection.Any | undefined, fetchFn: typeof fetch) {
  const headers = (): HeadersInit => {
    if (!conn?.http.password) return { "Content-Type": "application/json" }
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${authTokenFromCredentials({ username: conn.http.username, password: conn.http.password })}`,
    }
  }

  const query = () => {
    const params = new URLSearchParams({ directory, scope: "local" })
    if (conn?.http.password) {
      params.set("auth_token", authTokenFromCredentials({ username: conn.http.username, password: conn.http.password }))
    }
    return params.toString()
  }

  const url = (leaf: string) => `${baseUrl.replace(/\/+$/, "")}/ava/git-graph/${leaf}?${query()}`

  const fetchSnapshot = async (): Promise<GitGraphSnapshot> => {
    const response = await fetchFn(url("graph"), { headers: headers() })
    const body = await response.json().catch(() => undefined)
    if (!isSnapshot(body)) {
      return emptySnapshot({
        worktree: directory,
        status: { kind: "error", message: `Could not read git history (HTTP ${response.status})` },
      })
    }
    return body
  }

  const post = async (leaf: string, body: unknown): Promise<ActionBody> => {
    const response = await fetchFn(url(leaf), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    })
    return (await response.json()) as ActionBody
  }

  const result = (body: ActionBody) => {
    if (body.ok) return { ok: true as const }
    return {
      ok: false as const,
      message: body.message,
      overwrite: body.overwrite,
      conflict: body.conflict,
      overwriteFiles: body.overwriteFiles,
    }
  }

  return {
    source: createOpenCodeGitSource({
      directory,
      fetchSnapshot,
      subscribe: (listener) => {
        const source = new EventSource(url("watch"))
        source.onmessage = () => {
          void fetchSnapshot().then(listener)
        }
        return () => source.close()
      },
    }),
    actions: {
      run: async (input: {
        kind: GitActionKind
        commitID?: string
        name?: string
        target?: string
        endID?: string
        force?: boolean
        cloud?: boolean
        paths?: readonly string[]
      }) => result(await post("action", input)),
      init: async (name: string) => result(await post("init", { name })),
      resolve: async (how: "abort" | "keep-this" | "keep-other" | "edited") => result(await post("conflict", { how })),
    },
  }
}

function isSnapshot(value: unknown): value is GitGraphSnapshot {
  if (!value || typeof value !== "object") return false
  if (!("commits" in value) || !Array.isArray(value.commits)) return false
  if (!("status" in value) || !value.status || typeof value.status !== "object") return false
  if (!("kind" in value.status) || typeof value.status.kind !== "string") return false
  return true
}
