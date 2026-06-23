// Ported from chopratejas/headroom (Apache 2.0) — https://github.com/chopratejas/headroom
// CCR retrieve tool — native TypeScript; no headroom code/dependency bundled.

import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { BjirCCR } from "@opencode-ai/core/bjir/compress/ccr"

export const Parameters = Schema.Struct({
  id: Schema.String.annotate({
    description: "The bjir_retrieve id shown in a compressed tool output (e.g. bjir_retrieve id=\"<id>\").",
  }),
})

/**
 * bjir_retrieve — fetch the full, untruncated original of a tool output that
 * BjirCompress shortened (SmartCrusher / LogCompressor / I/O refiner). The id
 * comes from the `[bjir_retrieve id="…"]` hint appended to compressed output.
 * Read-only, local cache (~/.bjir/ccr) — no permission prompt.
 */
export const BjirRetrieveTool = Tool.define<typeof Parameters, {}, never>(
  "bjir_retrieve",
  Effect.gen(function* () {
    return {
      description:
        "Retrieve the full, untruncated original of a previously compressed tool output by its bjir_retrieve id (shown as `[bjir_retrieve id=\"…\"]`). Use this when a compressed/omitted result hid detail you now need.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>) =>
        Effect.sync(() => {
          const content = BjirCCR.retrieve(params.id)
          if (content === undefined) {
            return {
              title: params.id,
              output: `No cached content for id "${params.id}". It may have expired or never been compressed.`,
              metadata: {},
            }
          }
          return { title: params.id, output: content, metadata: {} }
        }),
    }
  }),
)
