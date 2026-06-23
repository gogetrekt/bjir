export * as BjirOptimize from "./optimize"

import { BjirProfile } from "./profile"

/**
 * BJIR built-in optimizations, compiled into the binary (NOT user-editable
 * config) so they are always on:
 *   - PONYTAIL — code minimalism (Bloat Judgement)
 *   - CAVEMAN  — terse responses (output token reduction), 3 intensity levels
 *   - refinePrompt() — the I/O Refiner: a conservative, lossless-ish pass that
 *     shrinks the assembled prompt we SEND (input token reduction).
 *
 * Injected in the system-prompt assembly (session/llm/request) at the active
 * `reducer` level. RULE TEXT is adapted from the upstream rulesets
 * (caveman: JuliusBrussee/caveman, ponytail: DietrichGebert/ponytail) — bjir
 * embeds compiled copies (no package/hooks/skills bundled), and maps its
 * lite/standard/ultra reducer onto caveman's lite/full/ultra intensity table.
 */

const PONYTAIL = `## Code minimalism (ponytail — Bloat Judgement)

Before writing ANY code, stop at the first rung that works:
1. Does this need to exist? -> No: skip it (YAGNI)
2. Stdlib does it? -> use it
3. Native platform feature? -> use it
4. Already-installed dependency? -> use it
5. One line? -> one line
6. Only then: the minimum that works

No unrequested abstractions. Deletion over addition. Boring over clever. Fewest files.
If prose outweighs code, delete the prose.
NEVER cut: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, anything the user explicitly requested.
Mark deliberate simplifications with a \`ponytail:\` comment naming the ceiling + upgrade path.`

// caveman LITE — drop only filler/hedging; keep articles + full sentences.
const CAVEMAN_LITE = `## Response style (caveman — lite)

Drop only: filler (just/really/basically/actually/very), hedging (probably/maybe/might), pleasantries, recap of what you just did.
KEEP articles and full sentences — professional but tight. No fragments, no abbreviations.
Keep exact: code blocks, command syntax/flags, error strings, file paths, identifiers, numbers.
Code, commits, and PRs are written normally.
Auto-clarity (normal prose): security warnings, irreversible-action confirmations, when the user is confused.`

// caveman FULL (default) — classic caveman: drop articles, fragments, abbrev.
const CAVEMAN_FULL = `## Response style (caveman — full)

Drop: articles (a/an/the), filler (just/really/basically/actually/very), hedging (probably/maybe/might), pleasantries, recap of what you just did.
Keep exact: code blocks, command syntax/flags, error strings, file paths, identifiers, numbers.
Fragments OK. Arrows for causality: -> produces, <- receives. Abbrev: fn db auth API config var req resp obj arr str num bool.
No tool-call narration, no decorative tables/emoji, no long raw error-log dumps unless asked.
Code, commits, and PRs are written normally.
Auto-clarity (switch to normal prose): security warnings, irreversible-action confirmations, multi-step where fragments risk misread, when the user is confused. Resume after.`

// caveman ULTRA — telegraphic: full + prose-word abbreviation + strip conjunctions.
const CAVEMAN_ULTRA = `## Response style (caveman — ultra)

Drop: articles (a/an/the), filler, hedging, pleasantries, recap, AND conjunctions wherever meaning survives.
Abbreviate PROSE words only (db/auth/config/req/resp/fn/impl/obj/arr/str/num/bool) — NEVER abbreviate real code symbols, function names, or identifiers.
Fragments default. Arrows for causality: X -> Y. One word when one word is enough.
Keep exact: code blocks, command syntax/flags, error strings, file paths, identifiers, numbers.
Code, commits, and PRs are written normally.
Auto-clarity (switch to normal prose): security warnings, irreversible-action confirmations, multi-step where fragments risk misread, when the user is confused. Resume after.`

export type ReducerLevel = "lite" | "standard" | "ultra"

const CAVEMAN_BY_LEVEL: Record<ReducerLevel, string> = {
  lite: CAVEMAN_LITE,
  standard: CAVEMAN_FULL,
  ultra: CAVEMAN_ULTRA,
}

/** Normalize an arbitrary value to a valid reducer level (default standard). */
export function level(value?: string | null): ReducerLevel {
  return value === "lite" || value === "ultra" ? value : "standard"
}

/**
 * The system rules for a given reducer level — ponytail (always on) + the
 * caveman intensity for that level. `standard` -> caveman full (startup default).
 */
export function rules(reducer: ReducerLevel = "standard"): string {
  return [PONYTAIL, CAVEMAN_BY_LEVEL[reducer]].join("\n\n")
}

/** Back-compat: the default (standard) rule bundle. */
export const BJIR_SYSTEM_RULES = rules("standard")

/** Whether the built-in optimizers are active. Default ON; BJIR_OPTIMIZE=0
 * disables (used by the "explain" profile and for A/B measurement). */
export function enabled(): boolean {
  const v = process.env.BJIR_OPTIMIZE
  return v !== "0" && v !== "false"
}

/**
 * I/O Refiner: shrink the prompt text we send without changing meaning.
 * Preserves fenced code blocks byte-for-byte; collapses redundant whitespace
 * and blank lines, trims trailing spaces. Lossless for content, lossy only for
 * formatting bloat -> fewer input tokens.
 */
export function refinePrompt(text: string): string {
  if (!text) return text
  // Pull out fenced code blocks first and restore them byte-for-byte after the
  // whitespace passes. The sentinel has NO spaces/newlines so the collapse
  // passes can't mangle it (a space-padded placeholder lost its trailing space
  // to the trailing-whitespace strip and never restored — corrupting code).
  const blocks: string[] = []
  let out = text.replace(/```[\s\S]*?```/g, (m) => {
    blocks.push(m)
    return `[[BJIRCB${blocks.length - 1}]]`
  })
  out = out
    .replace(/[ \t]+$/gm, "") // trailing whitespace
    .replace(/(\S)[ \t]{2,}/g, "$1 ") // collapse INTERIOR space runs (preserve leading indent)
    .replace(/\n{3,}/g, "\n\n") // 3+ blank lines -> 1
    .trim()
  const _r = out.replace(/\[\[BJIRCB(\d+)\]\]/g, (_, i) => blocks[Number(i)] ?? "")
  BjirProfile.record("prompt-refine", Math.max(0, text.length - _r.length))
  return _r
}
