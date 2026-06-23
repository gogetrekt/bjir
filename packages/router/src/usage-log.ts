/** Tee a streaming response to extract the final usage chunk and append it to
 * ~/.bjir/token-log.ndjson. Best-effort: never throws, never blocks the stream.
 * This is BJIR's token accounting source (the gateway sees real usage), read by
 * `bjir gain`. */
import { appendFile, mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const DIR = path.join(homedir(), ".bjir")
const LOG = path.join(DIR, "token-log.ndjson")

async function write(entry: object) {
  try {
    await mkdir(DIR, { recursive: true })
    await appendFile(LOG, JSON.stringify(entry) + "\n")
  } catch {
    // logging is best-effort
  }
}

/** Find the last SSE `data:` JSON carrying a `usage` object. */
function extractUsage(sse: string): { prompt_tokens?: number; completion_tokens?: number } | undefined {
  let found: { prompt_tokens?: number; completion_tokens?: number } | undefined
  for (const line of sse.split("\n")) {
    if (!line.startsWith("data:")) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === "[DONE]") continue
    try {
      const obj = JSON.parse(payload)
      if (obj?.usage) found = obj.usage
    } catch {
      // partial/non-JSON line; ignore
    }
  }
  return found
}

export function tapUsage(res: Response, model: string): Response {
  if (!res.body) return res
  const ct = res.headers.get("content-type") ?? ""
  if (!ct.includes("event-stream")) return res // only SSE streams for now

  let buf = ""
  const dec = new TextDecoder()
  const tee = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      try {
        buf += dec.decode(chunk, { stream: true })
        // bound memory: only the tail can hold the final usage chunk
        if (buf.length > 65536) buf = buf.slice(-32768)
      } catch {
        // ignore decode hiccups
      }
      ctrl.enqueue(chunk)
    },
    flush() {
      const u = extractUsage(buf)
      if (u) void write({ ts: Date.now(), model, in: u.prompt_tokens ?? 0, out: u.completion_tokens ?? 0 })
    },
  })

  return new Response(res.body.pipeThrough(tee), { status: res.status, headers: res.headers })
}
