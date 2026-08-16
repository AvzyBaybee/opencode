import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { backupLabel, type GitGraphSnapshot, type GitGraphSource } from "../domain/contract"
import { layoutGraph } from "../layout"
import { createGraphInteraction } from "../interaction"
import { drawGraph, hitTestCommit, hitTestLocalLabel, screenToWorld } from "../render/canvas"
import { canvasColors } from "../compat/theme"
import "../compat/git-graph.css"
import { PathPopup } from "../details/path-popup"
import { CommitTooltip, type GitActionRequest, type GitGraphActions } from "../details/commit-tooltip"
import { en, statusMessage, type GitGraphCopy } from "../i18n/en"
import { expandMergeRange, hasDiskBackups, localBranchNames } from "../source/actions"
import { overwritePrompt, conflictPrompt } from "../source/git-error"

const cloudIcon = new URL("../render/icons/cloud.svg", import.meta.url).href
const driveIcon = new URL("../render/icons/hard-drive.svg", import.meta.url).href

export type GitGraphPanelProps = {
  readonly source: GitGraphSource
  readonly copy?: GitGraphCopy
  readonly colorScheme?: "light" | "dark"
  readonly class?: string
  readonly onSelect?: (commitID?: string) => void
  readonly onSnapshot?: (snapshot: GitGraphSnapshot) => void
  readonly actions?: GitGraphActions
  readonly onLeaveRepo?: () => void
}

