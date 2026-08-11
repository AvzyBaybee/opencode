import { Show, createEffect, createSignal, onCleanup, type Accessor, type JSX } from "solid-js"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import type { Message } from "@opencode-ai/sdk/v2/client"

export function cacheDurationMs(model: { provider: { id: string }; id: string }) {
  const value = `${model.provider.id} ${model.id}`.toLowerCase()
  if (!/anthropic|bedrock|claude/.test(value)) return
  return 5 * 60 * 1000
}

export function cacheExpiry(messages: readonly Message[], model: { provider: { id: string }; id: string }) {
  const duration = cacheDurationMs(model)
  if (!duration) return
  const message = [...messages].reverse().find((item) => {
    if (item.role !== "assistant") return false
    return item.providerID === model.provider.id && item.modelID === model.id && item.tokens.cache.write > 0
  })
  if (!message || message.role !== "assistant" || message.time.completed === undefined) return
  return message.time.completed + duration
}

type SessionAssistant = {
  type: "assistant"
  model: { providerID: string; modelID: string }
  cacheExpiresAt?: number
  tokens?: { cache: { write: number } }
  time: { created: number; completed?: number }
}

export function sessionCacheExpiry(
  messages: readonly { type: string }[],
  model: { provider: { id: string }; id: string },
) {
  const duration = cacheDurationMs(model)
  if (!duration) return
  const message = [...messages].reverse().find((item): item is SessionAssistant => {
    if (item.type !== "assistant") return false
    const assistant = item as SessionAssistant
    return (
      assistant.model.providerID === model.provider.id &&
      assistant.model.modelID === model.id &&
      (assistant.cacheExpiresAt !== undefined || (assistant.tokens?.cache.write ?? 0) > 0)
    )
  })
  if (!message) return
  if (message.cacheExpiresAt !== undefined) return message.cacheExpiresAt
  if (message.time.completed === undefined) return
  return message.time.completed + duration
}

export function CacheTimerRing(props: {
  expiresAt: Accessor<number | undefined>
  durationMs: Accessor<number | undefined>
  actionLabel: Accessor<JSX.Element>
  timeLabel: (remainingSeconds: number) => string
  inactive?: boolean
  children: JSX.Element
}) {
  const [now, setNow] = createSignal(Date.now())

  createEffect(() => {
    if (props.expiresAt() === undefined) return
    setNow(Date.now())
    const interval = setInterval(() => {
      const current = Date.now()
      setNow(current)
      const expiresAt = props.expiresAt()
      if (expiresAt !== undefined && current >= expiresAt) clearInterval(interval)
    }, 100)
    onCleanup(() => clearInterval(interval))
  })

  const remaining = () => Math.max(0, (props.expiresAt() ?? 0) - now())
  const remainingSeconds = () => Math.ceil(remaining() / 1000)
  const progress = () => {
    const expiresAt = props.expiresAt()
    if (expiresAt === undefined || expiresAt <= now()) return 0
    return Math.min(1, Math.max(0, (expiresAt - now()) / Math.max(1, props.durationMs() ?? 1)))
  }
  const active = () => progress() > 0

  return (
    <TooltipV2
      placement="top"
      inactive={!!props.inactive && !active()}
      value={
        <>
          {props.actionLabel()}
          <Show when={active()}>
            <span style={{ color: "var(--v2-text-text-muted)" }}>·</span>
            <span style={{ color: "var(--v2-text-text-muted)", "font-variant-numeric": "tabular-nums" }}>
              {props.timeLabel(remainingSeconds())}
            </span>
          </Show>
        </>
      }
    >
      <span class="relative inline-flex">
        {props.children}
        <Show when={active()}>
          <svg
            class="pointer-events-none absolute inset-[1px] h-[calc(100%-2px)] w-[calc(100%-2px)]"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="96"
              height="96"
              rx="20"
              fill="none"
              stroke="color-mix(in srgb, var(--text-strong, var(--v2-text-text-base)) 78%, transparent)"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
              pathLength="100"
              stroke-dasharray="100"
              stroke-dashoffset={100 - progress() * 100}
              transform="rotate(-90 50 50)"
            />
          </svg>
        </Show>
      </span>
    </TooltipV2>
  )
}
