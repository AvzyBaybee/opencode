export const GENERIC_REASONING_EFFORTS = ["minimal", "low", "medium", "high"] as const

export function modelValue(item: { id: string; provider: { id: string } }) {
  return `${item.provider.id}/${item.id}`
}

export function reasoningEffortChoices(variants: unknown) {
  const values = variantKeys(variants)
  if (values.length > 0) return { source: "variant" as const, values }
  return { source: "generic" as const, values: [...GENERIC_REASONING_EFFORTS] }
}

export function applyReasoningEffort(input: {
  source: "variant" | "generic"
  value: string
  model: string
  resolvedModel?: string
}) {
  if (!input.value) {
    return { model: input.model, variant: "", reasoningEffort: "" }
  }
  if (input.source === "variant") {
    return {
      model: input.model.trim() ? input.model : (input.resolvedModel ?? ""),
      variant: input.value,
      reasoningEffort: "",
    }
  }
  return { model: input.model, variant: "", reasoningEffort: input.value }
}

export function selectedReasoningEffort(input: {
  source: "variant" | "generic"
  values: string[]
  variant: string
  reasoningEffort: string
}) {
  if (input.source === "variant" && input.values.includes(input.variant)) return input.variant
  if (input.source === "generic" && input.values.includes(input.reasoningEffort)) return input.reasoningEffort
  return ""
}

export function variantKeys(variants: unknown) {
  if (!variants) return [] as string[]
  if (Array.isArray(variants)) {
    return variants.flatMap((item) => {
      if (typeof item === "string" && item.trim()) return [item.trim()]
      if (!item || typeof item !== "object") return []
      const id = "id" in item && typeof item.id === "string" ? item.id.trim() : ""
      if (!id) return []
      if ("disabled" in item && item.disabled === true) return []
      return [id]
    })
  }
  if (typeof variants !== "object") return []
  return Object.entries(variants).flatMap(([key, value]) => {
    if (!key.trim()) return []
    if (value && typeof value === "object" && "disabled" in value && value.disabled === true) return []
    return [key]
  })
}

export function findModelByValue<T extends { id: string; provider: { id: string } }>(models: T[], value: string) {
  const trimmed = value.trim()
  if (!trimmed) return
  return models.find((item) => modelValue(item) === trimmed)
}
