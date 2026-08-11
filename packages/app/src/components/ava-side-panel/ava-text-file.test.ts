import { describe, expect, test } from "bun:test"
import { isMarkdownFilePath, isTextFilePath } from "./ava-text-file"

describe("ava text file helpers", () => {
  test("treats markdown extensions as markdown files", () => {
    expect(isMarkdownFilePath("README.md")).toBe(true)
    expect(isMarkdownFilePath("docs/guide.markdown")).toBe(true)
    expect(isMarkdownFilePath("C:\\notes\\page.MDX")).toBe(true)
    expect(isMarkdownFilePath("src/app.ts")).toBe(false)
    expect(isMarkdownFilePath("Makefile")).toBe(false)
  })

  test("still treats unknown extensions as text", () => {
    expect(isTextFilePath("README.md")).toBe(true)
    expect(isTextFilePath("photo.png")).toBe(false)
    expect(isTextFilePath("Makefile")).toBe(true)
  })
})
