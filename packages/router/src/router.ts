/** Routing + fallback. Picks a provider chain for the requested model and tries
 * each in order: fall back on 429/5xx (before any bytes stream), surface 4xx
 * (auth/validation) immediately. */
import type { ChatRequest } from "./types"
import { buildChain, getProvider, shouldFallback } from "./providers/base"
import { tapUsage } from "./usage-log"

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

export async function routeCompletion(req: ChatRequest, signal?: AbortSignal): Promise<Response> {
  const chain = buildChain(req.model, req["x-bjir-fallback"])
  if (chain.length === 0) return json({ error: { message: `BJIR Gateway: no route for model "${req.model}"` } }, 400)

  let last: Response | undefined
  for (const route of chain) {
    const provider = getProvider(route.providerName)
    if (!provider) {
      last = json({ error: { message: `BJIR Gateway: unknown provider "${route.providerName}"` } }, 400)
      continue
    }
    if (!provider.available()) {
      last = json({ error: { message: `BJIR Gateway: provider "${route.providerName}" not configured (missing key/host)` } }, 503)
      continue
    }
    const res = await provider
      .stream({ ...req, model: route.modelId }, signal)
      .catch((err: unknown) =>
        json(
          { error: { message: `BJIR Gateway: ${route.providerName} request failed: ${err instanceof Error ? err.message : String(err)}` } },
          502,
        ),
      )

    if (res.ok) return tapUsage(res, `${route.providerName}/${route.modelId}`)
    if (shouldFallback(res.status)) {
      last = res
      continue // try next route
    }
    return res // surface 4xx (auth/validation) — never swallow
  }
  return last ?? json({ error: { message: "BJIR Gateway: all providers exhausted" } }, 502)
}
