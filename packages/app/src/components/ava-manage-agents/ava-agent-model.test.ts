import { describe, expect, test } from "bun:test"
import {
  applyReasoningEffort,
  findModelByValue,
  modelValue,
  reasoningEffortChoices,
  selectedReasoningEffort,
  variantKeys,
} from "./ava-agent-model"

describe("agent model helpers", () => {
  test("keeps slashes inside the model id", () => {
    expect(modelValue({ id: "anthropic/claude-sonnet-4-5", provider: { id: "openrouter" } })).toBe(
      "openrouter/anthropic/claude-sonnet-4-5",
    )
  })

  test("reads variant ids from records and arrays", () => {
    expect(variantKeys({ low: {}, high: { disabled: true }, xhigh: {} })).toEqual(["low", "xhigh"])
    expect(variantKeys([{ id: "high" }, { id: "max", disabled: true }, "none"])).toEqual(["high", "none"])
    expect(variantKeys(undefined)).toEqual([])
  })

  test("finds a model by the stored provider/model value", () => {
    const models = [
      { id: "anthropic/claude-sonnet-4-5", provider: { id: "openrouter" } },
      { id: "gpt-5", provider: { id: "openai" } },
    ]
    expect(findModelByValue(models, "openrouter/anthropic/claude-sonnet-4-5")?.id).toBe("anthropic/claude-sonnet-4-5")
    expect(findModelByValue(models, "openai/gpt-5")?.id).toBe("gpt-5")
    expect(findModelByValue(models, "")).toBeUndefined()
  })

  test("uses model variants when they exist, otherwise generic efforts", () => {
    expect(reasoningEffortChoices({ low: {}, max: {} })).toEqual({ source: "variant", values: ["low", "max"] })
    expect(reasoningEffortChoices({})).toEqual({
      source: "generic",
      values: ["minimal", "low", "medium", "high"],
    })
  })

  test("stores a model variant separately from a generic reasoning effort", () => {
    expect(applyReasoningEffort({ source: "variant", value: "high", model: "openai/gpt-5" })).toEqual({
      model: "openai/gpt-5",
      variant: "high",
      reasoningEffort: "",
    })
    expect(
      applyReasoningEffort({
        source: "variant",
        value: "high",
        model: "",
        resolvedModel: "openai/gpt-5",
      }),
    ).toEqual({
      model: "openai/gpt-5",
      variant: "high",
      reasoningEffort: "",
    })
    expect(applyReasoningEffort({ source: "generic", value: "medium", model: "" })).toEqual({
      model: "",
      variant: "",
      reasoningEffort: "medium",
    })
    expect(applyReasoningEffort({ source: "generic", value: "", model: "openai/gpt-5" })).toEqual({
      model: "openai/gpt-5",
      variant: "",
      reasoningEffort: "",
    })
  })

  test("shows the stored value that matches the current list", () => {
    expect(
      selectedReasoningEffort({
        source: "variant",
        values: ["low", "high"],
        variant: "high",
        reasoningEffort: "medium",
      }),
    ).toBe("high")
    expect(
      selectedReasoningEffort({
        source: "generic",
        values: ["minimal", "low", "medium", "high"],
        variant: "high",
        reasoningEffort: "medium",
      }),
    ).toBe("medium")
  })
})
