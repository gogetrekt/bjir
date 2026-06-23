export * as BjirContext from "./context-prune"

import { BjirProfile } from "./profile"

/**
 * BJIR context pruning (Phase H, moat #3) — in a long session the outgoing
 * message history accumulates many big tool outputs (file reads, bash, grep…),
 * re-sent every turn. We keep the last K tool results in full and elide the
 * TEXT of older large ones to a stub — preserving toolCallId/toolName/output.type
 * so provider tool-call↔result pairing stays intact. A gateway can't do this
 * (it never sees the agent's history assembly).
 *
 * Inspirations: opencode/Claude Code compaction, Aider's "drop old context".
 * Conservative: only elides text/content-text outputs over a threshold; leaves
 * json/structured outputs and the recent turns untouched. Gated by BJIR_OPTIMIZE
 * + BJIR_CONTEXT_PRUNE=0; tunables BJIR_CONTEXT_KEEP / BJIR_CONTEXT_THRESHOLD.
 */

export function enabled(): boolean {
  if (process.env.BJIR_CONTEXT_PRUNE === "0" || process.env.BJIR_CONTEXT_PRUNE === "false") return false
  const v = process.env.BJIR_OPTIMIZE
  return v !== "0" && v !== "false"
}

function keepRecent(): number {
  const n = Number(process.env.BJIR_CONTEXT_KEEP)
  return Number.isFinite(n) && n >= 0 ? n : 3
}
function threshold(): number {
  const n = Number(process.env.BJIR_CONTEXT_THRESHOLD)
  return Number.isFinite(n) && n > 0 ? n : 600
}

const stub = (tool: string, n: number) =>
  `[BJIR: earlier ${tool || "tool"} output elided (${n} chars) to save context — re-read the file/command if you still need it]`

/**
 * Returns history with old, large tool-result text elided. Generic over the
 * message type so callers keep their `ModelMessage[]` typing; treated as plain
 * data internally. Never throws — on any doubt returns the input unchanged.
 */
export function prune<T>(messages: readonly T[]): T[] {
  const input = messages as readonly any[]
  if (!enabled() || !Array.isArray(input)) return messages as T[]
  try {
    const hasResult = (m: any) => Array.isArray(m?.content) && m.content.some((p: any) => p?.type === "tool-result")
    const toolIdx = input.map((m, i) => (hasResult(m) ? i : -1)).filter((i) => i >= 0)
    const keep = keepRecent()
    if (toolIdx.length <= keep) return messages as T[]
    const elideBefore = toolIdx[toolIdx.length - keep] // index of the first message we keep in full
    const TH = threshold()
    let saved = 0

    const out = input.map((m, i) => {
      if (i >= elideBefore || !hasResult(m)) return m
      const content = m.content.map((p: any) => {
        if (p?.type !== "tool-result" || !p.output) return p
        const o = p.output
        if (o.type === "text" && typeof o.value === "string" && o.value.length > TH) {
          saved += o.value.length
          return { ...p, output: { type: "text", value: stub(p.toolName, o.value.length) } }
        }
        if (o.type === "content" && Array.isArray(o.value)) {
          let changed = false
          const value = o.value.map((part: any) => {
            if (part?.type === "text" && typeof part.text === "string" && part.text.length > TH) {
              saved += part.text.length
              changed = true
              return { ...part, text: stub(p.toolName, part.text.length) }
            }
            return part
          })
          return changed ? { ...p, output: { ...o, value } } : p
        }
        return p
      })
      return { ...m, content }
    })

    if (saved > 0) BjirProfile.record("context-prune", saved)
    return out as T[]
  } catch {
    return messages as T[]
  }
}
