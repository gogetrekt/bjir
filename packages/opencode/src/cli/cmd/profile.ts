import { Effect } from "effect"
import { BjirProfiles, type ProfileName } from "@opencode-ai/core/bjir/profiles"
import { effectCmd } from "../effect-cmd"

/**
 * `bjir profile [name]` — show or switch the optimization profile
 * (explain | balanced | ultra). Persists to ~/.bjir/profile; every later
 * `bjir run`/TUI seeds the profile's BJIR_* knobs at startup. Explicit env wins.
 */
export const ProfileCommand = effectCmd({
  command: "profile [name]",
  describe: "show or switch the BJIR optimization profile (explain|balanced|ultra)",
  instance: false,
  builder: (yargs) =>
    yargs.positional("name", {
      describe: "profile to switch to",
      type: "string",
      choices: ["explain", "balanced", "ultra"],
    }),
  handler: Effect.fn("Cli.profile")(function* (args) {
    yield* Effect.sync(() => {
      const name = (args as { name?: string }).name
      if (name) {
        BjirProfiles.set(name as ProfileName)
        process.stdout.write(`bjir: optimization profile -> ${name}\n\n`)
      }
      process.stdout.write(BjirProfiles.summary().join("\n") + "\n")
    })
  }),
})
