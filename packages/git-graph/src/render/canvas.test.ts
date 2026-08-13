import { describe, expect, test } from "bun:test"
import { layoutGraph } from "../layout"
import { fixtureSnapshot } from "../../fixtures/snapshots"
import { chevronPointsAlong, hitTestEdge } from "./canvas"

describe("chevrons", () => {
  test("keeps a fixed pitch and only drops a mark that sits on a stem", () => {
    const points = chevronPointsAlong({ x: 0, y: 40 }, { x: 100, y: 40 }, [40, 60])
    expect(points.map((point) => point.x)).toEqual([18, 90])
  })

  test("places the first chevron at half a pitch from the start", () => {
    const points = chevronPointsAlong({ x: 10, y: 8 }, { x: 50, y: 8 }, [])
    expect(points).toEqual([{ x: 28, y: 8 }])
  })

  test("spaces a long empty span on a fixed pitch", () => {
    const points = chevronPointsAlong({ x: 0, y: 0 }, { x: 180, y: 0 }, [])
    expect(points.map((point) => Math.round(point.x))).toEqual([18, 54, 90, 126, 162])
  })

  test("does not pack chevrons into a tight cluster of stems", () => {
    const points = chevronPointsAlong({ x: 0, y: 0 }, { x: 200, y: 0 }, [20, 28, 36])
    expect(points.some((point) => point.x >= 12 && point.x <= 44)).toBe(false)
    const gaps = points.slice(1).map((point, index) => point.x - points[index]!.x)
    expect(gaps.every((gap) => gap === 36)).toBe(true)
  })

  test("points chevrons along a downward stem", () => {
    const points = chevronPointsAlong({ x: 10, y: 0 }, { x: 10, y: 80 }, [])
    expect(points.length).toBeGreaterThan(0)
    expect(points.every((point) => point.x === 10)).toBe(true)
    expect(points[0]!.y).toBeLessThan(points.at(-1)!.y)
  })

  test("skips a gap that is too tight for a chevron", () => {
    const points = chevronPointsAlong({ x: 0, y: 0 }, { x: 40, y: 0 }, [10, 16])
    expect(points.some((point) => point.x > 10 && point.x < 16)).toBe(false)
  })
})

describe("path hit testing", () => {
  test("ignores the short stem between stacked backups", () => {
    const layout = layoutGraph(fixtureSnapshot("linear"))
    const stem = layout.edges.find((edge) => edge.kind === "continue")
    expect(stem).toBeDefined()
    expect(stem!.selectable).toBe(false)
    const start = stem!.points[0]!
    const end = stem!.points[1]!
    expect(hitTestEdge(layout, (start.x + end.x) / 2, (start.y + end.y) / 2, 8)).toBeUndefined()
  })

  test("still hits a merge path", () => {
    const layout = layoutGraph(fixtureSnapshot("branched"))
    const merge = layout.edges.find((edge) => edge.kind === "merge")
    expect(merge).toBeDefined()
    const start = merge!.points[0]!
    const end = merge!.points[1]!
    expect(hitTestEdge(layout, (start.x + end.x) / 2, (start.y + end.y) / 2, 8)?.kind).toBe("merge")
  })

  test("hits a fork even when the backups sit next to each other", () => {
    const layout = layoutGraph(fixtureSnapshot("branched"))
    const fork = layout.edges.find((edge) => edge.kind === "fork")
    expect(fork).toBeDefined()
    expect(fork!.selectable).toBe(true)
    const start = fork!.points[0]!
    const end = fork!.points.at(-1)!
    expect(hitTestEdge(layout, (start.x + end.x) / 2, (start.y + end.y) / 2, 8)?.kind).toBe("fork")
  })
})
