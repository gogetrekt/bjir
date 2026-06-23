import { Effect } from "effect"
import { serve } from "@bjir/router"
import { effectCmd } from "../effect-cmd"

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
    yield* Effect.sync(() => serve((args as { port?: number }).port))
    yield* Effect.never
  }),
})
