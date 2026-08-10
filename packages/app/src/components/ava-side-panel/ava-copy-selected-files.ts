export function formatFilesForClipboard(files: { path: string; content: string }[]) {
  return files
    .map((file) => `<<<FILE path=${JSON.stringify(file.path)}>>>\n${file.content}\n<<<END FILE>>>`)
    .join("\n\n")
}

export async function copyTextToClipboard(value: string) {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard
  if (!clipboard?.writeText) return false
  await clipboard.writeText(value)
  return true
}
