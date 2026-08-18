import type { LaidOutCommit } from "../layout"

const CLOUD_D = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
const DRIVE_D =
  "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"
const CLOUD_FILL = "#6b8cff"
const DRIVE_FILL = "#c4a35a"
const DRIVE_INK = "#2a2110"

export function drawBackupPlaceMark(ctx: CanvasRenderingContext2D, commit: LaidOutCommit) {
  if (typeof Path2D === "undefined") return
  const size = 15
  const x = commit.cardLeft + commit.cardWidth - 10 - size
  const y = commit.cardTop + (commit.cardHeight - size) / 2
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.lineWidth = 1.6
  if (commit.onCloud) {
    ctx.fillStyle = CLOUD_FILL
    ctx.fill(new Path2D(CLOUD_D))
    ctx.restore()
    return
  }
  ctx.fillStyle = DRIVE_FILL
  ctx.fill(new Path2D(DRIVE_D))
  ctx.strokeStyle = DRIVE_INK
  ctx.beginPath()
  ctx.moveTo(2, 12)
  ctx.lineTo(22, 12)
  ctx.stroke()
  ctx.fillStyle = DRIVE_INK
  ctx.beginPath()
  ctx.arc(6, 16, 1.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(10, 16, 1.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
