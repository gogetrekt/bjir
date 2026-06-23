/** Google Gemini provider: translate OpenAI Chat Completions ⇄ Gemini
 * generateContent. Request: OpenAI → Gemini. Response: Gemini SSE (alt=sse) →
 * OpenAI chunks (text + functionCall + synthesized usage).
 *
 * NOTE: validated by typecheck + format review; not yet live-tested (no Google
 * key available in dev). MiMo can't exercise this path (not Gemini-format). */
import type { ChatRequest, Provider } from "../types"
import { asParts, contentText, parseDataUrl, type OpenAIContent } from "../content"
import { openAIChunk, sseChunk, sseDone, sseEvents, usageChunk, type ChunkParts } from "../sse"

const env = (k: string) => process.env[k]

const FINISH: Record<string, string> = {
  STOP: "stop",
  MAX_TOKENS: "length",
  SAFETY: "content_filter",
  RECITATION: "stop",
}

const safeJson = (s: string) => {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

/** Lower an OpenAI content value to Gemini parts. Text → {text}; image_url with a
 * base64 data URL → {inlineData}. (Gemini inline can't fetch remote URLs, so only
 * data URLs — which is what opencode's TUI sends — become images.) */
function geminiParts(content: OpenAIContent): unknown[] {
  const parts: unknown[] = []
  for (const part of asParts(content)) {
    if (part.type === "text") {
      parts.push({ text: (part as { text: string }).text })
    } else if (part.type === "image_url") {
      const data = parseDataUrl((part as { image_url: { url: string } }).image_url.url)
      if (data) parts.push({ inlineData: { mimeType: data.mediaType, data: data.data } })
    }
  }
  return parts.length ? parts : [{ text: "" }]
}

function toGeminiRequest(req: ChatRequest) {
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => contentText(m.content))
    .join("\n\n")

  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user",
          parts: [{ functionResponse: { name: m.name ?? "tool", response: { content: contentText(m.content) } } }],
        }
      }
      if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
        const parts: unknown[] = []
        const text = contentText(m.content)
        if (text) parts.push({ text })
        for (const tc of m.tool_calls as Array<{ function: { name: string; arguments: string } }>) {
          parts.push({ functionCall: { name: tc.function.name, args: safeJson(tc.function.arguments) ?? {} } })
        }
        return { role: "model", parts }
      }
      return { role: m.role === "assistant" ? "model" : "user", parts: geminiParts(m.content) }
    })

  const tools = Array.isArray(req.tools)
    ? [
        {
          functionDeclarations: (req.tools as Array<{ function: { name: string; description?: string; parameters?: unknown } }>).map(
            (t) => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters }),
          ),
        },
      ]
    : undefined

  return {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    tools,
    generationConfig: { maxOutputTokens: req.max_tokens, temperature: req.temperature },
  }
}

export const gemini: Provider = {
  name: "gemini",
  available: () => !!env("GOOGLE_API_KEY"),
  async stream(req: ChatRequest, signal?: AbortSignal): Promise<Response> {
    const base = (env("GOOGLE_BASE_URL") ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "")
    const model = req.model.replace(/^gemini\//, "")
    const url = `${base}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env("GOOGLE_API_KEY")}`
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toGeminiRequest(req)),
      signal,
    })

    if (!upstream.ok || !upstream.body) {
      return new Response(upstream.body ?? JSON.stringify({ error: { message: "gemini: empty body" } }), {
        status: upstream.ok ? 502 : upstream.status,
        headers: { "content-type": "application/json" },
      })
    }

    const parts: ChunkParts = { id: `chatcmpl-${Math.abs(Date.now()).toString(36)}`, model: req.model, created: Math.floor(Date.now() / 1000) }
    const wantUsage = !!req.stream_options?.include_usage
    const body = upstream.body

    const out = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const usage = { inputTokens: 0, outputTokens: 0 }
        let toolIndex = -1
        let finish: string | null = null
        let roleSent = false
        try {
          for await (const data of sseEvents(body)) {
            if (!data || data === "[DONE]") continue
            const ev = safeJson(data) as any
            if (!ev) continue
            if (ev.usageMetadata) {
              usage.inputTokens = ev.usageMetadata.promptTokenCount ?? usage.inputTokens
              usage.outputTokens = ev.usageMetadata.candidatesTokenCount ?? usage.outputTokens
            }
            const cand = ev.candidates?.[0]
            if (!cand) continue
            if (!roleSent) {
              ctrl.enqueue(sseChunk(openAIChunk(parts, { role: "assistant" })))
              roleSent = true
            }
            for (const part of cand.content?.parts ?? []) {
              if (typeof part.text === "string") {
                ctrl.enqueue(sseChunk(openAIChunk(parts, { content: part.text })))
              } else if (part.functionCall) {
                toolIndex++
                ctrl.enqueue(
                  sseChunk(
                    openAIChunk(parts, {
                      tool_calls: [
                        {
                          index: toolIndex,
                          id: `call_${toolIndex}_${parts.id}`,
                          type: "function",
                          function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) },
                        },
                      ],
                    }),
                  ),
                )
              }
            }
            if (cand.finishReason) finish = FINISH[cand.finishReason] ?? "stop"
          }
        } catch {
          finish = finish ?? "stop"
        }
        ctrl.enqueue(sseChunk(openAIChunk(parts, {}, finish ?? "stop")))
        if (wantUsage) ctrl.enqueue(sseChunk(usageChunk(parts, usage)))
        ctrl.enqueue(sseDone())
        ctrl.close()
      },
    })

    return new Response(out, { status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } })
  },
}
