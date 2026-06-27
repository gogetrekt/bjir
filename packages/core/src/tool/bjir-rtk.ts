export * as BjirRtk from "./bjir-rtk"

/**
 * BJIR: wrap shell commands with the `rtk` binary so command output is
 * compressed before it reaches LLM context. Isolated here so the patch in
 * bash.ts is a single line. wrap() never throws — on any doubt it returns the
 * original command unchanged.
 */
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

// Never wrap these: interactive, streaming, or produces no useful output to compress.
const DEFAULT_EXCLUDE = new Set([
  "cat", "echo", "printf", "less", "more", "tail", "head",
  "watch", "vim", "nano", "vi", "emacs", "top", "htop", "btop",
  "ssh", "telnet", "nc", "ftp", "sftp",
  "bash", "sh", "zsh", "fish",
  "sudo", "su", "doas",
])

let cached: string | null | undefined

function detect(): string | null {
  if (cached !== undefined) return cached
  const fromEnv = process.env.BJIR_RTK_BIN
  if (fromEnv && existsSync(fromEnv)) return (cached = fromEnv)
  // rtk on PATH (user may have installed it globally)
  const onPath = typeof Bun !== "undefined" ? Bun.which("rtk") : null
  if (onPath) return (cached = onPath)
  // bundled / installed locations
  const candidates = [
    path.join(homedir(), ".bjir", "bin", "rtk"),
    path.resolve(import.meta.dir, "../../../../bjir/rtk/rtk"),
    path.join(process.cwd(), "bjir", "rtk", "rtk"),
  ]
  for (const c of candidates) if (existsSync(c)) return (cached = c)
  return (cached = null)
}

function excluded(): Set<string> {
  const extra = process.env.BJIR_RTK_EXCLUDE?.split(",").map((s) => s.trim()).filter(Boolean) ?? []
  return extra.length ? new Set([...DEFAULT_EXCLUDE, ...extra]) : DEFAULT_EXCLUDE
}

/** Return the command, prefixed with the rtk binary when it should be wrapped. */
export function wrap(command: string): string {
  try {
    if (process.env.BJIR_RTK === "0" || process.env.BJIR_RTK === "false") return command
    const trimmed = command?.trim()
    if (!trimmed) return command
    const first = path.basename(trimmed.split(/\s+/)[0] ?? "")
    if (first === "rtk") return command // already wrapped
        if (excluded().has(first)) return command
    const bin = detect()
    if (!bin) return command
    return `${bin} ${command}`
  } catch {
    return command
  }
}
