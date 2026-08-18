import { describe, expect, test } from "bun:test"
import { branchRowInsertIndex, forkExclusiveAfter, sessionBranchOrigin, withBranchTitleTag } from "./session-branch"

describe("sessionBranchOrigin", () => {
  test("reads a branchedFrom record", () => {
    expect(
      sessionBranchOrigin({
        branchedFrom: { sessionID: "ses_1", title: "Feature request translation", afterUserMessageID: "msg_9" },
      }),
    ).toEqual({ sessionID: "ses_1", title: "Feature request translation", afterUserMessageID: "msg_9" })
  })

  test("ignores incomplete metadata", () => {
    expect(sessionBranchOrigin(undefined)).toBeUndefined()
    expect(sessionBranchOrigin({ branchedFrom: { sessionID: "ses_1" } })).toBeUndefined()
    expect(sessionBranchOrigin({ branchedFrom: { title: "Hello" } })).toBeUndefined()
  })
})

describe("withBranchTitleTag", () => {
  test("prefixes a generated title once", () => {
    expect(withBranchTitleTag("Auth refresh token")).toBe("[Branch] Auth refresh token")
    expect(withBranchTitleTag("[Branch] Auth refresh token")).toBe("[Branch] Auth refresh token")
  })
})

describe("branchRowInsertIndex", () => {
  test("inserts at the start when nothing was cloned", () => {
    expect(branchRowInsertIndex([{ userMessageID: "msg_1" }])).toBe(0)
  })

  test("inserts after the last row of the cloned user turn", () => {
    expect(
      branchRowInsertIndex(
        [{ userMessageID: "msg_1" }, { userMessageID: "msg_1" }, { userMessageID: "msg_2" }],
        "msg_1",
      ),
    ).toBe(2)
  })

  test("waits when the cloned user is not in the loaded rows", () => {
    expect(branchRowInsertIndex([{ userMessageID: "msg_2" }], "msg_1")).toBeUndefined()
  })
})

describe("forkExclusiveAfter", () => {
  const turn = [
    { id: "u1", role: "user" },
    { id: "a1", role: "assistant" },
    { id: "u2", role: "user" },
    { id: "a2", role: "assistant" },
  ]

  test("keeps the assistant reply when branching from a user message", () => {
    expect(forkExclusiveAfter(turn, "u1")).toBe("u2")
    expect(forkExclusiveAfter(turn, "u2")).toBeUndefined()
  })

  test("keeps the assistant message when branching from it", () => {
    expect(forkExclusiveAfter(turn, "a1")).toBe("u2")
    expect(forkExclusiveAfter(turn, "a2")).toBeUndefined()
  })
})
