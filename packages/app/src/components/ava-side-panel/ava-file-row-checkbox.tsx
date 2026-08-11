import { Show } from "solid-js"
import { CheckboxV2 } from "@opencode-ai/ui/v2/checkbox-v2"
import { useLanguage } from "@/context/language"

export function AvaFileRowCheckbox(props: {
  path: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const language = useLanguage()
  const name = () => props.path.split(/[/\\]/).pop() ?? props.path

  return (
    <div
      class="ava-file-row-checkbox shrink-0 pl-1"
      classList={{ "ava-file-row-checkbox-checked": props.checked }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <CheckboxV2
        checked={props.checked}
        onChange={props.onChange}
        hideLabel
        label={language.t("ava.sidePanel.checkboxLabel", { file: name() })}
      />
    </div>
  )
}

export function AvaCopyButton(props: { visible: boolean; copying: boolean; onClick: () => void }) {
  const language = useLanguage()
  return (
    <Show when={props.visible}>
      <button
        type="button"
        class="text-12-medium text-text-strong hover:text-text-strong underline-offset-2 hover:underline disabled:opacity-50"
        disabled={props.copying}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          props.onClick()
        }}
      >
        {language.t("ava.sidePanel.copyToClipboard")}
      </button>
    </Show>
  )
}
