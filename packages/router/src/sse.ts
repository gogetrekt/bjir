/** Minimal SSE helpers for translating provider streams into OpenAI
 * chat.completion.chunk events. */
import type { Usage } from "./types"

const enc = new TextEncoder()

export const sseChunk = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`)
export const sseDone = () => enc.encode("data: [DONE]\n\n")

export interface ChunkParts {
  id: string
  model: string
  created: number
}

/** Build an OpenAI chat.completion.chunk with a single choice delta. */
export function openAIChunk(parts: ChunkParts, delta: object, finish_reason: string | null = null) {
  return {
    id: parts.id,
    object: "chat.completion.chunk",
    created: parts.created,
    model: parts.model,
    choices: [{ index: 0, delta, finish_reason }],
  }
}

/** Final usage-only chunk (sent when the client asked for include_usage). */
export function usageChunk(parts: ChunkParts, usage: Usage) {
  return {
    id: parts.id,
    object: "chat.completion.chunk",
    created: parts.created,
    model: parts.model,
    choices: [],
    usage: {
      prompt_tokens: usage.inputTokens,
      completion_tokens: usage.outputTokens,
      total_tokens: usage.inputTokens + usage.outputTokens,
    },
  }
}

/** Iterate complete SSE `data:` payloads from a byte stream, buffering partials.
 * Yields the raw string after `data: ` for each event (skips comments/empties). */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    // SSE events are separated by a blank line; lines start with "data:".
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).replace(/\r$/, "")
      buf = buf.slice(nl + 1)
      if (line.startsWith("data:")) yield line.slice(5).trimStart()
    }
  }
  if (buf.startsWith("data:")) yield buf.slice(5).trimStart()
}