export function GitGraphPanel(props: GitGraphPanelProps) {
  const copy = () => props.copy ?? en
  const interaction = createGraphInteraction()
  const [snapshot, setSnapshot] = createSignal<GitGraphSnapshot>()
  const [size, setSize] = createSignal({ width: 1, height: 1 })
  const [pathPop, setPathPop] = createSignal<{ x: number; y: number }>()
  const [mergeIDs, setMergeIDs] = createSignal<string[]>([])
  const [confirmMerge, setConfirmMerge] = createSignal(false)
  const [mergeName, setMergeName] = createSignal("")
  const [mergeBusy, setMergeBusy] = createSignal(false)
  const [mergeError, setMergeError] = createSignal("")
  const [namingBackup, setNamingBackup] = createSignal(false)
  const [pickingBackupPlace, setPickingBackupPlace] = createSignal(false)
  const [backupPlace, setBackupPlace] = createSignal<"cloud" | "disk">()
  const [savingBackup, setSavingBackup] = createSignal(false)
  const [pushingCloud, setPushingCloud] = createSignal(false)
  const [backupName, setBackupName] = createSignal("")
  const [chromeBusy, setChromeBusy] = createSignal(false)
  const [chromeError, setChromeError] = createSignal("")
  const [overwrite, setOverwrite] = createSignal<{ files: string[]; pending: GitActionRequest }>()
  const [overwriteName, setOverwriteName] = createSignal("")
  const [overwriteBusy, setOverwriteBusy] = createSignal(false)
  const [overwriteError, setOverwriteError] = createSignal("")
  const [initName, setInitName] = createSignal("main")
  const [initBusy, setInitBusy] = createSignal(false)
  const [initError, setInitError] = createSignal("")
  const [conflict, setConflict] = createSignal<{ files: string[] }>()
  const [conflictEditing, setConflictEditing] = createSignal(false)
  const [conflictBusy, setConflictBusy] = createSignal(false)
  const [conflictError, setConflictError] = createSignal("")
  const [selectedLabel, setSelectedLabel] = createSignal<string>()
  const [renaming, setRenaming] = createSignal(false)
  const [renameTo, setRenameTo] = createSignal("")
  const [renameBusy, setRenameBusy] = createSignal(false)
  const [renameError, setRenameError] = createSignal("")
  let canvas: HTMLCanvasElement | undefined
  let host: HTMLDivElement | undefined
  let dragging = false
  let moved = false
  let lastX = 0
  let lastY = 0
  let paintHandle = 0
  let bufferWidth = 0
  let bufferHeight = 0

  const layout = createMemo(() => {
    const current = snapshot()
    if (!current) return
    return layoutGraph(current)
  })

  const message = createMemo(() => {
    const current = snapshot()
    if (!current) return copy().loading
    if (current.status.kind === "ready") return ""
    if (current.status.kind === "invalid" && current.worktree && props.actions?.init) return ""
    return statusMessage(copy(), current.status.kind, "message" in current.status ? current.status.message : undefined)
  })

  const selected = createMemo(() => {
    const id = interaction.selectedID()
    const current = snapshot()
    if (!id || !current) return
    return current.commits.find((commit) => commit.id === id)
  })

  const selectedPath = createMemo(() => {
    const key = interaction.selectedEdgeKey()
    const current = layout()
    if (!key || !current) return
    const edge = current.edges.find((item) => item.key === key)
    if (!edge) return
    const child = current.commits.find((commit) => commit.id === edge.from)
    const parent = current.commits.find((commit) => commit.id === edge.to)
    if (!child || !parent) return
    return { edge, child, parent }
  })

  const pathOverlay = createMemo(() => {
    const path = selectedPath()
    const pop = pathPop()
    if (!path || !pop) return
    return { ...path, x: pop.x, y: pop.y }
  })

  const paint = () => {
    const node = canvas
    if (!node) return
    const ctx = node.getContext("2d")
    if (!ctx) return
    const scheme = props.colorScheme ?? "dark"
    const colors = canvasColors(scheme)
    const { width, height } = size()
    if (width < 2 || height < 2) return
    const dpr = window.devicePixelRatio || 1
    const nextWidth = Math.max(1, Math.floor(width * dpr))
    const nextHeight = Math.max(1, Math.floor(height * dpr))
    if (bufferWidth !== nextWidth || bufferHeight !== nextHeight) {
      node.width = nextWidth
      node.height = nextHeight
      bufferWidth = nextWidth
      bufferHeight = nextHeight
    }
    const currentLayout = layout()
    const current = snapshot()
    if (!currentLayout || !current) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = colors.background
      ctx.fillRect(0, 0, width, height)
      return
    }
    drawGraph({
      ctx,
      layout: currentLayout,
      camera: interaction.camera(),
      width,
      height,
      selectedID: interaction.selectedID(),
      hoveringID: interaction.hoveringID(),
      hoveringEdgeKey: interaction.hoveringEdgeKey(),
      selectedEdgeKey: interaction.selectedEdgeKey(),
      hoveringLabel: interaction.hoveringLabel(),
      selectedLabel: selectedLabel(),
      highlightIDs: mergeIDs(),
      headID: current.head.commitID,
      detached: current.head.detached,
      light: scheme === "light",
      colors,
      dpr,
    })
  }

  const schedulePaint = () => {
    if (paintHandle) return
    paintHandle = requestAnimationFrame(() => {
      paintHandle = 0
      paint()
    })
  }

  onMount(() => {
    if (!host) return
    const applySize = (width: number, height: number) => {
      if (width < 2 || height < 2) return
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
    }
    applySize(host.clientWidth, host.clientHeight)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      applySize(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(host)
    onCleanup(() => {
      observer.disconnect()
      if (paintHandle) cancelAnimationFrame(paintHandle)
      interaction.cancelFly()
    })
  })

  let fittedFor = ""

  createEffect(() => {
    fittedFor = ""
    const stop = props.source.subscribe((next) => {
      setSnapshot(next)
      props.onSnapshot?.(next)
    })
    onCleanup(stop)
  })

  createEffect(() => {
    const name = selectedLabel()
    const current = snapshot()
    if (!name || !current) return
    if (localBranchNames(current).includes(name)) return
    closeRename()
  })

  createEffect(() => {
    const current = snapshot()
    const currentLayout = layout()
    const { width, height } = size()
    if (!current || current.status.kind !== "ready" || !currentLayout) return
    if (width < 2 || height < 2) return
    const key = `${current.repositoryRoot}:${width}x${height}`
    if (fittedFor === key) return
    fittedFor = key
    interaction.fitTips(currentLayout, width, height)
  })

  createEffect(() => {
    snapshot()
    layout()
    size()
    interaction.camera()
    interaction.selectedID()
    interaction.hoveringID()
    interaction.hoveringEdgeKey()
    interaction.selectedEdgeKey()
    interaction.hoveringLabel()
    selectedLabel()
    mergeIDs()
    props.colorScheme
    schedulePaint()
  })

  const pickingMerge = () => mergeIDs().length > 0
  const overwriteCopy = createMemo(() => (overwrite() ? overwritePrompt(overwrite()!.files) : undefined))
  const clashCopy = createMemo(() => (conflict() ? conflictPrompt(conflict()!.files) : undefined))

  const hostActions = createMemo((): GitGraphActions | undefined => {
    const inner = props.actions
    if (!inner) return
    return {
      run: async (input) => {
        const result = await inner.run(input)
        if (!result.ok && result.overwrite) {
          setOverwrite({ files: result.overwriteFiles ?? [], pending: input })
          setOverwriteName("")
          setOverwriteError("")
          setChromeError("")
        }
        if (!result.ok && result.conflict) {
          setConflict({ files: result.overwriteFiles ?? [] })
          setConflictEditing(false)
          setConflictError("")
          setChromeError("")
        }
        return result
      },
      init: inner.init,
      resolve: inner.resolve,
    }
  })

  const showPushAll = createMemo(() => {
    const current = snapshot()
    if (!current || current.status.kind !== "ready" || !hostActions()) return false
    return hasDiskBackups(current)
  })

  const cancelOverwrite = () => {
    setOverwrite(undefined)
    setOverwriteName("")
    setOverwriteBusy(false)
    setOverwriteError("")
  }

  const backupThenRetry = async () => {
    const pending = overwrite()?.pending
    const inner = props.actions
    if (!pending || !inner || overwriteBusy()) return
    setOverwriteBusy(true)
    setOverwriteError("")
    const saved = await inner.run({ kind: "commit", name: overwriteName() })
    if (!saved.ok) {
      setOverwriteBusy(false)
      setOverwriteError(saved.message || copy().error)
      return
    }
    const again = await inner.run(pending)
    setOverwriteBusy(false)
    if (!again.ok) {
      if (again.overwrite) {
        setOverwrite({ files: again.overwriteFiles ?? [], pending })
      }
      setOverwriteError(again.message || copy().error)
      return
    }
    cancelOverwrite()
    cancelMerge()
    setNamingBackup(false)
    setBackupName("")
  }

  const discardThenRetry = async () => {
    const current = overwrite()
    const inner = props.actions
    if (!current || !inner || overwriteBusy()) return
    setOverwriteBusy(true)
    setOverwriteError("")
    const result = await inner.run({ ...current.pending, force: true, paths: current.files })
    setOverwriteBusy(false)
    if (!result.ok) {
      setOverwriteError(result.message || copy().error)
      return
    }
    cancelOverwrite()
    cancelMerge()
    setNamingBackup(false)
    setBackupName("")
  }

  const makeRepo = async () => {
    const init = hostActions()?.init
    if (!init || initBusy() || !initName().trim()) return
    setInitBusy(true)
    setInitError("")
    const result = await init(initName())
    setInitBusy(false)
    if (!result.ok) {
      setInitError(result.message || copy().error)
      return
    }
    setInitError("")
    await props.source.refresh()
  }

  const runConflict = async (how: "abort" | "keep-this" | "keep-other" | "edited") => {
    const resolve = hostActions()?.resolve
    if (!resolve || conflictBusy()) return
    setConflictBusy(true)
    setConflictError("")
    const result = await resolve(how)
    setConflictBusy(false)
    if (!result.ok) {
      if (result.conflict) setConflict({ files: result.overwriteFiles ?? [] })
      setConflictError(result.message || copy().error)
      return
    }
    setConflict(undefined)
    setConflictEditing(false)
    cancelMerge()
    await props.source.refresh()
  }

  const cancelMerge = () => {
    setMergeIDs([])
    setConfirmMerge(false)
    setMergeName("")
    setMergeBusy(false)
    setMergeError("")
  }

  const cancelNaming = () => {
    setPickingBackupPlace(false)
    setNamingBackup(false)
    setBackupPlace(undefined)
    setBackupName("")
    setChromeError("")
  }

  const chooseBackupPlace = (place: "cloud" | "disk") => {
    setBackupPlace(place)
    setPickingBackupPlace(false)
    setNamingBackup(true)
    setBackupName("")
    setChromeError("")
  }

  const closeRename = () => {
    setSelectedLabel(undefined)
    setRenaming(false)
    setRenameTo("")
    setRenameBusy(false)
    setRenameError("")
  }

  const runRename = async () => {
    const from = selectedLabel()
    if (!hostActions() || !from || renameBusy() || !renameTo().trim()) return
    setRenameBusy(true)
    setRenameError("")
    const result = await hostActions()!.run({ kind: "rename", target: from, name: renameTo() })
    setRenameBusy(false)
    if (result.ok) {
      closeRename()
      return
    }
    setRenameError(result.message || copy().error)
  }

  const startMerge = () => {
    const commit = selected()
    if (!commit) return
    setMergeIDs([commit.id])
    setConfirmMerge(false)
    setMergeError("")
    setPathPop(undefined)
    closeRename()
  }

  const requestMerge = () => {
    const current = snapshot()
    const range = mergeIDs()
    const newest = current?.commits.find((commit) => commit.id === range[range.length - 1])
    setMergeName(newest ? backupLabel(newest) : "")
    setMergeError("")
    setConfirmMerge(true)
  }

  const runMerge = async () => {
    const range = mergeIDs()
    const oldest = range[0]
    const newest = range[range.length - 1]
    if (!hostActions() || !oldest || !newest || mergeBusy()) return
    setMergeBusy(true)
    setMergeError("")
    const result = await hostActions()!.run({
      kind: "merge",
      commitID: oldest,
      endID: newest,
      name: mergeName(),
    })
    setMergeBusy(false)
    if (result.ok) {
      cancelMerge()
      return
    }
    if (result.overwrite || result.conflict) return
    setMergeError(result.message || copy().error)
  }

  const startBackup = () => {
    const name = backupName().trim()
    const toCloud = backupPlace() === "cloud"
    if (!hostActions() || chromeBusy() || !name) return
    cancelNaming()
    void runChrome("commit", { name, cloud: toCloud })
  }

  const runChrome = async (kind: "commit" | "switch", extras?: { name?: string; target?: string; cloud?: boolean }) => {
    if (!hostActions() || chromeBusy()) return
    setChromeBusy(true)
    setChromeError("")
    if (kind === "commit") setSavingBackup(true)
    const result = await hostActions()!.run({
      kind,
      name: extras?.name,
      target: extras?.target,
      cloud: extras?.cloud === true,
    })
    if (result.ok) await props.source.refresh()
    setChromeBusy(false)
    setSavingBackup(false)
    if (result.ok) return
    if (result.overwrite || result.conflict) return
    setChromeError(result.message || copy().error)
  }

  const runPushAll = async () => {
    if (!hostActions() || chromeBusy()) return
    setChromeBusy(true)
    setPushingCloud(true)
    setChromeError("")
    const result = await hostActions()!.run({ kind: "publish" })
    if (result.ok) await props.source.refresh()
    setChromeBusy(false)
    setPushingCloud(false)
    if (result.ok) return
    setChromeError(result.message || copy().error)
  }

  const goToHead = () => {
    const currentLayout = layout()
    const headID = snapshot()?.head.commitID
    if (!currentLayout || !headID) return
    interaction.flyToCommit(currentLayout, headID, size().width, size().height)
    props.onSelect?.(headID)
    closeRename()
  }

  const onPointerDown = (event: PointerEvent) => {
    dragging = true
    moved = false
    lastX = event.clientX
    lastY = event.clientY
    canvas?.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent) => {
    const currentLayout = layout()
    if (dragging) {
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      if (Math.hypot(dx, dy) > 2) moved = true
      interaction.pan(dx, dy)
      lastX = event.clientX
      lastY = event.clientY
      schedulePaint()
      return
    }
    if (!currentLayout || !host) return
    const rect = host.getBoundingClientRect()
    interaction.hoverAt(currentLayout, event.clientX - rect.left, event.clientY - rect.top)
    schedulePaint()
  }

  const onPointerUp = (event: PointerEvent) => {
    const currentLayout = layout()
    const current = snapshot()
    if (currentLayout && host && !moved) {
      const rect = host.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (pickingMerge() && current) {
        const world = screenToWorld(interaction.camera(), x, y)
        const hit = hitTestCommit(currentLayout, world.x, world.y)
        if (hit) {
          setMergeIDs(expandMergeRange(current, mergeIDs(), hit.id))
          interaction.setSelectedID(hit.id)
          props.onSelect?.(hit.id)
        }
        schedulePaint()
        dragging = false
        moved = false
        return
      }
      const world = screenToWorld(interaction.camera(), x, y)
      const label = hitTestLocalLabel(currentLayout, world.x, world.y)
      if (label) {
        setSelectedLabel(label)
        setRenaming(false)
        setRenameTo(label)
        setRenameError("")
        interaction.clearSelection()
        setPathPop(undefined)
        props.onSelect?.(undefined)
        schedulePaint()
        dragging = false
        moved = false
        return
      }
      closeRename()
      const id = interaction.selectAt(currentLayout, x, y)
      props.onSelect?.(id)
      if (interaction.selectedEdgeKey()) setPathPop({ x, y })
      if (!interaction.selectedEdgeKey()) setPathPop(undefined)
      schedulePaint()
    }
    dragging = false
    moved = false
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    if (!host) return
    const rect = host.getBoundingClientRect()
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
    interaction.zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor)
    schedulePaint()
  }

  return (
    <div class={`git-graph-root relative h-full min-h-0 w-full ${props.class ?? ""}`} data-component="git-graph-panel">
      <div
        ref={host}
        class="absolute inset-0 overflow-hidden"
        style={{
          background: "#141414",
          cursor:
            interaction.hoveringID() || interaction.hoveringEdgeKey() || interaction.hoveringLabel()
              ? "pointer"
              : "default",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          interaction.clearHover()
          schedulePaint()
        }}
        onPointerCancel={() => {
          dragging = false
          moved = false
        }}
        onWheel={onWheel}
      >
        <canvas ref={canvas} class="block size-full touch-none" />
        <Show when={!pickingMerge() && pathOverlay()}>
          {(path) => (
            <PathPopup
              edge={path().edge}
              child={path().child}
              parent={path().parent}
              copy={copy()}
              x={path().x}
              y={path().y}
              width={size().width}
              height={size().height}
              hoveringID={interaction.hoveringID()}
              onHover={(id) => {
                interaction.setHoveringID(id)
                schedulePaint()
              }}
              onJump={(id) => {
                const currentLayout = layout()
                if (!currentLayout) return
                interaction.flyToCommit(currentLayout, id, size().width, size().height)
                props.onSelect?.(id)
              }}
            />
          )}
        </Show>
      </div>

      <Show when={snapshot()?.status.kind === "ready" || snapshot()?.status.kind === "unborn"}>
        <div
          class="git-graph-float-bar"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div class="git-graph-float-group">
            <button
              class="git-graph-button"
              type="button"
              disabled={chromeBusy() || !hostActions()}
              onClick={() => {
                setPickingBackupPlace(true)
                setNamingBackup(false)
                setBackupPlace(undefined)
                setBackupName("")
                setChromeError("")
              }}
            >
              {copy().createBackup}
            </button>
          </div>
          <div class="git-graph-float-group">
            <select
              class="git-graph-button"
              disabled={chromeBusy() || !hostActions() || localBranchNames(snapshot()!).length === 0}
              value={snapshot()!.head.detached ? "" : snapshot()!.head.branch || ""}
              onChange={(event) => void runChrome("switch", { target: event.currentTarget.value })}
            >
              <Show when={snapshot()!.head.detached}>
                <option value="" disabled>
                  {copy().noBranch}
                </option>
              </Show>
              <For each={localBranchNames(snapshot()!)}>
                {(name) => <option value={name}>{name}</option>}
              </For>
            </select>
            <Show when={!namingBackup() && !pickingBackupPlace() && !hasDiskBackups(snapshot()!) && chromeError()}>
              {(text) => (
                <div style={{ color: "var(--git-graph-text-weak)", "font-size": "11px" }}>{text()}</div>
              )}
            </Show>
          </div>
          <button class="git-graph-button" type="button" disabled={!snapshot()?.head.commitID} onClick={goToHead}>
            {copy().goToHead}
          </button>
        </div>
      </Show>

      <Show when={pickingBackupPlace()}>
        <div
          class="git-graph-merge-overlay"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div
            class="git-graph-merge-dialog git-graph-place-dialog"
            style={{ "text-align": "center" }}
            tabIndex={0}
            autofocus
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelNaming()
            }}
          >
            <div class="text-[13px] font-medium">{copy().createBackup}</div>
            <div class="git-graph-place-row">
              <button class="git-graph-button git-graph-place-button" type="button" onClick={() => chooseBackupPlace("cloud")}>
                <img src={cloudIcon} alt="" />
                {copy().backupCloud}
              </button>
              <button class="git-graph-button git-graph-place-button" type="button" onClick={() => chooseBackupPlace("disk")}>
                <img src={driveIcon} alt="" />
                {copy().backupDisk}
              </button>
            </div>
            <div class="git-graph-tooltip-actions mt-3">
              <button class="git-graph-button" type="button" onClick={cancelNaming}>
                {copy().cancel}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={namingBackup()}>
        <div
          class="git-graph-merge-overlay"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div class="git-graph-merge-dialog" style={{ "text-align": "center" }}>
            <div class="text-[13px] font-medium">{copy().createBackup}</div>
            <input
              class="git-graph-button git-graph-name-input mt-3 w-full"
              value={backupName()}
              placeholder={copy().backupName}
              disabled={chromeBusy()}
              autofocus
              onInput={(event) => setBackupName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  cancelNaming()
                  return
                }
                if (event.key !== "Enter" || !backupName().trim()) return
                startBackup()
              }}
            />
            <Show when={chromeError()}>
              {(text) => (
                <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)" }}>
                  {text()}
                </div>
              )}
            </Show>
            <div class="git-graph-tooltip-actions mt-3">
              <button
                class="git-graph-button"
                type="button"
                disabled={chromeBusy() || !backupName().trim()}
                onClick={startBackup}
              >
                {copy().createBackup}
              </button>
              <button class="git-graph-button" type="button" disabled={chromeBusy()} onClick={cancelNaming}>
                {copy().cancel}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={savingBackup()}>
        <div class="git-graph-saving">{copy().savingBackup}</div>
      </Show>

      <Show when={pushingCloud()}>
        <div class="git-graph-saving">{copy().pushingCloud}</div>
      </Show>

      <Show when={showPushAll()}>
        <div
          class="git-graph-push-cloud"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <button class="git-graph-button" type="button" disabled={chromeBusy()} onClick={() => void runPushAll()}>
            {copy().pushAllToCloud}
          </button>
          <Show when={!namingBackup() && !pickingBackupPlace() && chromeError()}>
            {(text) => <div class="git-graph-push-error">{text()}</div>}
          </Show>
        </div>
      </Show>

      <Show when={message()}>
        {(text) => (
          <div class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-6">
            <div class="text-center text-[14px]" style={{ color: "#e8e8e8" }}>
              {text()}
            </div>
          </div>
        )}
      </Show>

      <Show when={!selectedLabel() && ((!selectedPath() || pickingMerge()) ? selected() : undefined)}>
        {(commit) => (
          <CommitTooltip
            commit={commit()}
            snapshot={snapshot()!}
            copy={copy()}
            actions={hostActions()}
            pickingMerge={pickingMerge()}
            mergeCount={mergeIDs().length}
            onStartMerge={startMerge}
            onCancelMerge={cancelMerge}
            onRequestMerge={requestMerge}
          />
        )}
      </Show>

      <Show when={selectedLabel()}>
        {(name) => (
          <div
            class="git-graph-tooltip absolute bottom-3 left-3 z-20"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <div class="git-graph-tooltip-name">{name()}</div>
            <hr class="git-graph-tooltip-rule" />
            <Show
              when={renaming()}
              fallback={
                <div class="git-graph-tooltip-actions mt-2">
                  <button class="git-graph-button" type="button" disabled={!hostActions()} onClick={() => setRenaming(true)}>
                    {copy().renameBranch}
                  </button>
                </div>
              }
            >
              <input
                class="git-graph-button git-graph-name-input mt-2 w-full"
                value={renameTo()}
                placeholder={copy().threadName}
                disabled={renameBusy()}
                autofocus
                onInput={(event) => setRenameTo(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setRenaming(false)
                    setRenameTo(name())
                    setRenameError("")
                    return
                  }
                  if (event.key !== "Enter" || !renameTo().trim()) return
                  void runRename()
                }}
              />
              <Show when={renameError()}>
                {(text) => (
                  <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)" }}>
                    {text()}
                  </div>
                )}
              </Show>
              <div class="git-graph-tooltip-actions mt-2">
                <button
                  class="git-graph-button"
                  type="button"
                  disabled={renameBusy() || !renameTo().trim()}
                  onClick={() => void runRename()}
                >
                  {copy().renameBranch}
                </button>
                <button
                  class="git-graph-button"
                  type="button"
                  disabled={renameBusy()}
                  onClick={() => {
                    setRenaming(false)
                    setRenameTo(name())
                    setRenameError("")
                  }}
                >
                  {copy().cancel}
                </button>
              </div>
            </Show>
          </div>
        )}
      </Show>

      <Show when={confirmMerge()}>
        <div
          class="git-graph-merge-overlay"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div class="git-graph-merge-dialog">
            <div class="text-[13px] font-medium">{copy().confirmMergeTitle}</div>
            <div class="mt-1.5">{copy().confirmMerge}</div>
            <input
              class="git-graph-button mt-3 w-full text-left"
              value={mergeName()}
              placeholder={copy().mergeName}
              disabled={mergeBusy()}
              onInput={(event) => setMergeName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                void runMerge()
              }}
            />
            <Show when={mergeError()}>
              {(text) => (
                <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)" }}>
                  {text()}
                </div>
              )}
            </Show>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <button class="git-graph-button" type="button" disabled={mergeBusy()} onClick={() => void runMerge()}>
                {copy().mergeBackups}
              </button>
              <button class="git-graph-button" type="button" disabled={mergeBusy()} onClick={cancelMerge}>
                {copy().cancel}
              </button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={overwriteCopy()}>
        {(prompt) => (
          <div
            class="git-graph-merge-overlay"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <div class="git-graph-merge-dialog">
              <div>{prompt().body}</div>
              <div class="mt-1.5">{prompt().question}</div>
              <input
                class="git-graph-button mt-3 w-full text-left"
                value={overwriteName()}
                placeholder={copy().backupName}
                disabled={overwriteBusy()}
                autofocus
                onInput={(event) => setOverwriteName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    cancelOverwrite()
                    return
                  }
                  if (event.key !== "Enter") return
                  void backupThenRetry()
                }}
              />
              <Show when={overwriteError()}>
                {(text) => (
                  <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)" }}>
                    {text()}
                  </div>
                )}
              </Show>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <button
                  class="git-graph-button"
                  type="button"
                  disabled={overwriteBusy()}
                  onClick={() => void backupThenRetry()}
                >
                  {prompt().backup}
                </button>
                <button
                  class="git-graph-button"
                  type="button"
                  data-kind="danger"
                  disabled={overwriteBusy()}
                  onClick={() => void discardThenRetry()}
                >
                  {prompt().overwrite}
                </button>
                <button class="git-graph-button" type="button" disabled={overwriteBusy()} onClick={cancelOverwrite}>
                  {copy().cancel}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>

      <Show when={snapshot()?.status.kind === "invalid" && snapshot()?.worktree && hostActions()?.init}>
        <div
          class="git-graph-merge-overlay"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <div class="git-graph-merge-dialog">
            <div>{copy().noGit}</div>
            <input
              class="git-graph-button mt-3 w-full text-left"
              value={initName()}
              placeholder={copy().firstThreadName}
              disabled={initBusy()}
              autofocus
              onInput={(event) => setInitName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  props.onLeaveRepo?.()
                  return
                }
                if (event.key !== "Enter" || !initName().trim()) return
                void makeRepo()
              }}
            />
            <Show when={initError()}>
              {(text) => (
                <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)" }}>
                  {text()}
                </div>
              )}
            </Show>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <button
                class="git-graph-button"
                type="button"
                disabled={initBusy() || !initName().trim()}
                onClick={() => void makeRepo()}
              >
                {copy().makeGit}
              </button>
              <button class="git-graph-button" type="button" disabled={initBusy()} onClick={() => props.onLeaveRepo?.()}>
                {copy().cancel}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={clashCopy()}>
        {(prompt) => (
          <div
            class="git-graph-merge-overlay"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <div class="git-graph-merge-dialog">
              <div>{prompt().body}</div>
              <Show when={!conflictEditing()}>
                <div class="mt-1.5">{prompt().question}</div>
              </Show>
              <Show when={conflictEditing()}>
                <div class="mt-1.5">{copy().conflictEditHint}</div>
              </Show>
              <Show when={conflictError()}>
                {(text) => (
                  <div class="mt-1.5" style={{ color: "var(--git-graph-text-weak)" }}>
                    {text()}
                  </div>
                )}
              </Show>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <Show
                  when={conflictEditing()}
                  fallback={
                    <>
                      <button class="git-graph-button" type="button" disabled={conflictBusy()} onClick={() => void runConflict("keep-this")}>
                        {prompt().keepThis}
                      </button>
                      <button class="git-graph-button" type="button" disabled={conflictBusy()} onClick={() => void runConflict("keep-other")}>
                        {prompt().keepOther}
                      </button>
                      <button
                        class="git-graph-button"
                        type="button"
                        disabled={conflictBusy()}
                        onClick={() => {
                          setConflictEditing(true)
                          setConflictError("")
                        }}
                      >
                        {prompt().edit}
                      </button>
                      <button class="git-graph-button" type="button" disabled={conflictBusy()} onClick={() => void runConflict("abort")}>
                        {prompt().cancel}
                      </button>
                    </>
                  }
                >
                  <button class="git-graph-button" type="button" disabled={conflictBusy()} onClick={() => void runConflict("edited")}>
                    {prompt().done}
                  </button>
                  <button class="git-graph-button" type="button" disabled={conflictBusy()} onClick={() => void runConflict("abort")}>
                    {prompt().cancel}
                  </button>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
