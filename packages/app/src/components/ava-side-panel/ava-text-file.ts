const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "svg",
  "mp3",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "wav",
  "ogg",
  "flac",
  "zip",
  "gz",
  "tar",
  "7z",
  "rar",
  "pdf",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "wasm",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "class",
  "o",
  "a",
  "lib",
  "pdb",
  "dmg",
  "iso",
  "img",
])

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdx"])

function fileExtension(path: string) {
  const base = path.split(/[/\\]/).pop() ?? path
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) return
  return base.slice(dot + 1).toLowerCase()
}

export function isTextFilePath(path: string) {
  const ext = fileExtension(path)
  if (!ext) return true
  return !BINARY_EXTENSIONS.has(ext)
}

export function isMarkdownFilePath(path: string) {
  const ext = fileExtension(path)
  return !!ext && MARKDOWN_EXTENSIONS.has(ext)
}

export function folderBasename(path: string) {
  const normalized = path.replace(/[\\/]+$/, "")
  const parts = normalized.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || path
}
