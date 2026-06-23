import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { BjirSavings } from "@opencode-ai/core/bjir/savings"

/**
 * BJIR passive token-savings indicator for the sidebar footer. Shows the
 * COMBINED savings (rtk shell + caveman responses) — same source of truth as
 * `bjir gain` and the /gain dialog. Crash-safe: any error -> renders nothing.
 */
export function TokenSavings() {
  const { theme } = useTheme()
  const [saved, setSaved] = createSignal(0)

  onMount(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      try {
        setSaved(BjirSavings.read().totalSaved)
      } catch {}
      timer = setTimeout(tick, 5000)
    }
    tick()
    onCleanup(() => timer && clearTimeout(timer))
  })

  return (
    <Show when={saved() > 0}>
      <text fg={theme.textMuted}>
        <span style={{ fg: theme.success }}>⬇</span> {BjirSavings.fmt(saved())} tokens saved
      </text>
    </Show>
  )
}
