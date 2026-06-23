export * as BjirSavings from "./savings"

/**
 * BJIR token-savings — the single source of truth read by ALL surfaces:
 *   - sidebar widget (compact, passive)        -> compactLine()
 *   - `bjir gain` CLI command (full detail)     -> detailLines()
 *   - in-TUI /gain dialog (same detail)         -> detailLines()
 *
 * Combines response savings (caveman, from ~/.bjir/token-log.ndjson written by
 * gateway) with rtk shell savings (rtk's own numbers via `rtk gain --json`).
 * Best-effort + cached; never throws.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { BjirProfile } from "./profile"

const LOG = path.join(homedir(), ".bjir", "token-log.ndjson")
// caveman cuts ~65% of output tokens; saved vs a verbose baseline of out/0.35.
const CAVEMAN_REDUCTION = 0.65

export interface RtkGain {
  commands: number
  input: number
  output: number
  saved: number
  pct: number
}
export interface ResponseGain {
  calls: number
  input: number
  output: number
  savedEst: number
}
export interface Savings {
  response: ResponseGain
  rtk: RtkGain | null
  totalSaved: number
}

function rtkBin(): string | null {
  const env = process.env.BJIR_RTK_BIN
  if (env && existsSync(env)) return env
  const onPath = typeof Bun !== "undefined" ? Bun.which("rtk") : null
  if (onPath) return onPath
  for (const c of [
    path.join(homedir(), ".bjir", "bin", "rtk"),
    path.join(process.cwd(), "bjir", "rtk", "rtk"),
    path.resolve(import.meta.dir, "../../../..", "bjir", "rtk", "rtk"),
  ])
    if (existsSync(c)) return c
  return null
}

function readResponse(): ResponseGain {
  let calls = 0
  let input = 0
  let output = 0
  try {
    for (const line of readFileSync(LOG, "utf8").split("\n")) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line)
        calls++
        input += e.in ?? 0
        output += e.out ?? 0
      } catch {}
    }
  } catch {}
  const savedEst = Math.round(output * (CAVEMAN_REDUCTION / (1 - CAVEMAN_REDUCTION)))
  return { calls, input, output, savedEst }
}

let rtkCache: { at: number; val: RtkGain | null } | undefined
function readRtk(ttlMs = 15000): RtkGain | null {
  const now = Date.now()
  if (rtkCache && now - rtkCache.at < ttlMs) return rtkCache.val
  let val: RtkGain | null = null
  try {
    const bin = rtkBin()
    if (bin && typeof Bun !== "undefined") {
      const p = Bun.spawnSync([bin, "gain", "--format", "json"])
      if (p.success) {
        const s = JSON.parse(new TextDecoder().decode(p.stdout)).summary ?? {}
        val = {
          commands: s.total_commands ?? 0,
          input: s.total_input ?? 0,
          output: s.total_output ?? 0,
          saved: s.total_saved ?? 0,
          pct: s.avg_savings_pct ?? 0,
        }
      }
    }
  } catch {}
  rtkCache = { at: now, val }
  return val
}

export function read(): Savings {
  const response = readResponse()
  const rtk = readRtk()
  return { response, rtk, totalSaved: response.savedEst + (rtk?.saved ?? 0) }
}

/** Humanized token count, matching rtk's style (56.4K, 1.2M). */
export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(Math.round(n))
}

// Friendly labels for the profiler kinds (io:<tool> handled generically).
const KIND_LABEL: Record<string, string> = {
  "smart-crush": "smart-crush (JSON)",
  "log-compress": "log-compress",
  "semantic-read": "semantic-read",
  "read-dedup": "read-dedup",
  "prompt-refine": "prompt-refine",
  "context-prune": "context-prune",
}
function labelFor(kind: string): string {
  if (KIND_LABEL[kind]) return KIND_LABEL[kind]
  if (kind.startsWith("io:")) return "io: " + kind.slice(3)
  return kind
}

type Row = { label: string; ops: number; saved: number; pct: string }

/** Unified, ranked savings rows across every optimizer (agent-side + caveman + rtk). */
function rows(s: Savings): Row[] {
  const out: Row[] = []
  for (const [kind, st] of Object.entries(BjirProfile.summary())) {
    out.push({ label: labelFor(kind), ops: st.events, saved: Math.round(st.savedChars / 4), pct: "—" })
  }
  if (s.response.calls > 0)
    out.push({ label: "caveman (responses)", ops: s.response.calls, saved: s.response.savedEst, pct: "~65%" })
  if (s.rtk && s.rtk.commands > 0)
    out.push({ label: "rtk (shell)", ops: s.rtk.commands, saved: s.rtk.saved, pct: `${Math.round(s.rtk.pct)}%` })
  return out.filter((r) => r.saved > 0 || r.ops > 0).sort((a, b) => b.saved - a.saved)
}

/** Grand total tokens saved across all optimizers (agent-side + caveman + rtk). */
export function grandTotal(s: Savings = read()): number {
  return rows(s).reduce((n, r) => n + r.saved, 0)
}

/** Compact one-liner for the sidebar. */
export function compactLine(s: Savings = read()): string {
  return `${fmt(grandTotal(s))} tokens saved`
}

function impactBar(frac: number, width = 10): string {
  const fill = Math.max(0, Math.min(width, Math.round(frac * width)))
  return "█".repeat(fill) + "░".repeat(width - fill)
}

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

/** Full breakdown — identical content for `bjir gain` and the in-TUI /gain dialog. */
export function detailLines(s: Savings = read()): string[] {
  const r = rows(s)
  const out: string[] = []
  out.push("BJIR Token Gain")
  out.push("═".repeat(56))
  out.push("")

  if (r.length === 0) {
    out.push("  No savings recorded yet.")
    out.push("  Run commands and reads — rtk, caveman, and the I/O refiner do the rest.")
    return out
  }

  const total = r.reduce((n, x) => n + x.saved, 0)
  const ops = r.reduce((n, x) => n + x.ops, 0)
  const max = r[0].saved || 1

  out.push(`  TOTAL SAVED   ~${fmt(total)} tokens   ·   ${fmt(ops)} ops`)
  out.push("")
  out.push(
    "  " + "Optimizer".padEnd(20) + "ops".padStart(6) + "saved".padStart(9) + "%".padStart(6) + "   impact",
  )
  out.push("  " + "─".repeat(52))
  for (const x of r) {
    out.push(
      "  " +
        trunc(x.label, 20).padEnd(20) +
        fmt(x.ops).padStart(6) +
        fmt(x.saved).padStart(9) +
        x.pct.padStart(6) +
        "   " +
        impactBar(x.saved / max),
    )
  }
  out.push("  " + "─".repeat(52))
  return out
}

/** Clear BJIR's own cumulative savings data (profiler + gateway token-log). */
export function reset(): void {
  try {
    BjirProfile.reset()
  } catch {}
  try {
    if (existsSync(LOG)) writeFileSync(LOG, "")
  } catch {}
  // rtk keeps its own cumulative stats outside ~/.bjir; clear them too so the
  // gain table's rtk row resets (rtk gain --reset --yes is non-interactive).
  try {
    const bin = rtkBin()
    if (bin && typeof Bun !== "undefined") Bun.spawnSync([bin, "gain", "--reset", "--yes"])
  } catch {}
  rtkCache = undefined
}
