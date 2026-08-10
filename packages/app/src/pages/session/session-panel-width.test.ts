import { describe, expect, test } from "bun:test"
import {
  clampSessionPanelWidth,
  effectiveReviewSidebarWidth,
  maxReviewSidebarWidthForPanel,
  reviewPaneWidthMin,
  REVIEW_PANE_PREVIEW_MIN,
  REVIEW_PANE_PREVIEW_MIN_SPLIT,
  REVIEW_PANE_SIDEBAR_MIN,
  REVIEW_PANE_WIDTH_MIN_LEGACY,
  SESSION_PANEL_WIDTH_MIN,
  sessionPanelWidthMax,
  sidePanelWidthMin,
  TERMINAL_PANE_WIDTH_MIN,
} from "./session-panel-width"

describe("reviewPaneWidthMin", () => {
  test("uses a smaller minimum when the file tree sidebar is closed", () => {
    expect(reviewPaneWidthMin({ v2: true, split: false, sidebarOpen: false })).toBe(REVIEW_PANE_PREVIEW_MIN)
    expect(REVIEW_PANE_PREVIEW_MIN).toBeLessThan(480)
  })

  test("reserves sidebar minimum width, not the persisted sidebar width", () => {
    expect(reviewPaneWidthMin({ v2: true, split: false, sidebarOpen: true })).toBe(
      REVIEW_PANE_SIDEBAR_MIN + REVIEW_PANE_PREVIEW_MIN,
    )
  })

  test("requires more preview width for split diffs", () => {
    expect(reviewPaneWidthMin({ v2: true, split: true, sidebarOpen: false })).toBe(REVIEW_PANE_PREVIEW_MIN_SPLIT)
    expect(REVIEW_PANE_PREVIEW_MIN_SPLIT).toBeGreaterThan(REVIEW_PANE_PREVIEW_MIN)
    expect(REVIEW_PANE_PREVIEW_MIN_SPLIT).toBeLessThan(480)
  })

  test("uses the legacy minimum for v1 review", () => {
    expect(reviewPaneWidthMin({ v2: false, split: true, sidebarOpen: true })).toBe(REVIEW_PANE_WIDTH_MIN_LEGACY)
  })
})

describe("effectiveReviewSidebarWidth", () => {
  test("shrinks the rendered sidebar when the panel is narrower than the stored width", () => {
    expect(
      effectiveReviewSidebarWidth({
        panelWidth: 420,
        sidebarOpen: true,
        sidebarWidth: 240,
      }),
    ).toBe(220)
  })

  test("keeps the stored width when the panel is wide enough", () => {
    expect(
      effectiveReviewSidebarWidth({
        panelWidth: 700,
        sidebarOpen: true,
        sidebarWidth: 240,
      }),
    ).toBe(240)
  })
})

describe("maxReviewSidebarWidthForPanel", () => {
  test("limits sidebar drag range to what the panel can fit", () => {
    expect(maxReviewSidebarWidthForPanel(420)).toBe(220)
  })
})

describe("sidePanelWidthMin", () => {
  test("prefers the review pane minimum when review is open", () => {
    expect(
      sidePanelWidthMin({
        reviewOpen: true,
        terminalOnly: false,
        review: { v2: true, split: false, sidebarOpen: false },
      }),
    ).toBe(REVIEW_PANE_PREVIEW_MIN)
  })

  test("uses the terminal minimum when only the terminal is open", () => {
    expect(
      sidePanelWidthMin({
        reviewOpen: false,
        terminalOnly: true,
        review: { v2: true, split: false, sidebarOpen: false },
      }),
    ).toBe(TERMINAL_PANE_WIDTH_MIN)
  })
})

describe("sessionPanelWidthMax", () => {
  test("reserves only the side panel minimum instead of a fixed large review width", () => {
    const sidePanelMin = reviewPaneWidthMin({ v2: true, split: false, sidebarOpen: true })
    expect(sessionPanelWidthMax({ available: 1700, sidePanelMin })).toBe(1700 - sidePanelMin)
    expect(sidePanelMin).toBeLessThan(480)
  })

  test("never drops below the chat panel minimum on small windows", () => {
    expect(sessionPanelWidthMax({ available: 600, sidePanelMin: 500 })).toBe(SESSION_PANEL_WIDTH_MIN)
    expect(sessionPanelWidthMax({ available: 0, sidePanelMin: 0 })).toBe(SESSION_PANEL_WIDTH_MIN)
  })
})

describe("clampSessionPanelWidth", () => {
  test("keeps widths already within the limit", () => {
    expect(clampSessionPanelWidth({ width: 800, available: 1700, sidePanelMin: 300 })).toBe(800)
  })

  test("forces the width down when the window shrinks", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: 1200, sidePanelMin: 300 })).toBe(900)
  })

  test("holds the chat panel minimum when there is no room for both", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: 700, sidePanelMin: 400 })).toBe(SESSION_PANEL_WIDTH_MIN)
  })

  test("skips clamping before the layout is measured", () => {
    expect(clampSessionPanelWidth({ width: 1600, available: undefined, sidePanelMin: 300 })).toBe(1600)
  })
})
