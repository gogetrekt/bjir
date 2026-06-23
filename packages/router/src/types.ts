/** OpenAI Chat Completions shapes BJIR Gateway speaks on its public side.
 * opencode sends this exact format (stream:true, stream_options.include_usage,
 * tools in OpenAI function format). `content` is usually a plain string, but is a
 * multimodal array of parts (text + image_url) when the user attaches an image. */
import type { OpenAIContent } from "./content"

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: OpenAIContent
  name?: string
  tool_call_id?: string
  tool_calls?: unknown[]
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  stream_options?: { include_usage?: boolean }
  max_tokens?: number
  temperature?: number
  top_p?: number
  tools?: unknown[]
  tool_choice?: unknown
  /** Optional BJIR-only override: explicit fallback chain of model strings. */
  "x-bjir-fallback"?: string[]
  [k: string]: unknown
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

/** A provider streams an OpenAI-compatible response. It returns a web `Response`
 * whose body is either an SSE stream (when req.stream) or a JSON completion.
 * `res.ok === false` lets the router decide fallback (429/5xx) vs surface (4xx). */
export interface Provider {
  readonly name: string
  /** True when the credentials/host this provider needs are configured. */
  available(): boolean
  stream(req: ChatRequest, signal?: AbortSignal): Promise<Response>
}
