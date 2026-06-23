/**
 * BJIR configuration — profiles + gateway defaults.
 *
 * A profile maps to: which rule files load via opencode.json `instructions`,
 * whether rtk wraps shell commands (BJIR_RTK env), and the caveman level.
 * `instructionsFor(profile)` produces the `instructions` array; `bjir profile
 * <name>` (Phase 4) applies it by rewriting opencode.json + setting BJIR_RTK.
 */

export type CavemanLevel = "off" | "lite" | "full" | "ultra"

export interface Profile {
  ponytail: boolean
  caveman: CavemanLevel
  rtk: boolean
}

export interface BjirConfig {
  gateway: { port: number; defaultModel: string; fallbackChain: string[] }
  profile: keyof typeof profiles | string
  rtk: { exclude: string[] }
}

export const profiles = {
  dev: { ponytail: true, caveman: "full", rtk: true },
  review: { ponytail: true, caveman: "off", rtk: true },
  explain: { ponytail: false, caveman: "off", rtk: false },
  ultra: { ponytail: true, caveman: "ultra", rtk: true },
} satisfies Record<string, Profile>

const config: BjirConfig = {
  gateway: {
    port: 9090,
    defaultModel: "auto",
    fallbackChain: ["claude-sonnet-4-6", "gpt-4o", "gemini/gemini-2.0-flash", "ollama:qwen2.5-coder"],
  },
  profile: "dev",
  rtk: { exclude: ["cat", "diff", "echo"] },
}

const RULES_DIR = "bjir/rules"

/** The `instructions` entries for a profile (ponytail first, then caveman level). */
export function instructionsFor(p: Profile): string[] {
  const out: string[] = []
  if (p.ponytail) out.push(`${RULES_DIR}/ponytail.md`)
  if (p.caveman !== "off") out.push(`${RULES_DIR}/caveman-${p.caveman}.md`)
  return out
}

export default config
