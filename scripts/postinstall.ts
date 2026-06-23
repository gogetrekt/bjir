/**
 * BJIR postinstall — copy the matching rtk binary to ~/.bjir/bin/rtk so the bash
 * tool finds it on PATH-less systems, and ensure the bjir provider + rule
 * instructions are registered in the user's global opencode config.
 * Best-effort: a failure here never blocks install.
 */
import { platform, arch, homedir } from "node:os"
import path from "node:path"
import { existsSync, mkdirSync, copyFileSync, chmodSync, readFileSync, writeFileSync } from "node:fs"

function installRtk() {
  const os = platform() // linux | darwin | win32
  const cpu = arch() === "arm64" ? "arm64" : "x64"
  const ext = os === "win32" ? ".exe" : ""
  const name = `rtk-${os}-${cpu}${ext}`
  const src = path.resolve(import.meta.dir, "..", "bjir", "rtk", name)
  if (!existsSync(src)) {
    console.warn(`[bjir] no bundled rtk for ${os}-${cpu}; shell compression disabled until rtk is on PATH`)
    return
  }
  const destDir = path.join(homedir(), ".bjir", "bin")
  const dest = path.join(destDir, `rtk${ext}`)
  mkdirSync(destDir, { recursive: true })
  copyFileSync(src, dest)
  if (os !== "win32") chmodSync(dest, 0o755)
  console.log(`[bjir] rtk installed -> ${dest}`)
}

// caveman + ponytail are compiled into BJIR (always on) — nothing to register.

try {
  installRtk()
  console.log("[bjir] installed. Run: bjir")
} catch (e) {
  console.warn(`[bjir] postinstall skipped: ${e instanceof Error ? e.message : e}`)
}
