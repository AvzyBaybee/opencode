import { describe, expect, test } from "bun:test"
import {
  assignBranchHues,
  circularHueDistance,
  hueOf,
  loadBranchHues,
  minHueDistance,
  rememberPickedColor,
  rememberRename,
  saveBranchHues,
} from "./branch-color"

describe("branch hues", () => {
  test("places a new branch in the largest gap from remembered colours", () => {
    const hues = assignBranchHues(["main", "feature"], { main: 10 }, () => 0.5)
    expect(circularHueDistance(hueOf(hues.main!), hueOf(hues.feature!))).toBeGreaterThan(160)
  })

  test("keeps a remembered hue when the branch returns", () => {
    const first = assignBranchHues(["main"], {}, () => 0.2)
    const second = assignBranchHues(["main", "other"], first, () => 0.9)
    expect(second.main).toBe(first.main)
  })

  test("spreads several new branches apart", () => {
    const names = ["main", "a", "b", "c", "d"]
    const hues = assignBranchHues(names, {}, () => 0.31)
    expect(minHueDistance(names.map((name) => hueOf(hues[name]!)))).toBeGreaterThan(70)
  })

  test("places a new branch away from a picked hex colour", () => {
    const colors = assignBranchHues(["main", "feature"], { main: "#ff0000" }, () => 0.5)
    expect(circularHueDistance(hueOf(colors.main!), hueOf(colors.feature!))).toBeGreaterThan(160)
  })

  test("keeps a picked hex when later branches are assigned", () => {
    const first = rememberPickedColor({ main: 40 }, "main", "#33aaee")
    const second = assignBranchHues(["main", "other"], first, () => 0.9)
    expect(second.main).toBe("#33aaee")
  })

  test("moves a hue onto the new name when a branch is renamed", () => {
    const next = rememberRename({ feature: 40, main: 200 }, "feature", "topic")
    expect(next.topic).toBe(40)
    expect(next.feature).toBeUndefined()
    expect(next.main).toBe(200)
  })

  test("remembers hues for a worktree across load and save", () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    }
    saveBranchHues("/repo", { main: 12.5 }, storage)
    expect(loadBranchHues("/repo", storage)).toEqual({ main: 12.5 })
  })
})
