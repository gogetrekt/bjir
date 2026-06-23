/**
 * BJIR connect presets + provider-config builder. Pure (no JSX/UI deps) so it is
 * unit-testable in isolation; dialog-provider.tsx imports these.
 *
 * The presets write a FULL provider block (npm + baseURL + apiKey + models) to
 * the global config, so a provider is usable without hand-editing config —
 * unlike opencode's generic "Other" flow, which only stores a credential.
 * openai-compatible providers (9router included) speak the OpenAI API;
 * "Anthropic Compatible" uses @ai-sdk/anthropic.
 */

export type BjirConnectPreset = {
  title: string
  description: string
  npm: string
  fixedID?: string
  defaultBaseURL?: string
  category: string
}

export const BJIR_CONNECT_PRESETS: Record<string, BjirConnectPreset> = {
  __bjir_9router__: {
    title: "9Router",
    description: "decolua/9router gateway — multi-provider routing with fallback (OpenAI-compatible)",
    npm: "@ai-sdk/openai-compatible",
    fixedID: "9router",
    defaultBaseURL: "http://localhost:20128/v1",
    category: "Popular",
  },
  __bjir_openai_compat__: {
    title: "OpenAI Compatible",
    description: "Any OpenAI-compatible endpoint (name it, point it, add models)",
    npm: "@ai-sdk/openai-compatible",
    category: "Providers",
  },
  __bjir_anthropic_compat__: {
    title: "Anthropic Compatible",
    description: "Any Anthropic-compatible endpoint (@ai-sdk/anthropic)",
    npm: "@ai-sdk/anthropic",
    category: "Providers",
  },
}

/**
 * Build a partial config that defines one provider. Deep-merged into the global
 * config by the server, so adding another provider never overwrites an existing
 * one. Mirrors the verified 9router config format.
 */
export function buildProviderConfig(input: {
  id: string
  npm: string
  baseURL: string
  apiKey?: string
  models: string[]
}) {
  return {
    provider: {
      [input.id]: {
        name: input.id,
        npm: input.npm,
        options: {
          baseURL: input.baseURL,
          ...(input.apiKey ? { apiKey: input.apiKey } : {}),
        },
        models: Object.fromEntries(input.models.map((m) => [m, { name: m }])),
      },
    },
  }
}
