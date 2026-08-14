import { describe, expect, test } from "bun:test"
import { browseFolderTab, isAvaFilesTab, isAvaFixedTab, AVA_CONTEXT_TAB, AVA_PROJECT_FOLDER_TAB } from "./ava-side-panel-tabs"

describe("ava side panel tabs", () => {
  test("treats project and browse folders as files tabs", () => {
    expect(isAvaFilesTab(AVA_PROJECT_FOLDER_TAB)).toBe(true)
    expect(isAvaFilesTab(browseFolderTab("/tmp/other"))).toBe(true)
    expect(isAvaFilesTab(AVA_CONTEXT_TAB)).toBe(false)
  })

  test("treats context as a fixed tab", () => {
    expect(isAvaFixedTab(AVA_CONTEXT_TAB)).toBe(true)
    expect(isAvaFixedTab(browseFolderTab("/tmp/other"))).toBe(false)
  })
})
