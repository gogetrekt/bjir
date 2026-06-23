/** OpenAI-compatible upstream: a streaming reverse-proxy. Covers OpenAI, MiMo,
 * Ollama (its /v1 endpoint), OpenRouter — any vendor that speaks the OpenAI
 * Chat Completions wire format. No translation: forward the request, stream the
 * response body straight back. */
import type { ChatRequest, Provider } from "../types"

export interface OAICompatConfig {
  name: string
  baseURL: string // e.g. https://api.openai.com/v1  (no trailing /chat/completions)
  apiKey?: () => string | undefined
}

export function openAICompatible(cfg: OAICompatConfig): Provider {
  return {
    name: cfg.name,
    available: () => !!cfg.baseURL && (cfg.apiKey === undefined || !!cfg.apiKey()),
    async stream(req: ChatRequest, signal?: AbortSignal): Promise<Response> {
      const headers: Record<string, string> = { "content-type": "application/json" }
      const key = cfg.apiKey?.()
      if (key) headers["authorization"] = `Bearer ${key}`
      const { ["x-bjir-fallback"]: _drop, ...payload } = req
      const res = await fetch(`${cfg.baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      })
      // Pass the upstream response through unchanged (status + body stream). The
      // router inspects res.ok to decide fallback vs surface before we hand the
      // stream to the client.
      return new Response(res.body, {
        status: res.status,
        headers: {
          "content-type": res.headers.get("content-type") ?? "application/json",
          "cache-control": "no-cache",
        },
      })
    },
  }
}
