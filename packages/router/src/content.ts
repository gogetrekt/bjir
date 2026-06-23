/** OpenAI Chat `content` can be a plain string OR a multimodal array of parts
 * (text + image_url) when the user attaches an image. opencode's TUI sends
 * images as `image_url` parts whose url is a `data:<mime>;base64,...` URL. These
 * helpers let the Anthropic/Gemini translators lower that array without dropping
 * the images (the OpenAI-compatible provider forwards the array verbatim, so it
 * needs nothing). */

export interface OpenAITextPart {
  type: "text"
  text: string
}
export interface OpenAIImagePart {
  type: "image_url"
  image_url: { url: string; detail?: string }
}
export type OpenAIContentPart = OpenAITextPart | OpenAIImagePart | { type: string; [k: string]: unknown }
export type OpenAIContent = string | OpenAIContentPart[] | null

/** Concatenate only the text of an OpenAI content value (drops images). Use for
 * system messages and any place that must be a plain string. */
export function contentText(content: OpenAIContent): string {
  if (content == null) return ""
  if (typeof content === "string") return content
  return content
    .filter((p): p is OpenAITextPart => (p as { type?: string }).type === "text" && typeof (p as OpenAITextPart).text === "string")
    .map((p) => p.text)
    .join("")
}

/** Parse a `data:<mime>;base64,<payload>` URL. Returns null for non-data URLs. */
export function parseDataUrl(url: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(url)
  if (!m) return null
  return { mediaType: m[1] || "application/octet-stream", data: m[2] ?? "" }
}

/** True when the content carries at least one image part. */
export function hasImage(content: OpenAIContent): boolean {
  return Array.isArray(content) && content.some((p) => (p as { type?: string }).type === "image_url")
}

/** Iterate the parts of an OpenAI content value as a normalized array. */
export function asParts(content: OpenAIContent): OpenAIContentPart[] {
  if (content == null) return []
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : []
  return content
}
