import { Show, createSignal } from "solid-js"
import { Portal } from "solid-js/web"
import { useLanguage } from "@/context/language"

export function AvaFileContextMenu(props: {
  open: boolean
  x: number
  y: number
  onClose: () => void
  onReveal: () => void
}) {
  const language = useLanguage()
  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50" onPointerDown={props.onClose} onContextMenu={(event) => event.preventDefault()}>
          <div
            class="absolute min-w-44 rounded-md border border-border-weak-base bg-background-stronger shadow-md py-1"
            style={{ left: `${props.x}px`, top: `${props.y}px` }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              class="w-full text-start px-3 py-1.5 text-12-regular text-text-strong hover:bg-surface-base-hover"
              onClick={() => {
                props.onReveal()
                props.onClose()
              }}
            >
              {language.t("session.header.reveal.fileExplorer")}
            </button>
          </div>
        </div>
      </Portal>
    </Show>
  )
}

export function useAvaFileContextMenu() {
  const [open, setOpen] = createSignal(false)
  const [point, setPoint] = createSignal({ x: 0, y: 0 })
  const [path, setPath] = createSignal<string>()

  const show = (next: string, event: MouseEvent) => {
    event.preventDefault()
    setPath(next)
    setPoint({ x: event.clientX, y: event.clientY })
    setOpen(true)
  }

  return {
    open,
    point,
    path,
    show,
    close: () => setOpen(false),
  }
}
