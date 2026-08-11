import { describe, expect, test } from "bun:test"
import { stickyOverlayTopInset, stickyVirtualPinned, stickyVirtualY } from "./sticky-virtual-row"

describe("stickyVirtualY", () => {
  test("pins to the viewport top once the row scrolls out of view", () => {
    expect(
      stickyVirtualY({
        start: 40,
        size: 28,
        scrollTop: 80,
        viewportHeight: 200,
      }),
    ).toBe(80)
  })

  test("pins below overlay chrome at the top of the scrollport", () => {
    expect(
      stickyVirtualY({
        start: 40,
        size: 28,
        scrollTop: 80,
        viewportHeight: 200,
        topInset: 32,
      }),
    ).toBe(112)
  })

  test("pins to the viewport bottom when the row sits past the fold", () => {
    expect(
      stickyVirtualY({
        start: 400,
        size: 28,
        scrollTop: 0,
        viewportHeight: 200,
      }),
    ).toBe(172)
  })
})

describe("stickyVirtualPinned", () => {
  test("reports which edge the row is clamped to", () => {
    expect(stickyVirtualPinned(40, 80)).toBe("top")
    expect(stickyVirtualPinned(400, 172)).toBe("bottom")
    expect(stickyVirtualPinned(80, 80)).toBeUndefined()
  })
})

describe("stickyOverlayTopInset", () => {
  test("is zero when the copy bar is absent", () => {
    expect(stickyOverlayTopInset({ viewportTop: 100 })).toBe(0)
  })

  test("uses overlap when the copy bar covers the viewport", () => {
    expect(
      stickyOverlayTopInset({
        viewportTop: 120,
        overlayBottom: 152,
      }),
    ).toBe(32)
  })

  test("is flush when the copy bar sits above the viewport", () => {
    expect(
      stickyOverlayTopInset({
        viewportTop: 152,
        overlayBottom: 152,
      }),
    ).toBe(0)
  })
})
