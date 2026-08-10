export const SESSION_PANEL_WIDTH_MIN = 450

// Fits the review tabs bar with horizontal scroll when narrower.
export const REVIEW_PANE_TABS_MIN = 180

// Fits the diff toolbar; controls scroll horizontally below this width.
export const REVIEW_PANE_PREVIEW_MIN = 200

// Split diffs need a little more preview width; the diff viewer scrolls beyond this.
export const REVIEW_PANE_PREVIEW_MIN_SPLIT = 280

// Legacy v1 review pane minimum.
export const REVIEW_PANE_WIDTH_MIN_LEGACY = 280

// Internal file-tree sidebar lower bound (matches session-ui).
export const REVIEW_PANE_SIDEBAR_MIN = 200

// Terminal pane beside the chat panel (tab bar and controls).
export const TERMINAL_PANE_WIDTH_MIN = 240

export type ReviewPaneWidthMinInput = {
  v2: boolean
  split: boolean
  sidebarOpen: boolean
}

export function reviewPaneWidthMin(input: ReviewPaneWidthMinInput) {
  if (!input.v2) return REVIEW_PANE_WIDTH_MIN_LEGACY

  const preview = input.split ? REVIEW_PANE_PREVIEW_MIN_SPLIT : REVIEW_PANE_PREVIEW_MIN
  const body = input.sidebarOpen ? REVIEW_PANE_SIDEBAR_MIN + preview : preview
  return Math.max(REVIEW_PANE_TABS_MIN, body)
}

export function effectiveReviewSidebarWidth(input: {
  panelWidth: number | undefined
  sidebarOpen: boolean
  sidebarWidth: number
}) {
  if (!input.sidebarOpen || input.panelWidth === undefined) return input.sidebarWidth
  const max = input.panelWidth - REVIEW_PANE_PREVIEW_MIN
  return Math.min(input.sidebarWidth, Math.max(REVIEW_PANE_SIDEBAR_MIN, max))
}

export function maxReviewSidebarWidthForPanel(panelWidth: number | undefined) {
  if (panelWidth === undefined) return undefined
  return Math.max(REVIEW_PANE_SIDEBAR_MIN, panelWidth - REVIEW_PANE_PREVIEW_MIN)
}

export function sidePanelWidthMin(input: {
  reviewOpen: boolean
  terminalOnly: boolean
  review: ReviewPaneWidthMinInput
}) {
  if (input.reviewOpen) return reviewPaneWidthMin(input.review)
  if (input.terminalOnly) return TERMINAL_PANE_WIDTH_MIN
  return 0
}

export function sessionPanelWidthMax(input: { available: number; sidePanelMin: number }) {
  return Math.max(SESSION_PANEL_WIDTH_MIN, input.available - input.sidePanelMin)
}

// `available` is undefined until the layout row is first measured; render the
// stored width untouched until then to avoid a first-frame snap.
export function clampSessionPanelWidth(input: {
  width: number
  available: number | undefined
  sidePanelMin: number
}) {
  if (input.available === undefined) return input.width
  return Math.min(input.width, sessionPanelWidthMax({ available: input.available, sidePanelMin: input.sidePanelMin }))
}
