import { Effect } from "effect"
import { serve } from "@bjir/router"
import { effectCmd } from "../effect-cmd"
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * `bjir gateway` — start the BJIR Gateway. Lets the single bjir binary
 * also serve as the gateway (the launcher runs `bjir gateway` in the background,
 * then runs the agent). Blocks until killed.
 */
export const RouterCommand = effectCmd({
  command: "gateway",
  describe: "start the BJIR Gateway (used internally by bjir)",
  instance: false,
  builder: (yargs) =>
    yargs.option("port", { type: "number", describe: "port to listen on (default 9090 / BJIR_GATEWAY_PORT)" }),
  handler: Effect.fn("Cli.gateway")(function* (args) {
    yield* Effect.sync(() => {
      // Inject provider API keys from opencode.json so gateway providers
      // have credentials even when not explicitly set in the shell environment.
      for (const p of [join(process.cwd(), "opencode.json"), join(homedir(), ".config", "opencode", "opencode.json")]) {
        try {
          if (!existsSync(p)) continue
          const cfg = JSON.parse(readFileSync(p, "utf8"))
          const prov: Record<string, { apiKey?: string; url?: string }> = cfg?.providers ?? {}
          const set = (envKey: string, val?: string) => { if (val && !process.env[envKey]) process.env[envKey] = val }
          set("ANTHROPIC_API_KEY", prov.anthropic?.apiKey)
          set("MIMO_API_KEY", prov.mimo?.apiKey)
          set("MIMO_OPENAI_BASE", prov.mimo?.url)
          set("OPENAI_API_KEY", prov.openai?.apiKey)
          set("OPENAI_BASE_URL", prov.openai?.url)
          set("GEMINI_API_KEY", prov.gemini?.apiKey)
          set("OPENROUTER_API_KEY", prov.openrouter?.apiKey)
        } catch {} // best-effort
      }
      serve((args as { port?: number }).port)
    })
    yield* Effect.never
  }),
})
