import { Show, createSignal, onCleanup, type JSX } from "solid-js"
import { Portal } from "solid-js/web"

export function TruncatedCursorTooltip(props: {
  text: string
  disabled?: boolean
  children: (handlers: {
    onMouseEnter: (event: MouseEvent) => void
    onMouseLeave: () => void
    onMouseMove: (event: MouseEvent) => void
  }) => JSX.Element
}) {
  const [open, setOpen] = createSignal(false)
  const [point, setPoint] = createSignal({ x: 0, y: 0 })

  const show = (event: MouseEvent) => {
    if (props.disabled || !props.text) return
    setPoint({ x: event.clientX + 12, y: event.clientY + 14 })
    setOpen(true)
  }

  const move = (event: MouseEvent) => {
    if (!open()) return
    setPoint({ x: event.clientX + 12, y: event.clientY + 14 })
  }

  const hide = () => setOpen(false)

  onCleanup(hide)

  return (
    <>
      {props.children({
        onMouseEnter: show,
        onMouseLeave: hide,
        onMouseMove: move,
      })}
      <Show when={open()}>
        <Portal>
          <div
            class="ava-cursor-tooltip"
            style={{ left: `${point().x}px`, top: `${point().y}px` }}
          >
            {props.text}
          </div>
        </Portal>
      </Show>
    </>
  )
}

export function isTextTruncated(element: HTMLElement | null | undefined) {
  if (!element) return false
  return element.scrollWidth > element.clientWidth + 1
}
