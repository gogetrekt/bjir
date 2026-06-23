import { Effect } from "effect"
import { BjirSavings } from "@opencode-ai/core/bjir/savings"
import { effectCmd } from "../effect-cmd"

/**
 * `bjir gain` — full token-savings detail (rtk shell + caveman responses).
 * Same data + format as the in-TUI /gain dialog and the sidebar widget
 * (all read BjirSavings).
 */
export const GainCommand = effectCmd({
  command: "gain",
  describe: "show BJIR token-savings summary (rtk shell + caveman responses)",
  instance: false,
  builder: (yargs) =>
    yargs
      .option("json", { describe: "output raw JSON", type: "boolean" })
      .option("reset", {
        describe: "clear BJIR's cumulative savings history",
        type: "boolean",
        alias: ["clear", "delete"],
      }),
  handler: Effect.fn("Cli.gain")(function* (args) {
    yield* Effect.sync(() => {
      if ((args as { reset?: boolean }).reset) {
        BjirSavings.reset()
        process.stdout.write("BJIR savings data cleared.\n")
        return
      }
      const s = BjirSavings.read()
      if ((args as { json?: boolean }).json) {
        process.stdout.write(JSON.stringify(s, null, 2) + "\n")
        return
      }
      process.stdout.write(BjirSavings.detailLines(s).join("\n") + "\n")
    })
  }),
})
