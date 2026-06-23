export * as BjirSmartCrusher from "./smart-crusher"

// Ported from chopratejas/headroom (Apache 2.0) — https://github.com/chopratejas/headroom
// Native TypeScript reimplementation of SmartCrusher's behavior (headroom's core
// is Rust; this mirrors its documented config + semantics). No headroom code or
// dependency is bundled.

import { BjirProfile } from "../profile"

/**
 * SmartCrusher (compress moat, J2) — statistical compression for JSON arrays.
 *   - keep the first ~30% (schema / structure)
 *   - keep the last ~15% (recency), bounded so representatives stay ~15 total
 *   - keep ALL anomalies (errors/warnings/exceptions/non-zero exit/`ok:false`…)
 *   - collapse omitted middle runs into a sentinel that says exactly what was
 *     dropped and the pass/fail/other totals — NEVER silent.
 * Also handles a JSON object by crushing its largest array-valued property
 * in place (covers `{results:[…]}` / `{items:[…]}` tool shapes).
 *
 * Conservative gates (headroom defaults): >= 5 items, >= ~200 tokens, and the
 * result must actually be smaller — otherwise the original is returned.
 */

const FIRST_FRACTION = 0.3
const LAST_FRACTION = 0.15
const MAX_REPRESENTATIVES = 15
const MIN_ITEMS = 5
const MIN_TOKENS = 200 // ~800 chars

const ANOMALY_RE =
  /\b(errors?|err|fail(?:ed|ure)?|exception|traceback|panic|fatal|warn(?:ing)?|denied|timed?\s?out|refused|unhandled|reject(?:ed)?|crash(?:ed)?|abort(?:ed)?)\b/i
const PASS_RE = /\b(pass(?:ed)?|ok|success(?:ful)?|succeeded|done|healthy)\b/i

function isAnomaly(item: unknown): boolean {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = item as Record<string, unknown>
    for (const k of ["exitCode", "exit_code", "code", "status", "statusCode"]) {
      const v = o[k]
      if (typeof v === "number" && v !== 0 && v !== 200) return true
    }
    for (const k of ["ok", "success", "passed", "pass", "healthy"]) if (o[k] === false) return true
    const level = o["level"] ?? o["severity"]
    if (typeof level === "string" && /error|warn|fatal|critical/i.test(level)) return true
  }
  const s = typeof item === "string" ? item : safeStringify(item)
  return ANOMALY_RE.test(s)
}

function classify(item: unknown): "fail" | "pass" | "other" {
  if (isAnomaly(item)) return "fail"
  return PASS_RE.test(typeof item === "string" ? item : safeStringify(item)) ? "pass" : "other"
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? ""
  } catch {
    return ""
  }
}

/** Crush a JSON array. Returns the new array (with sentinels) or null if not worth it. */
function crushArray(arr: unknown[]): unknown[] | null {
  const n = arr.length
  if (n < MIN_ITEMS) return null

  let first = Math.max(1, Math.round(n * FIRST_FRACTION))
  let last = Math.max(1, Math.round(n * LAST_FRACTION))
  if (first + last > MAX_REPRESENTATIVES) {
    first = Math.round(MAX_REPRESENTATIVES * (FIRST_FRACTION / (FIRST_FRACTION + LAST_FRACTION)))
    last = MAX_REPRESENTATIVES - first
  }
  if (first + last >= n) return null // nothing to omit

  const keep = new Set<number>()
  for (let i = 0; i < n; i++) {
    if (i < first || i >= n - last || isAnomaly(arr[i])) keep.add(i)
  }
  const omittedCount = n - keep.size
  if (omittedCount < 2) return null

  // Global totals (across the whole array) for an honest summary.
  let pass = 0,
    fail = 0,
    other = 0,
    anomalies = 0
  for (const item of arr) {
    const c = classify(item)
    if (c === "pass") pass++
    else if (c === "fail") fail++
    else other++
    if (isAnomaly(item)) anomalies++
  }
  const summary =
    `${omittedCount} of ${n} items omitted to save tokens — kept first ${first}, last ${last}, ` +
    `and all ${anomalies} anomalies. Totals: ${pass} passed, ${fail} failed/error, ${other} other. ` +
    `Re-read the file/command for the full array.`

  // Walk in order, collapsing consecutive omitted runs into one sentinel.
  const out: unknown[] = []
  let run = 0
  const flush = () => {
    if (run > 0) {
      out.push({ _bjir_omitted: run, note: summary })
      run = 0
    }
  }
  for (let i = 0; i < n; i++) {
    if (keep.has(i)) {
      flush()
      out.push(arr[i])
    } else run++
  }
  flush()
  return out
}

/** Find the largest array-valued property of an object (by length). */
function largestArrayKey(obj: Record<string, unknown>): string | undefined {
  let best: string | undefined
  let bestLen = -1
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length > bestLen) {
      best = k
      bestLen = v.length
    }
  }
  return bestLen >= MIN_ITEMS ? best : undefined
}

/**
 * Crush a JSON (array or object) string. Returns compressed JSON text, or the
 * original if it can't help. Records `smart-crush` savings. Never throws.
 */
export function crush(text: string): string {
  try {
    if (!text || text.length < MIN_TOKENS * 4) return text
    const parsed = JSON.parse(text)

    let result: unknown
    if (Array.isArray(parsed)) {
      const crushed = crushArray(parsed)
      if (!crushed) return text
      result = crushed
    } else if (parsed && typeof parsed === "object") {
      const key = largestArrayKey(parsed as Record<string, unknown>)
      if (!key) return text
      const crushed = crushArray((parsed as Record<string, unknown>)[key] as unknown[])
      if (!crushed) return text
      result = { ...(parsed as Record<string, unknown>), [key]: crushed }
    } else {
      return text
    }

    const out = JSON.stringify(result, null, 2)
    if (out.length >= text.length) return text // no win
    BjirProfile.record("smart-crush", text.length - out.length)
    return out
  } catch {
    return text
  }
}
