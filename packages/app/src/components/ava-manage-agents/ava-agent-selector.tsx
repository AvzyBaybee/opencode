import { For, type Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { KeybindV2 } from "@opencode-ai/ui/v2/keybind-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { createMenuDismissController } from "@/utils/menu-dismiss-controller"

export function AvaAgentSelector(props: {
  title: string
  keybind: string[]
  options: Accessor<{ id: string; label: string }[]>
  current: Accessor<string>
  onSelect: (id: string) => void
  onClose?: () => void
}) {
  const [store, setStore] = createStore({ open: false, active: "" })
  let contentRef: HTMLDivElement | undefined
  const dismiss = createMenuDismissController(() => contentRef)
  const keys = () => props.options().map((option) => option.id)
  const setOpen = (open: boolean) => {
    if (open) {
      dismiss.allowTriggerRestore()
      setStore({ open: true, active: props.current() || keys()[0] || "" })
      return
    }
    setStore({ open: false, active: "" })
  }
  const select = (id: string) => {
    dismiss.preventTriggerRestore()
    setOpen(false)
    dismiss.afterClose(() => props.onSelect(id))
  }

  return (
    <TooltipV2
      placement="top"
      value={
        <>
          {props.title}
          <KeybindV2 keys={props.keybind} variant="neutral" />
        </>
      }
    >
      <MenuV2 gutter={6} modal={false} placement="top-start" open={store.open} onOpenChange={setOpen}>
        <MenuV2.Trigger
          as={ButtonV2}
          variant="ghost-muted"
          size="normal"
          class="max-w-[220px] justify-start ![font-weight:440]"
          aria-label={props.title}
        >
          <span class="truncate capitalize leading-5">
            {props.options().find((option) => option.id === props.current())?.label ?? props.current()}
          </span>
          <span class="-ms-0.5 -me-1 flex shrink-0">
            <Icon name="chevron-down" />
          </span>
        </MenuV2.Trigger>
        <MenuV2.Portal>
          <MenuV2.Content
            ref={(element: HTMLDivElement) => {
              contentRef = element
            }}
            onPointerDownOutside={dismiss.preventTriggerRestore}
            onFocusOutside={dismiss.preventTriggerRestore}
            onCloseAutoFocus={dismiss.onCloseAutoFocus}
          >
            <MenuV2.RadioGroup value={props.current()} onChange={select}>
              <For each={props.options()}>
                {(option) => (
                  <MenuV2.RadioItem
                    value={option.id}
                    class="capitalize"
                    classList={{ "!bg-v2-overlay-simple-overlay-hover": store.active === option.id }}
                    onMouseEnter={() => setStore("active", option.id)}
                  >
                    {option.label}
                  </MenuV2.RadioItem>
                )}
              </For>
            </MenuV2.RadioGroup>
          </MenuV2.Content>
        </MenuV2.Portal>
      </MenuV2>
    </TooltipV2>
  )
}
