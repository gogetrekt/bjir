/** Provider registry + model routing. */
import type { Provider } from "../types"
import { openAICompatible } from "./openai-compatible"
import { anthropic } from "./anthropic"
import { gemini } from "./gemini"

const env = (k: string) => process.env[k]

/** Provider registry. OpenAI-compatible vendors share one implementation;
 * Anthropic + Gemini (added in their own files) translate formats. */
const REGISTRY: Record<string, Provider> = {
  openai: openAICompatible({
    name: "openai",
    baseURL: env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1",
    apiKey: () => env("OPENAI_API_KEY"),
  }),
  mimo: openAICompatible({
    name: "mimo",
    baseURL: env("MIMO_OPENAI_BASE") ?? "https://token-plan-sgp.xiaomimimo.com/v1",
    apiKey: () => env("MIMO_API_KEY"),
  }),
  ollama: openAICompatible({
    name: "ollama",
    baseURL: (env("OLLAMA_HOST") ?? "http://localhost:11434") + "/v1",
    // Ollama needs no auth.
  }),
  openrouter: openAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: () => env("OPENROUTER_API_KEY"),
  }),
  anthropic,
  gemini,
}

/** Register/replace a provider (used by anthropic.ts / gemini.ts at import). */
export function register(provider: Provider) {
  REGISTRY[provider.name] = provider
}

export function getProvider(name: string): Provider | undefined {
  return REGISTRY[name]
}

export interface Route {
  providerName: string
  modelId: string
}

/** Map a model string to {provider, modelId}.
 * Forms: "provider/model", "ollama:model", or a bare name matched by heuristic. */
export function parseModel(model: string): Route {
  if (model.includes("/")) {
    const i = model.indexOf("/")
    const head = model.slice(0, i)
    if (REGISTRY[head]) return { providerName: head, modelId: model.slice(i + 1) }
    // e.g. "gemini/gemini-2.0-flash" where head names the provider
    return { providerName: head, modelId: model.slice(i + 1) }
  }
  if (model.startsWith("ollama:")) return { providerName: "ollama", modelId: model.slice("ollama:".length) }
  const lower = model.toLowerCase()
  if (lower.startsWith("claude")) return { providerName: "anthropic", modelId: model }
  if (lower.startsWith("gemini")) return { providerName: "gemini", modelId: model }
  if (lower.startsWith("mimo")) return { providerName: "mimo", modelId: model }
  if (/^(gpt|o1|o3|o4|chatgpt)/.test(lower)) return { providerName: "openai", modelId: model }
  // Default: treat as an OpenAI-compatible model on the openai provider.
  return { providerName: "openai", modelId: model }
}

/** Cheapest-first priority for "auto". Filtered to available providers. */
const AUTO_PRIORITY: Route[] = [
  { providerName: "mimo", modelId: "mimo-v2.5" },
  { providerName: "ollama", modelId: env("BJIR_OLLAMA_MODEL") ?? "llama3" },
  { providerName: "gemini", modelId: "gemini-2.0-flash" },
  { providerName: "openai", modelId: "gpt-4o-mini" },
  { providerName: "anthropic", modelId: "claude-3-5-haiku-latest" },
]

/** Build the ordered routes to attempt (primary + optional fallbacks). */
export function buildChain(model: string, fallback?: string[]): Route[] {
  const routes: Route[] =
    model === "auto"
      ? AUTO_PRIORITY.filter((r) => getProvider(r.providerName)?.available())
      : [parseModel(model), ...(fallback ?? []).map(parseModel)]
  // Dedupe by provider+model, preserving order.
  const seen = new Set<string>()
  return routes.filter((r) => {
    const k = `${r.providerName}/${r.modelId}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Fallback on rate-limit + server errors only. 4xx auth/validation surfaces. */
export function shouldFallback(status: number): boolean {
  return status === 429 || status >= 500
}
