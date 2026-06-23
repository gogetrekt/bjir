/**
 * BJIR Gateway — BJIR's local AI gateway.
 *
 * OpenAI-compatible streaming proxy. opencode (configured with an
 * openai-compatible provider pointed at http://localhost:9090/v1) sends
 * OpenAI Chat Completions requests with `stream: true`; BJIR Gateway routes to the
 * target upstream, translates where needed, and proxies the SSE stream back.
 */
import { Hono } from "hono"
import { routeCompletion } from "./router"
import type { ChatRequest } from "./types"

const PORT = Number(process.env.BJIR_GATEWAY_PORT ?? 9090)

const app = new Hono()

app.get("/health", (c) => c.json({ ok: true }))

app.post("/v1/chat/completions", async (c) => {
  let req: ChatRequest
  try {
    req = (await c.req.json()) as ChatRequest
  } catch {
    return c.json({ error: { message: "BJIR Gateway: invalid JSON body" } }, 400)
  }
  return routeCompletion(req, c.req.raw.signal)
})

export { app }

/** Start the gateway and block forever. Used by the `bjir BJIR Gateway` subcommand
 * so the single bjir binary can also serve as the gateway (no separate binary). */
export function serve(port: number = PORT): void {
  Bun.serve({ port, fetch: app.fetch, idleTimeout: 0 })
  // eslint-disable-next-line no-console
  console.error(`BJIR Gateway listening on http://localhost:${port}`)
}

export default { port: PORT, fetch: app.fetch }
