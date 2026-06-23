import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"

/**
 * /reducer — single control for BJIR response reduction. Picks the caveman
 * intensity (ponytail stays on; rtk is independent + always-on). Selecting an
 * option applies immediately in one shot (writes the global `reducer` config),
 * no follow-up prompts. Takes effect on the next turn.
 */
const LEVELS = [
  { value: "lite", desc: "caveman-lite + ponytail — full sentences, drops only filler/hedging" },
  { value: "standard", desc: "caveman-full + ponytail — classic caveman (default)" },
  { value: "ultra", desc: "caveman-ultra + ponytail — telegraphic, maximum reduction" },
] as const

export function DialogReducer() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()
  const { theme } = useTheme()

  const current = () => (sync.data.config as { reducer?: string }).reducer ?? "standard"

  const options = LEVELS.map((l) => ({
    title: l.value,
    value: l.value,
    description: l.desc,
    gutter: l.value === current() ? () => <text fg={theme.success}>✓</text> : undefined,
    async onSelect() {
      // reducer isn't in the generated SDK config type yet; the server validates
      // the payload against the updated schema, so cast at the call boundary.
      const { error } = await sdk.client.global.config.update({ config: { reducer: l.value } as any })
      if (error) {
        toast.show({ variant: "error", message: `Failed to set reducer: ${JSON.stringify(error)}` })
        dialog.clear()
        return
      }
      await sdk.client.instance.dispose()
      await sync.bootstrap()
      toast.show({ variant: "info", message: `Reducer set to ${l.value}` })
      dialog.clear()
    },
  }))

  return <DialogSelect title="Response reducer — caveman level (ponytail always on)" options={options} />
}
