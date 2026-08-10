import { createMemo } from "solid-js"
import { useServerSync } from "@/context/server-sync"

export function useAvaFileHeadersSetting() {
  const serverSync = useServerSync()
  const enabled = createMemo(() => serverSync().data.config.ava?.fileHeadersOnRead === true)

  const setEnabled = (value: boolean) => {
    const config = serverSync().data.config
    return serverSync().updateConfig({
      ...config,
      ava: {
        ...config.ava,
        fileHeadersOnRead: value,
      },
    })
  }

  return { enabled, setEnabled }
}
