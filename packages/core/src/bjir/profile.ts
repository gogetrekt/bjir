export * as BjirProfile from "./profile"

/**
 * BJIR token profiler (Phase I, moat #4) — records what each agent-side optimizer
 * saved, so `bjir gain` can show a real "where did my tokens go / what saved them"
 * breakdown. Adapts 9router's quota/usage tracking to the agent side.
 *
 * Each optimizer (io-refine, read-dedup, semantic-read, prompt-refine) calls
 * record() with chars saved; summary() aggregates per kind. Best-effort, never
 * throws; append-only NDJSON at ~/.bjir/savings.ndjson.
 */
import { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

const DIR = path.join(homedir(), ".bjir")
const LOG = path.join(DIR, "savings.ndjson")

export function record(kind: string, savedChars: number): void {
  if (!Number.isFinite(savedChars) || savedChars <= 0) return
  try {
    mkdirSync(DIR, { recursive: true })
    appendFileSync(LOG, JSON.stringify({ ts: Date.now(), kind, saved: Math.round(savedChars) }) + "\n")
  } catch {
    // savings logging is best-effort
  }
}

export interface KindStat {
  events: number
  savedChars: number
}

export function summary(): Record<string, KindStat> {
  const out: Record<string, KindStat> = {}
  try {
    if (!existsSync(LOG)) return out
    for (const line of readFileSync(LOG, "utf8").split("\n")) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line)
        const k = typeof e.kind === "string" ? e.kind : "?"
        const s = (out[k] ??= { events: 0, savedChars: 0 })
        s.events++
        s.savedChars += e.saved ?? 0
      } catch {
        // skip bad line
      }
    }
  } catch {
    // ignore
  }
  return out
}

export function reset(): void {
  try {
    writeFileSync(LOG, "")
  } catch {
    // ignore
  }
}
