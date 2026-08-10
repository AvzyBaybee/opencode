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

export function isTextFilePath(path: string) {
  const base = path.split(/[/\\]/).pop() ?? path
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) return true
  const ext = base.slice(dot + 1).toLowerCase()
  return !BINARY_EXTENSIONS.has(ext)
}

export function folderBasename(path: string) {
  const normalized = path.replace(/[\\/]+$/, "")
  const parts = normalized.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || path
}
