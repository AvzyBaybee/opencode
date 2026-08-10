import { describe, expect, test } from "bun:test"
import { parsePathReference, resolvePathReference } from "./markdown-path-reference"

describe("parsePathReference", () => {
  test("strips line numbers from relative paths", () => {
    expect(parsePathReference("src/services/process.ts:712")).toEqual({ path: "src/services/process.ts" })
  })

  test("strips line and column numbers", () => {
    expect(parsePathReference("src/foo.ts:42:10")).toEqual({ path: "src/foo.ts" })
  })

  test("strips line numbers from Windows paths", () => {
    expect(parsePathReference("C:\\repo\\src\\foo.ts:42")).toEqual({ path: "C:\\repo\\src\\foo.ts" })
  })

  test("keeps paths without line numbers", () => {
    expect(parsePathReference("packages/session-ui/src/components/markdown.tsx")).toEqual({
      path: "packages/session-ui/src/components/markdown.tsx",
    })
  })
})

describe("resolvePathReference", () => {
  test("resolves project-relative paths against the working directory", () => {
    expect(resolvePathReference("src/foo.ts", "C:\\repo")).toBe("C:\\repo\\src\\foo.ts")
    expect(resolvePathReference("src/foo.ts:42", "/repo")).toBe("/repo/src/foo.ts")
  })

  test("keeps absolute paths unchanged", () => {
    expect(resolvePathReference("/etc/hosts", "/repo")).toBe("/etc/hosts")
    expect(resolvePathReference("D:\\code\\foo.ts", "C:\\repo")).toBe("D:\\code\\foo.ts")
  })
})
