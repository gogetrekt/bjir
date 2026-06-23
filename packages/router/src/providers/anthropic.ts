/** Anthropic Messages provider: translate OpenAI Chat Completions ⇄ Anthropic.
 * Request: OpenAI → Anthropic Messages. Response: Anthropic SSE → OpenAI chunks
 * (text + tool_use + a synthesized usage chunk for include_usage). */
import type { ChatMessage, ChatRequest, Provider } from "../types"
import { asParts, contentText, parseDataUrl, type OpenAIContent } from "../content"
import { openAIChunk, sseChunk, sseDone, sseEvents, usageChunk, type ChunkParts } from "../sse"

const env = (k: string) => process.env[k]

const FINISH: Record<string, string> = {
  end_turn: "stop",
  stop_sequence: "stop",
  max_tokens: "length",
  tool_use: "tool_calls",
}

/** Lower an OpenAI content value to Anthropic content blocks. Text → text block;
 * image_url → image block (base64 data URL → base64 source, else url source). */
function anthropicBlocks(content: OpenAIContent): unknown[] {
  const blocks: unknown[] = []
  for (const part of asParts(content)) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: (part as { text: string }).text })
    } else if (part.type === "image_url") {
      const url = (part as { image_url: { url: string } }).image_url.url
      const data = parseDataUrl(url)
      blocks.push(
        data
          ? { type: "image", source: { type: "base64", media_type: data.mediaType, data: data.data } }
          : { type: "image", source: { type: "url", url } },
      )
    }
  }
  return blocks.length ? blocks : [{ type: "text", text: "" }]
}

function toAnthropicRequest(req: ChatRequest, model: string) {
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => contentText(m.content))
    .join("\n\n")

  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m: ChatMessage) => {
      if (m.role === "tool") {
        return {
          role: "user" as const,
          content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: contentText(m.content) }],
        }
      }
      if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
        const blocks: unknown[] = []
        const text = contentText(m.content)
        if (text) blocks.push({ type: "text", text })
        for (const tc of m.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: safeJson(tc.function.arguments),
          })
        }
        return { role: "assistant" as const, content: blocks }
      }
      return { role: m.role as "user" | "assistant", content: anthropicBlocks(m.content) }
    })

  const tools = Array.isArray(req.tools)
    ? (req.tools as Array<{ function: { name: string; description?: string; parameters?: unknown } }>).map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters ?? { type: "object" },
      }))
    : undefined

  return {
    model,
    max_tokens: req.max_tokens ?? 4096,
    system: system || undefined,
    messages,
    tools,
    temperature: req.temperature,
    stream: true,
  }
}

const safeJson = (s: string) => {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

export const anthropic: Provider = {
  name: "anthropic",
  available: () => !!env("ANTHROPIC_API_KEY") || !!env("ANTHROPIC_BASE_URL"),
  async stream(req: ChatRequest, signal?: AbortSignal): Promise<Response> {
    const base = (env("ANTHROPIC_BASE_URL") ?? "https://api.anthropic.com").replace(/\/$/, "")
    const key = env("ANTHROPIC_API_KEY") ?? ""
    const upstream = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        authorization: `Bearer ${key}`, // some Anthropic-compatible gateways (e.g. MiMo) accept bearer
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(toAnthropicRequest(req, req.model)),
      signal,
    })

    if (!upstream.ok || !upstream.body) {
      return new Response(upstream.body ?? JSON.stringify({ error: { message: "anthropic: empty body" } }), {
        status: upstream.ok ? 502 : upstream.status,
        headers: { "content-type": "application/json" },
      })
    }

    const parts: ChunkParts = { id: `chatcmpl-${cryptoId()}`, model: req.model, created: Math.floor(Date.now() / 1000) }
    const wantUsage = !!req.stream_options?.include_usage
    const body = upstream.body

    const out = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        const usage = { inputTokens: 0, outputTokens: 0 }
        let toolIndex = -1
        let finish: string | null = null
        try {
          for await (const data of sseEvents(body)) {
            if (!data || data === "[DONE]") continue
            const ev = safeJson(data) as Record<string, unknown>
            const type = ev["type"]
            if (type === "message_start") {
              const u = (ev["message"] as any)?.usage
              if (u?.input_tokens) usage.inputTokens = u.input_tokens
              ctrl.enqueue(sseChunk(openAIChunk(parts, { role: "assistant" })))
            } else if (type === "content_block_start") {
              const block = (ev as any).content_block
              if (block?.type === "tool_use") {
                toolIndex++
                ctrl.enqueue(
                  sseChunk(
                    openAIChunk(parts, {
                      tool_calls: [
                        { index: toolIndex, id: block.id, type: "function", function: { name: block.name, arguments: "" } },
                      ],
                    }),
                  ),
                )
              }
            } else if (type === "content_block_delta") {
              const delta = (ev as any).delta
              if (delta?.type === "text_delta") {
                ctrl.enqueue(sseChunk(openAIChunk(parts, { content: delta.text })))
              } else if (delta?.type === "input_json_delta") {
                ctrl.enqueue(
                  sseChunk(openAIChunk(parts, { tool_calls: [{ index: toolIndex, function: { arguments: delta.partial_json } }] })),
                )
              }
            } else if (type === "message_delta") {
              const d = (ev as any).delta
              if (d?.stop_reason) finish = FINISH[d.stop_reason] ?? "stop"
              const u = (ev as any).usage
              if (u?.output_tokens) usage.outputTokens = u.output_tokens
            } else if (type === "message_stop") {
              ctrl.enqueue(sseChunk(openAIChunk(parts, {}, finish ?? "stop")))
              if (wantUsage) ctrl.enqueue(sseChunk(usageChunk(parts, usage)))
              ctrl.enqueue(sseDone())
            }
          }
        } catch (err) {
          ctrl.enqueue(sseChunk(openAIChunk(parts, {}, "stop")))
          ctrl.enqueue(sseDone())
        }
        ctrl.close()
      },
    })

    return new Response(out, { status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } })
  },
}

function cryptoId() {
  return Math.abs(Date.now() ^ (Math.random() * 1e9)).toString(36)
}
