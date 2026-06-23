import { For } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useBindings } from "../keymap"
import { BjirSavings } from "@opencode-ai/core/bjir/savings"

/**
 * In-TUI token-savings detail (/gain). Renders the exact same lines as the
 * `bjir gain` CLI command (BjirSavings.detailLines) so both UIs match.
 */
export function DialogGain() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const lines = BjirSavings.detailLines()

  useBindings(() => ({
    bindings: [{ key: "return", desc: "Close", group: "Dialog", cmd: () => dialog.clear() }],
  }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Token Savings
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box>
        <For each={lines}>
          {(l) => {
            const t = l.trim()
            const fg = t.startsWith("TOTAL SAVED")
              ? theme.success
              : l === "BJIR Token Gain" || l.includes("═") || t.startsWith("Optimizer")
                ? theme.text
                : theme.textMuted
            return <text fg={fg}>{l.length ? l : " "}</text>
          }}
        </For>
      </box>
    </box>
  )
}
