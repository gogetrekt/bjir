export * as BjirProfiles from "./profiles"

/**
 * BJIR optimization PROFILES — curated bundles of the BJIR_* knobs so users can
 * trade aggressiveness without memorizing every env var. The active profile is
 * read from ~/.bjir/profile (one line) or the BJIR_PROFILE env, and seeded into
 * process.env at startup by apply() — so the optimizer gates (which read env at
 * call time) need no changes. Explicit env always wins over the profile.
 *
 * NOTE: distinct from BjirProfile (./profile.ts) — that's the token *profiler*
 * (savings ledger). This is the optimization *profile* selector.
 *
 *   explain  — everything OFF (honest baseline / A-B; verbose, no rtk)
 *   balanced — defaults (all optimizers on, default thresholds)   [default]
 *   ultra    — aggressive thresholds (outline smaller files, prune harder)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

export type ProfileName = "explain" | "balanced" | "ultra"

/** Each profile is a set of BJIR_* defaults. Empty = stock defaults. */
export const PROFILES: Record<ProfileName, Record<string, string>> = {
  explain: { BJIR_OPTIMIZE: "0", BJIR_RTK: "0" },
  balanced: {},
  ultra: {
    BJIR_SEMANTIC_READ_LINES: "150",
    BJIR_CONTEXT_KEEP: "2",
    BJIR_CONTEXT_THRESHOLD: "300",
  },
}

const FILE = path.join(homedir(), ".bjir", "profile")
const DEFAULT: ProfileName = "balanced"

function isName(v: string): v is ProfileName {
  return v === "explain" || v === "balanced" || v === "ultra"
}

/** Active profile: BJIR_PROFILE env > ~/.bjir/profile > balanced. Never throws. */
export function active(): ProfileName {
  const env = process.env.BJIR_PROFILE?.trim()
  if (env && isName(env)) return env
  try {
    const v = readFileSync(FILE, "utf8").trim()
    if (isName(v)) return v
  } catch {}
  return DEFAULT
}

/**
 * Seed the active profile's knobs into process.env WITHOUT clobbering values the
 * user set explicitly (explicit env wins). Call once at process startup. Returns
 * the applied profile name. Never throws.
 */
export function apply(): ProfileName {
  const name = active()
  try {
    for (const [k, v] of Object.entries(PROFILES[name])) {
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch {}
  return name
}

/** Persist the chosen profile and apply it to the current process. */
export function set(name: ProfileName): void {
  mkdirSync(path.dirname(FILE), { recursive: true })
  writeFileSync(FILE, name + "\n")
  // Force into the current process (user explicitly chose -> override).
  for (const profile of Object.values(PROFILES)) for (const k of Object.keys(profile)) delete process.env[k]
  for (const [k, v] of Object.entries(PROFILES[name])) process.env[k] = v
}

/** Human-readable summary for `bjir profile`. */
export function summary(): string[] {
  const cur = active()
  const out = ["BJIR optimization profile", ""]
  for (const name of Object.keys(PROFILES) as ProfileName[]) {
    const mark = name === cur ? "* " : "  "
    const knobs = Object.entries(PROFILES[name])
      .map(([k, v]) => `${k}=${v}`)
      .join(" ")
    out.push(`${mark}${name.padEnd(9)} ${knobs || "(stock defaults — all optimizers on)"}`)
  }
  out.push("", `active: ${cur}`, "", "switch: bjir profile <explain|balanced|ultra>")
  return out
}
