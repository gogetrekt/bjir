export * as BjirCompress from "./index"

// Ported from chopratejas/headroom (Apache 2.0) — https://github.com/chopratejas/headroom
// Native TypeScript reimplementation; no headroom code or dependency bundled.

/**
 * BjirCompress — the single tool-output compression entry point, hooked at the
 * REAL universal chokepoint (opencode session `message-v2.ts` toModelMessages,
 * where every completed tool part becomes model-facing text). NOTE: the prior
 * I/O Refiner (Phase F) was wired into `core/tool/registry.ts`, which the live
 * agent never executes — so it never ran. This routes through the live path.
 *
 * J1 (this phase): ContentRouter classifies the output; the line-based refiner
 * (F's logic, now actually live) is the universal handler. Future phases slot
 * specialized compressors behind the router by content type:
 *   - json-array/json-object -> SmartCrusher        (J2)
 *   - build-log              -> LogCompressor        (J3)
 *   - any                    -> CCR cache + retrieve (J4)
 *
 * Gated by the existing I/O-refine gate (BJIR_OPTIMIZE + BJIR_IO_REFINE) so the
 * "explain" profile and per-feature opt-out keep working. Never throws.
 */

import { BjirContentRouter, type ContentType } from "./content-router"
import { BjirSmartCrusher } from "./smart-crusher"
import { BjirLogCompressor } from "./log-compressor"
import { BjirCCR } from "./ccr"
import { BjirIORefine } from "../io-refine"

export type { ContentType }
export const detect = BjirContentRouter.detect

/** Whether tool-output compression is active (same gate as the I/O refiner). */
export function enabled(): boolean {
  return BjirIORefine.enabled()
}

/**
 * Compress a single tool's output string before it enters the model context.
 * Returns the (possibly shorter) text; on any doubt returns the input unchanged.
 */
export function compress(toolName: string, text: string): string {
  if (!enabled() || !text) return text
  try {
    const type = detect(text)
    let out: string
    switch (type) {
      case "json-array":
      case "json-object":
        // SmartCrusher (J2): statistical crush; keeps head/tail + all anomalies,
        // summarizes the omitted middle. Returns original if not worth it. Do
        // NOT fall through to the line refiner — it would corrupt JSON.
        out = BjirSmartCrusher.crush(text)
        break
      case "build-log":
        // LogCompressor (J3): level-aware, keep all errors, collapse repeats.
        // Augments rtk; falls back to original if it can't help.
        out = BjirLogCompressor.compress(text)
        break
      default:
        // F's line-based refiner (ANSI strip, dedup, per-tool caps) — now LIVE.
        // It records savings to the profiler (kind `io:<tool>`).
        out = BjirIORefine.refineToolOutput(toolName, text)
    }
    // CCR (J4): if we actually shortened it, make it reversible — stash the
    // original and append a `bjir_retrieve` hint so the model can pull it back.
    if (out.length < text.length) out = BjirCCR.attach(text, out)
    return out
  } catch {
    return text
  }
}
