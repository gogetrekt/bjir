export * as BjirSemanticRead from "./semantic-read"

import { BjirProfile } from "./profile"

/**
 * BJIR semantic reads (Phase G-2, moat #2b) — a full read of a LARGE file
 * returns a symbol outline (signatures + line numbers) instead of the whole
 * file; the agent then range-reads (offset/limit) only what it needs. Big
 * context savings on big files a gateway can never make.
 *
 * Inspirations: Aider repo-map (signatures, not bodies), ctags/LSP
 * documentSymbol (outline). This impl is a language-agnostic heuristic
 * (regex) so it works everywhere with zero deps / no LSP round-trip; an
 * LSP/tree-sitter-backed outline is a future enhancement.
 *
 * Gated by BJIR_OPTIMIZE + BJIR_SEMANTIC_READ=0; threshold BJIR_SEMANTIC_READ_LINES
 * (default 500). Small/medium files are returned in full (no outline).
 */

const MAX_SYMBOLS = 250
const SIG_CAP = 160

export function enabled(): boolean {
  if (process.env.BJIR_SEMANTIC_READ === "0" || process.env.BJIR_SEMANTIC_READ === "false") return false
  const v = process.env.BJIR_OPTIMIZE
  return v !== "0" && v !== "false"
}

export function threshold(): number {
  const n = Number(process.env.BJIR_SEMANTIC_READ_LINES)
  return Number.isFinite(n) && n > 0 ? n : 500
}

// Declaration keywords across JS/TS, Python, Go, Rust, Java/C#, Ruby, C/C++, etc.
const DECL =
  /^\s{0,12}(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:pub(?:\([^)]*\))?\s+)?(?:public\s+|private\s+|protected\s+|internal\s+|static\s+|final\s+|abstract\s+|readonly\s+|override\s+|async\s+|unsafe\s+|extern\s+|open\s+|sealed\s+)*(function|func|fn|def|class|struct|interface|type|enum|trait|impl|module|mod|namespace|object|record|protocol|extension)\b/
// Exported top-level bindings (e.g. TS `export const X =`).
const EXPORTED_BINDING = /^\s{0,4}export\s+(?:default\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*/
// Definition-shaped line that OPENS a block: `... name(args) {`  (ends with `{` -> excludes calls).
const BLOCK_DEF = /^\s{1,8}(?:[\w<>\[\],\s*&~]+\s+)?[A-Za-z_$][\w$]*\s*\([^;]*\)\s*(?::[^{;]+)?\{\s*$/

function isSymbolLine(line: string): boolean {
  if (line.length > 400) return false // skip giant minified/data lines
  return DECL.test(line) || EXPORTED_BINDING.test(line) || BLOCK_DEF.test(line)
}

/** Returns an outline string for a large file, or null to read it in full. */
export function outline(filePath: string, content: string): string | null {
  if (!enabled() || !content) return null
  const lines = content.split("\n")
  if (lines.length <= threshold()) return null

  const symbols: string[] = []
  let truncated = false
  for (let i = 0; i < lines.length; i++) {
    if (!isSymbolLine(lines[i]!)) continue
    if (symbols.length >= MAX_SYMBOLS) {
      truncated = true
      break
    }
    const sig = lines[i]!.replace(/\s+$/, "").replace(/\s*\{?\s*$/, "")
    symbols.push(`  L${i + 1}  ${sig.length > SIG_CAP ? sig.slice(0, SIG_CAP) + " …" : sig}`)
  }

  // No symbols found (data/text file) -> let it read normally rather than hide it.
  if (symbols.length === 0) return null

  const result = [
    `[BJIR semantic read] ${filePath} — ${lines.length} lines. Showing a symbol outline to save tokens.`,
    `Read a line range with offset/limit to see code (e.g. the lines below), or set BJIR_SEMANTIC_READ=0 for full content.`,
    "",
    ...symbols,
    ...(truncated ? ["", `  … [outline truncated at ${MAX_SYMBOLS} symbols]`] : []),
  ].join("\n")
  BjirProfile.record("semantic-read", content.length - result.length)
  return result
}
