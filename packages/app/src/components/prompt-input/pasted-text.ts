export type PastedTextBlock = {
  createdAt: number
  ordinal: number
  text: string
}

export function appendPastedTexts(promptText: string, pastes: PastedTextBlock[]) {
  if (pastes.length === 0) return promptText
  const blocks = pastes.map((paste, index) => formatPastedText(paste, index + 1)).join("\n\n")
  const wrapped = `<pasted_texts>\n${blocks}\n</pasted_texts>`
  if (!promptText.trim()) return wrapped
  return `${promptText.replace(/\s+$/, "")}\n\n${wrapped}`
}

function formatPastedText(paste: PastedTextBlock, index: number) {
  const day = new Date(paste.createdAt).toISOString().slice(0, 10)
  const title = paste.ordinal > 1 ? `Paste ${day} ${paste.ordinal}` : `Paste ${day}`
  return `<pasted_text index="${index}" title="${xmlAttr(title)}" characters="${paste.text.length}">\n${cdata(paste.text)}\n</pasted_text>`
}

function xmlAttr(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")
}

function cdata(text: string) {
  const body = text.includes("]]>") ? text.replaceAll("]]>", "]]]]><![CDATA[>") : text
  return `<![CDATA[\n${body}\n]]>`
}
