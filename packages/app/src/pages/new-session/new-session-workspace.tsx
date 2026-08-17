import { Show, Suspense, createMemo, createSignal, type JSX } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { SessionReviewV2SidebarToggle } from "@opencode-ai/session-ui/v2/session-review-v2"
import { useLayout } from "@/context/layout"
import { useSettings } from "@/context/settings"
import { createSizing, shouldShowFileTree } from "@/pages/session/helpers"
import {
  clampSessionPanelWidth,
  SESSION_PANEL_WIDTH_MIN,
  sessionPanelWidthMax,
  sidePanelWidthMin,
} from "@/pages/session/session-panel-width"
import { sessionPanelLayout } from "@/pages/session/session-panel-layout"
import { useSessionLayout } from "@/pages/session/session-layout"
import { SessionSidePanel } from "@/pages/session/session-side-panel"
import { TerminalPanelV2 } from "@/pages/session/terminal-panel-v2"
import { createReviewPanelV2State } from "@/pages/session/v2/review-panel-v2-state"

export function NewSessionWorkspace(props: { children: JSX.Element }) {
  const layout = useLayout()
  const settings = useSettings()
  const { view } = useSessionLayout()
  const reviewV2State = createReviewPanelV2State()
  const size = createSizing()
  const isDesktop = createMediaQuery("(min-width: 768px)")
  const shown = settings.visibility.fileTree
  let panelRow: HTMLDivElement | undefined
  const [panelRowWidth, setPanelRowWidth] = createSignal<number>()

  createResizeObserver(
    () => panelRow,
    ({ width }) => setPanelRowWidth(width),
  )

  const desktopReviewOpen = createMemo(() => isDesktop() && view().reviewPanel.opened())
  const desktopTerminalOpen = createMemo(() => isDesktop() && view().terminal.opened())
  const desktopFileTreeOpen = createMemo(
    () =>
      isDesktop() &&
      shouldShowFileTree({
        visible: shown(),
        opened: layout.fileTree.opened(),
      }),
  )
  const desktopInlineTerminalOnlyOpen = createMemo(() => desktopTerminalOpen() && !desktopReviewOpen())
  const desktopSessionResizeOpen = createMemo(() => desktopReviewOpen() || desktopTerminalOpen())
  const desktopSidePanelOpen = createMemo(() => desktopSessionResizeOpen() || desktopFileTreeOpen())
  const sessionPanelAvailable = createMemo(() => {
    const width = panelRowWidth()
    if (width === undefined) return undefined
    return width - 8
  })
  const sidePanelMin = createMemo(() => {
    if (!desktopSessionResizeOpen()) return 0
    return sidePanelWidthMin({
      reviewOpen: desktopReviewOpen(),
      terminalOnly: desktopInlineTerminalOnlyOpen(),
      review: {
        v2: true,
        split: layout.review.diffStyle() === "split",
        sidebarOpen: reviewV2State.sidebarOpened(),
      },
    })
  })
  const sessionPanelMax = createMemo(() => {
    const available = sessionPanelAvailable()
    if (available === undefined) return 1000
    return sessionPanelWidthMax({ available, sidePanelMin: sidePanelMin() })
  })
  const sessionPanelResizedWidth = createMemo(() =>
    clampSessionPanelWidth({
      width: layout.session.width(),
      available: sessionPanelAvailable(),
      sidePanelMin: sidePanelMin(),
    }),
  )
  const sessionPanelWidth = createMemo(() => {
    if (!desktopSidePanelOpen()) return "100%"
    if (desktopSessionResizeOpen()) return `${sessionPanelResizedWidth()}px`
    return `calc(100% - ${layout.fileTree.width()}px)`
  })
  const desktopV2PanelLayout = createMemo(() =>
    sessionPanelLayout({
      review: desktopReviewOpen(),
      terminal: desktopTerminalOpen(),
      files: desktopFileTreeOpen(),
    }),
  )

  return (
    <div ref={panelRow} class="flex-1 min-h-0 flex flex-col md:flex-row gap-2 p-2">
      <div
        classList={{
          "@container relative shrink-0 flex flex-col min-h-0 h-full flex-1 md:flex-none transition-[width]": true,
          "duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
            !size.active() && !desktopInlineTerminalOnlyOpen(),
        }}
        style={{
          width: sessionPanelWidth(),
        }}
      >
        {props.children}
        <Show when={desktopSessionResizeOpen()}>
          <div onPointerDown={() => size.start()}>
            <ResizeHandle
              classList={{ "-end-1": true }}
              direction="horizontal"
              size={sessionPanelResizedWidth()}
              min={SESSION_PANEL_WIDTH_MIN}
              max={sessionPanelMax()}
              onResize={(width) => {
                size.touch()
                layout.session.resize(width)
              }}
            />
          </div>
        </Show>
      </div>

      <Show when={isDesktop() ? desktopV2PanelLayout().visible : view().terminal.opened()}>
        <div class="min-w-0 h-full flex flex-1 flex-col">
          <Show when={isDesktop() && (desktopReviewOpen() || desktopFileTreeOpen())}>
            <div class="min-h-0 flex-1">
              <Suspense>
                <SessionSidePanel
                  canReview={() => true}
                  diffs={() => []}
                  diffsReady={() => true}
                  empty={() => ""}
                  hasReview={() => false}
                  reviewHasFocusableContent={() => true}
                  reviewCount={() => 0}
                  reviewPanel={() => <div class="size-full" />}
                  reviewSidebarToggle={(disabled) => (
                    <SessionReviewV2SidebarToggle
                      opened={reviewV2State.sidebarOpened()}
                      disabled={disabled}
                      onToggle={reviewV2State.toggleSidebar}
                    />
                  )}
                  fileBrowserState={reviewV2State}
                  reviewV2State={reviewV2State}
                  focusReviewDiff={() => undefined}
                  reviewSnap={false}
                  size={size}
                  stacked={desktopV2PanelLayout().stacked}
                  minWidth={() => (desktopReviewOpen() ? sidePanelMin() : undefined)}
                />
              </Suspense>
            </div>
          </Show>
          <Show when={desktopV2PanelLayout().stacked}>
            <div class="relative h-2 shrink-0" onPointerDown={() => size.start()}>
              <ResizeHandle
                class="!relative !inset-auto !h-full !w-full !transform-none"
                direction="vertical"
                size={layout.terminal.height()}
                min={100}
                max={typeof window === "undefined" ? 600 : window.innerHeight * 0.6}
                collapseThreshold={50}
                onResize={(height) => {
                  size.touch()
                  layout.terminal.resize(height)
                }}
                onCollapse={() => view().terminal.close()}
              />
            </div>
          </Show>
          <Show when={view().terminal.opened()}>
            <div
              classList={{
                "min-h-0 shrink-0": desktopV2PanelLayout().stacked,
                "min-h-0 flex-1": !desktopV2PanelLayout().stacked,
              }}
            >
              <TerminalPanelV2 stacked={desktopV2PanelLayout().stacked} />
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
