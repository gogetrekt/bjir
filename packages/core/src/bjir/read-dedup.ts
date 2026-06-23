export * as BjirReadDedup from "./read-dedup"

import { BjirProfile } from "./profile"

/**
 * BJIR read-dedup (Phase G, moat #2) — agents re-read the same files every turn;
 * the content is already in history. On a re-read of an UNCHANGED file we return
 * a compact stub instead of the full content → big multi-turn context savings.
 *
 * Inspirations: caveman-code (re-reads → stubs), Claude Code/Cline (read-before-edit
 * version tracking). Change detection is a per-session content hash, so an edit
 * (hash changes) auto-invalidates — no explicit invalidation needed. "Stub-once"
 * per unchanged-streak: if the agent insists (reads again) it gets real content,
 * so it can never be denied or loop. Gated by BJIR_OPTIMIZE + BJIR_READ_DEDUP=0.
 *
 * (Semantic/symbol reads — Aider-style repo map via LSP `documentSymbol` /
 * tree-sitter — are Phase G-2; see PLAN §4.)
 */

export function enabled(): boolean {
  if (process.env.BJIR_READ_DEDUP === "0" || process.env.BJIR_READ_DEDUP === "false") return false
  const v = process.env.BJIR_OPTIMIZE
  return v !== "0" && v !== "false"
}

// sessionID -> filePath -> { hash, stubbed }
const ledger = new Map<string, Map<string, { hash: number; stubbed: boolean }>>()

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h
}

/**
 * Returns a stub string to substitute for the file content, or null to send the
 * real content. Records the (session, path) → hash for change detection.
 */
export function dedupe(sessionID: string, filePath: string, content: string): string | null {
  if (!enabled() || !content) return null
  const cur = hash(content)
  let bySess = ledger.get(sessionID)
  if (!bySess) {
    bySess = new Map()
    ledger.set(sessionID, bySess)
  }
  const prev = bySess.get(filePath)
  if (prev && prev.hash === cur) {
    if (!prev.stubbed) {
      prev.stubbed = true // first re-read of an unchanged file -> stub once
      const lines = content.split("\n").length
      const stub = `[BJIR read-dedup] ${filePath} is unchanged since you read it earlier this session (${lines} lines, ${content.length} chars). Content omitted — you already have it above. Re-read with offset/limit, or edit the file, to get fresh content.`
      BjirProfile.record("read-dedup", content.length - stub.length)
      return stub
    }
    return null // already stubbed once this streak -> give real content, no loop
  }
  bySess.set(filePath, { hash: cur, stubbed: false }) // first read or content changed
  return null
}

/** Test/maintenance helper. */
export function reset(sessionID?: string): void {
  if (sessionID) ledger.delete(sessionID)
  else ledger.clear()
}
