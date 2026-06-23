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
  const initial = (() => { try { return BjirSavings.grandTotal() } catch { return 0 } })()
  const [saved, setSaved] = createSignal(initial)

  onMount(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      try { setSaved(BjirSavings.grandTotal()) } catch {}
      timer = setTimeout(tick, 5000)
    }
    timer = setTimeout(tick, 5000)
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
