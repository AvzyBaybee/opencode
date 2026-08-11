import { Show } from "solid-js"
import { isHsbZero, type AvaHsbOffset } from "./ava-ui-surface-adjust"

export function AvaUiHsbSliders(props: {
  value: AvaHsbOffset
  hueLabel: string
  saturationLabel: string
  brightnessLabel: string
  resetLabel: string
  onChange: (value: AvaHsbOffset) => void
  onReset: () => void
}) {
  const setChannel = (channel: keyof AvaHsbOffset, raw: string) => {
    props.onChange({ ...props.value, [channel]: Number(raw) })
  }

  return (
    <div class="flex flex-col items-end gap-1.5">
      <label class="flex items-center gap-2">
        <span class="min-w-20 text-right text-12-medium text-text-weak">{props.hueLabel}</span>
        <input
          type="range"
          min="-50"
          max="50"
          step="1"
          value={props.value.h}
          aria-label={props.hueLabel}
          class="h-1 w-28 cursor-pointer"
          style={{ "accent-color": "var(--text-interactive-base, var(--v2-text-text-accent, #6b8cff))" }}
          onInput={(event) => setChannel("h", event.currentTarget.value)}
        />
      </label>
      <label class="flex items-center gap-2">
        <span class="min-w-20 text-right text-12-medium text-text-weak">{props.saturationLabel}</span>
        <input
          type="range"
          min="-50"
          max="50"
          step="1"
          value={props.value.s}
          aria-label={props.saturationLabel}
          class="h-1 w-28 cursor-pointer"
          style={{ "accent-color": "var(--text-interactive-base, var(--v2-text-text-accent, #6b8cff))" }}
          onInput={(event) => setChannel("s", event.currentTarget.value)}
        />
      </label>
      <label class="flex items-center gap-2">
        <span class="min-w-20 text-right text-12-medium text-text-weak">{props.brightnessLabel}</span>
        <input
          type="range"
          min="-50"
          max="50"
          step="1"
          value={props.value.b}
          aria-label={props.brightnessLabel}
          class="h-1 w-28 cursor-pointer"
          style={{ "accent-color": "var(--text-interactive-base, var(--v2-text-text-accent, #6b8cff))" }}
          onInput={(event) => setChannel("b", event.currentTarget.value)}
        />
      </label>
      <Show when={!isHsbZero(props.value)}>
        <button
          type="button"
          class="text-12-medium text-text-weak transition-colors hover:text-text-base"
          onClick={() => props.onReset()}
        >
          {props.resetLabel}
        </button>
      </Show>
    </div>
  )
}
