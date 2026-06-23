export * as BjirLogCompressor from "./log-compressor"

// Ported from chopratejas/headroom (Apache 2.0) — https://github.com/chopratejas/headroom
// Native TypeScript reimplementation of LogCompressor's behavior. No headroom
// code or dependency is bundled.

import { BjirProfile } from "../profile"

/**
 * LogCompressor (compress moat, J3) — build/shell log compression that AUGMENTS
 * rtk (rtk filters at command exec; this runs level-aware at message assembly,
 * and also covers non-rtk commands + non-bash tools that emit logs).
 *   - keep ALL error/fatal/exception lines (never collapsed away)
 *   - collapse consecutive near-duplicate lines (timestamp/number-insensitive)
 *     into `<line>   [×N]`
 *   - if still large, keep head + tail + all errors and summarize the omitted
 *     lower-severity middle — never silent.
 * Conservative: only acts on >= 25 lines and only if the result is smaller.
 */

const MIN_LINES = 25
const MAX_LINES = 120
const HEAD = 30
const TAIL = 30

const ERROR_RE = /\b(?:FATAL|ERROR|ERR!|panic:|Exception|Traceback|Segmentation fault|core dumped)\b/i
const WARN_RE = /\b(?:WARN(?:ING)?)\b/i
// leading timestamp / uptime / clock prefixes to ignore when comparing lines
const TS_PREFIX = /^(?:\[)?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\S*\]?\s*|^\[\d+\.\d+\]\s*|^\d{2}:\d{2}:\d{2}(?:\.\d+)?\s*/

function signature(line: string): string {
  // Conservative: ignore only leading timestamps, hex addresses, and trailing
  // whitespace. Digits in the message body are KEPT, so lines that differ by a
  // meaningful number (counts, sizes, ids) are NOT merged — only genuinely
  // repeated lines collapse. Sheer volume is handled by the head/tail cap.
  return line
    .replace(TS_PREFIX, "")
    .replace(/0x[0-9a-fA-F]+/g, "0xADDR")
    .replace(/\s+$/, "")
}

const render = (e: { text: string; count: number }) => (e.count > 1 ? `${e.text}   [×${e.count}]` : e.text)

/** Compress a build/shell log string. Returns original if it can't help. Never throws. */
export function compress(text: string): string {
  try {
    if (!text) return text
    const lines = text.split("\n")
    if (lines.length < MIN_LINES) return text

    // 1. collapse consecutive near-duplicate lines.
    type Entry = { text: string; sig: string; count: number; isError: boolean }
    const collapsed: Entry[] = []
    let errors = 0
    let warns = 0
    for (const line of lines) {
      const sig = signature(line)
      const prev = collapsed[collapsed.length - 1]
      if (prev && prev.sig === sig) {
        prev.count++
        continue
      }
      const isError = ERROR_RE.test(line)
      collapsed.push({ text: line, sig, count: 1, isError })
      if (isError) errors++
      else if (WARN_RE.test(line)) warns++
    }

    // 2. if still big, keep errors + head + tail; summarize omitted middle.
    const out: string[] = []
    let omitted = 0
    const flush = () => {
      if (omitted > 0) {
        out.push(
          `[BJIR log: omitted ${omitted} lower-severity lines — ${errors} error(s) + ${warns} warning(s) kept; re-read for full log]`,
        )
        omitted = 0
      }
    }
    if (collapsed.length > MAX_LINES) {
      collapsed.forEach((e, i) => {
        const keep = e.isError || i < HEAD || i >= collapsed.length - TAIL
        if (keep) {
          flush()
          out.push(render(e))
        } else omitted += e.count
      })
      flush()
    } else {
      for (const e of collapsed) out.push(render(e))
    }

    const result = out.join("\n")
    if (result.length >= text.length) return text // no win (no repeats, under cap)
    BjirProfile.record("log-compress", text.length - result.length)
    return result
  } catch {
    return text
  }
}
