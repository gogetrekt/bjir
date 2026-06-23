export * as BjirRead from "./read.bjir"

/**
 * BJIR read-side moat, opencode-side glue (Phase G-3). The agent's real read
 * tool lives here in the opencode package (NOT core/tool/read.ts), so the
 * read optimizations must be wired into THIS tool — see read.ts.
 *
 * G-3 adds an EXACT symbol outline built from the language server's
 * `textDocument/documentSymbol` (precise names, kinds, line numbers, nesting),
 * preferred over the zero-dep regex outline (G-2, `BjirSemanticRead.outline`)
 * which remains the fallback when no LSP client/symbols are available.
 *
 * This module is pure (no Effect): read.ts performs the LSP call and hands the
 * raw symbols here for formatting, so the formatter stays trivially testable.
 */

// LSP SymbolKind (1-based) -> short label. Mirrors lsp/lsp.ts SymbolKind enum.
const KIND: Record<number, string> = {
  1: "file", 2: "module", 3: "namespace", 4: "package", 5: "class", 6: "method",
  7: "property", 8: "field", 9: "ctor", 10: "enum", 11: "interface", 12: "fn",
  13: "var", 14: "const", 15: "string", 16: "number", 17: "bool", 18: "array",
  19: "object", 20: "key", 21: "null", 22: "enum-member", 23: "struct",
  24: "event", 25: "operator", 26: "type-param",
}

const MAX_SYMBOLS = 400

/** A LSP DocumentSymbol (hierarchical) or SymbolInformation (flat). */
type AnySymbol = {
  name?: unknown
  kind?: unknown
  detail?: unknown
  range?: { start?: { line?: number } }
  selectionRange?: { start?: { line?: number } }
  location?: { range?: { start?: { line?: number } } }
  children?: unknown
}

/**
 * Format an exact outline from LSP documentSymbol results. Returns null when
 * there are no usable symbols (caller then falls back to the regex outline).
 * Preserves document/DFS order and nesting; never throws.
 */
export function lspOutline(filePath: string, symbols: unknown, totalLines: number): string | null {
  try {
    if (!Array.isArray(symbols) || symbols.length === 0) return null
    const rows: string[] = []
    let count = 0
    let truncated = false

    const visit = (s: AnySymbol, depth: number): void => {
      if (count >= MAX_SYMBOLS) {
        truncated = true
        return
      }
      if (!s || typeof s.name !== "string" || !s.name) return
      const r = s.selectionRange ?? s.range ?? s.location?.range
      const line = (r?.start?.line ?? 0) + 1
      const kind = (typeof s.kind === "number" && KIND[s.kind]) || "sym"
      const indent = "  ".repeat(Math.min(depth, 6))
      const detail = typeof s.detail === "string" && s.detail ? ` ${s.detail.slice(0, 80)}` : ""
      rows.push(`  L${line}  ${indent}${kind} ${s.name}${detail}`)
      count++
      if (Array.isArray(s.children)) for (const c of s.children) visit(c as AnySymbol, depth + 1)
    }

    for (const s of symbols as AnySymbol[]) visit(s, 0)
    if (rows.length === 0) return null

    return [
      `[BJIR semantic read · LSP] ${filePath} — ${totalLines} lines, ${rows.length} symbols. Exact outline (documentSymbol). Range-read with offset/limit to see code; set BJIR_SEMANTIC_READ=0 for full content.`,
      "",
      ...rows,
      ...(truncated ? ["", `  … [outline truncated at ${MAX_SYMBOLS} symbols]`] : []),
    ].join("\n")
  } catch {
    return null
  }
}
