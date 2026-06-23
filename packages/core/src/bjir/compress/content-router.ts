export * as BjirContentRouter from "./content-router"

// Ported from chopratejas/headroom (Apache 2.0) — https://github.com/chopratejas/headroom
// Behavior reimplemented natively in TypeScript (headroom's detector is Rust +
// a Python regex fallback; this mirrors the fallback heuristics). No headroom
// code or dependency is bundled.

/**
 * ContentRouter (compress moat, J1) — classify a tool-output string so the
 * compress() entry can route it to the right specialized compressor. This is
 * the routing brain everything else hangs off of. Detection is cheap, ordered
 * most-specific-first, and never throws (defaults to "plain").
 */

export type ContentType =
  | "json-array"
  | "json-object"
  | "diff"
  | "search-results"
  | "build-log"
  | "code"
  | "html"
  | "tabular"
  | "plain"

const DIFF_HUNK = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m
const DIFF_GIT = /^diff --git /m
const SEARCH_LINE = /^[^\s:]+:\d+:/ // path:line:  (grep -n / ripgrep)
const HTML = /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]|<\/(?:div|span|body|head|table|html)>/i
const CODE_FENCE = /^```/m
const TABLE_ROW = /^\s*\|.*\|\s*$/
const LOG_LEVEL = /(?:^|\s)(?:ERROR|ERR!|WARN(?:ING)?|FATAL|FAIL(?:ED)?|Exception|Traceback|panic:)\b/
const TIMESTAMP = /^(?:\[)?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}|^\[\d+\.\d+\]|^\d{2}:\d{2}:\d{2}\b/
// Max bytes we'll attempt JSON.parse on (avoid pathological cost on huge blobs).
const JSON_PARSE_CAP = 2 * 1024 * 1024

function tryJson(text: string): unknown {
  if (text.length > JSON_PARSE_CAP) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function fractionMatching(lines: string[], re: RegExp): number {
  const nonEmpty = lines.filter((l) => l.trim().length > 0)
  if (nonEmpty.length === 0) return 0
  let hit = 0
  for (const l of nonEmpty) if (re.test(l)) hit++
  return hit / nonEmpty.length
}

export function detect(text: string): ContentType {
  try {
    if (!text) return "plain"
    const trimmed = text.trimStart()
    if (!trimmed) return "plain"

    // 1. Unified diff (very specific markers).
    if (DIFF_HUNK.test(text) || DIFF_GIT.test(text)) return "diff"

    // 2. JSON — only when it actually parses (cheap-capped), array vs object.
    const head = trimmed[0]
    if (head === "[" || head === "{") {
      const parsed = tryJson(trimmed)
      if (parsed !== undefined) return Array.isArray(parsed) ? "json-array" : "json-object"
    }

    const lines = text.split("\n")

    // 3. Search results (grep/ripgrep): majority of lines are `path:line:`.
    if (lines.length >= 3 && fractionMatching(lines, SEARCH_LINE) >= 0.6) return "search-results"

    // 4. HTML.
    if (HTML.test(text)) return "html"

    // 5. Fenced code.
    if (CODE_FENCE.test(text)) return "code"

    // 6. Tabular (markdown table / pipe-delimited): several aligned `| … |` rows.
    if (lines.filter((l) => TABLE_ROW.test(l)).length >= 3) return "tabular"

    // 7. Build / shell log: log levels or timestamped lines anywhere.
    if (LOG_LEVEL.test(text) || fractionMatching(lines, TIMESTAMP) >= 0.3) return "build-log"

    return "plain"
  } catch {
    return "plain"
  }
}
