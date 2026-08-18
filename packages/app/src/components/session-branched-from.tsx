import { A } from "@solidjs/router"
import { MessageDivider } from "@opencode-ai/session-ui/message-part"
import { useLanguage } from "@/context/language"
import { sessionTitle } from "@/utils/session-title"

export function SessionBranchedFrom(props: { href: string; title: string }) {
  const language = useLanguage()
  const title = () => sessionTitle(props.title) || props.title

  return (
    <div data-slot="session-branched-from" class="w-full px-2.5 pr-3 md:px-4 md:max-w-200 md:mx-auto 2xl:max-w-[1000px]">
      <MessageDivider>
        <span class="inline-flex max-w-full items-baseline gap-1">
          <span class="text-12-regular leading-4 text-text-weak">{language.t("session.branchedFrom")}</span>
          <A href={props.href} class="min-w-0 max-w-[min(40vw,20rem)] text-12-regular leading-4 text-text-base hover:text-text-strong">
            <span class="underline decoration-border-weak-base underline-offset-2">{title()}</span>
          </A>
        </span>
      </MessageDivider>
    </div>
  )
}
