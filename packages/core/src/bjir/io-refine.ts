export * as BjirIORefine from "./io-refine"

import { BjirProfile } from "./profile"

/**
 * BJIR Universal I/O Refiner (Phase F) — compress EVERY tool's output at the
 * source, before it enters context. This is the agent-side moat: a gateway
 * (9router) never sees tool outputs; only the agent can shrink them.
 *
 * Adapts the proven rtk / 9router compression patterns and applies them to ALL
 * opencode tools (not just shell):
 *   - strip ANSI escape codes        (rtk: strip_ansi)
 *   - drop trailing whitespace + collapse blank-line runs
 *   - dedupe long runs of identical lines  (rtk: log dedup)
 *   - per-tool line caps with head+tail keep  (rtk: max_lines / head_lines / tail_lines)
 *
 * Lossless ops (ANSI/trailing-ws) apply to all tools. Lossy ops (dedup/cap) are
 * SKIPPED for content tools (read/write/edit) so file content stays byte-exact —
 * re-read/semantic savings are Phase G. Gated by BJIR_OPTIMIZE (shared with the
 * prompt refiner) + a granular BJIR_IO_REFINE=0 opt-out.
 */

const DEFAULT_CAP = 200
// 0 = lossless-only (keep content exact). Tune via the table; rtk-style per-tool caps.
const CAPS: Record<string, number> = {
  read: 0,
  "read-filesystem": 0,
  write: 0,
  edit: 0,
  "apply-patch": 0,
  bash: 200,
  grep: 120,
  glob: 150,
  list: 150,
  webfetch: 300,
  websearch: 120,
}

export function enabled(): boolean {
  if (process.env.BJIR_IO_REFINE === "0" || process.env.BJIR_IO_REFINE === "false") return false
  const v = process.env.BJIR_OPTIMIZE
  return v !== "0" && v !== "false"
}

// CSI / OSC ANSI escape sequences.
const ANSI = /\[[0-9;?]*[ -/]*[@-~]|\][^]*/g

/** Collapse runs of >=4 identical non-blank lines into one + "(×N identical)". */
function collapseDupes(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; ) {
    let j = i + 1
    while (j < lines.length && lines[j] === lines[i]) j++
    const n = j - i
    if (n >= 4 && lines[i]!.trim()) out.push(`${lines[i]}  … (×${n} identical)`)
    else for (let k = 0; k < n; k++) out.push(lines[i]!)
    i = j
  }
  return out
}

/** Keep head + tail; replace the middle with a trim notice. */
function capLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines
  const head = Math.max(1, Math.floor(max * 0.7))
  const tail = Math.max(1, max - head)
  const trimmed = lines.length - head - tail
  return [...lines.slice(0, head), `… [BJIR trimmed ${trimmed} lines] …`, ...lines.slice(lines.length - tail)]
}

/** Refine one tool's text output. Returns the original on any doubt. */
export function refineToolOutput(tool: string, text: string): string {
  if (!enabled() || !text) return text
  try {
    let out = text.replace(ANSI, "").replace(/[ \t]+$/gm, "") // lossless: ANSI + trailing ws
    const cap = tool in CAPS ? CAPS[tool]! : DEFAULT_CAP
    if (cap !== 0) {
      out = out.replace(/\n{3,}/g, "\n\n")
      let lines = collapseDupes(out.split("\n"))
      if (lines.length > cap) lines = capLines(lines, cap)
      out = lines.join("\n")
    }
    BjirProfile.record("io:" + tool, text.length - out.length)
    return out
  } catch {
    return text
  }
}
