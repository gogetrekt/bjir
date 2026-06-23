import { Effect } from "effect"
import { Config } from "@/config/config"
import { Auth } from "@/auth"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"

/**
 * `bjir revoke [provider]` — disconnect a provider so it stops cluttering the
 * connect / model lists. Removes BOTH its global-config block (added by /connect)
 * and its stored credential. With no argument, lists what's connected.
 *
 * Why a CLI command: it runs in-process with direct Config + Auth access, so it
 * can delete a config key (which the merge-only config.update API can't do)
 * without any server round-trip.
 */
export const RevokeCommand = effectCmd({
  command: "revoke [provider]",
  describe: "remove a connected provider (its config block + stored credential)",
  instance: true,
  builder: (yargs) =>
    yargs.positional("provider", {
      describe: "provider id to remove (omit to list)",
      type: "string",
    }),
  handler: Effect.fn("Cli.revoke")(function* (args) {
    const config = yield* Config.Service
    const auth = yield* Auth.Service
    const id = (args as { provider?: string }).provider

    const cfg = yield* config.getGlobal()
    const configured = Object.keys(cfg.provider ?? {})
    const creds = Object.keys(yield* auth.all().pipe(Effect.orElseSucceed(() => ({}))))

    if (!id) {
      const all = [...new Set([...configured, ...creds])].sort()
      if (all.length === 0) {
        UI.println("No connected providers.")
        return
      }
      UI.println("Connected providers:")
      for (const p of all) {
        const tags = [configured.includes(p) ? "config" : null, creds.includes(p) ? "key" : null]
          .filter(Boolean)
          .join("+")
        UI.println(`  ${p}  (${tags})`)
      }
      UI.println("")
      UI.println("Remove one with:  bjir revoke <provider>")
      return
    }

    const { removed } = yield* config.removeProvider(id)
    let credRemoved = false
    if (creds.includes(id)) {
      yield* auth.remove(id).pipe(Effect.orElseSucceed(() => {}))
      credRemoved = true
    }
    if (!removed && !credRemoved) {
      return yield* fail(`No provider "${id}" found in global config or credentials.`)
    }
    const parts = [removed ? "config" : null, credRemoved ? "credential" : null].filter(Boolean).join(" + ")
    UI.println(`Removed "${id}" (${parts}).`)
  }),
})
