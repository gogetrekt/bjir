export * as BjirCCR from "./ccr"

// Ported from chopratejas/headroom (Apache 2.0) — https://github.com/chopratejas/headroom
// Native TypeScript reimplementation of CCR (Compress-Cache-Retrieve). No
// headroom code or dependency is bundled.

import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

/**
 * CCR (compress moat, J4) — make compression REVERSIBLE. When a compressor
 * shortens a tool output, stash the original under ~/.bjir/ccr/<hash> and append
 * a retrieval hint; the LLM can call the `bjir_retrieve` tool with the id to get
 * the full, untruncated original on demand. Cache is keyed by content hash, so
 * re-compressing the same output is idempotent. Everything is best-effort and
 * never throws.
 *
 * Gated by BJIR_OPTIMIZE + BJIR_CCR (set BJIR_CCR=0 to disable reversibility).
 */

const DIR = path.join(homedir(), ".bjir", "ccr")

export function enabled(): boolean {
  if (process.env.BJIR_CCR === "0" || process.env.BJIR_CCR === "false") return false
  const v = process.env.BJIR_OPTIMIZE
  return v !== "0" && v !== "false"
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16)
}

/** Store original content; returns its retrieval id, or undefined on failure. */
export function stash(content: string): string | undefined {
  try {
    const id = hash(content)
    const file = path.join(DIR, id)
    if (!existsSync(file)) {
      mkdirSync(DIR, { recursive: true })
      writeFileSync(file, content)
    }
    return id
  } catch {
    return undefined
  }
}

/** Read back stashed content by id (hex only — no path traversal). */
export function retrieve(id: string): string | undefined {
  try {
    const safe = (id ?? "").trim().match(/^[0-9a-f]{6,64}$/i)?.[0]
    if (!safe) return undefined
    const file = path.join(DIR, safe)
    return existsSync(file) ? readFileSync(file, "utf8") : undefined
  } catch {
    return undefined
  }
}

/**
 * Append a retrieval hint to `compressed`, stashing `original` first. Returns
 * `compressed` unchanged if CCR is off or stashing fails. Caller should only
 * pass outputs that were actually shortened.
 */
export function attach(original: string, compressed: string): string {
  if (!enabled()) return compressed
  const id = stash(original)
  if (!id) return compressed
  return `${compressed}\n[bjir_retrieve id="${id}" — call the bjir_retrieve tool with this id for the full untruncated output (${original.length} chars)]`
}
