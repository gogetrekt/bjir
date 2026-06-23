#!/usr/bin/env node
/**
 * bjir postinstall — copy the matching rtk binary to ~/.bjir/bin/rtk so the bash
 * tool finds it (shell-output compression). Best-effort: never fails install.
 * The default opencode config is written on first run by the launcher.
 */
const fs = require("fs")
const path = require("path")
const os = require("os")

try {
  const platformMap = { darwin: "darwin", linux: "linux", win32: "windows" }
  const platform = platformMap[os.platform()] || os.platform()
  const arch = os.arch() === "arm64" ? "arm64" : "x64"
  const ext = platform === "windows" ? ".exe" : ""
  const src = path.join(__dirname, "..", "vendor", "rtk", `rtk-${platform}-${arch}${ext}`)
  if (!fs.existsSync(src)) {
    console.warn(`[bjir] no bundled rtk for ${platform}-${arch}; shell compression disabled until rtk is on PATH`)
    return
  }
  const destDir = path.join(os.homedir(), ".bjir", "bin")
  const dest = path.join(destDir, `rtk${ext}`)
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(src, dest)
  if (platform !== "windows") fs.chmodSync(dest, 0o755)
  console.log(`[bjir] rtk installed -> ${dest}`)
} catch (e) {
  console.warn(`[bjir] postinstall skipped: ${e && e.message ? e.message : e}`)
}
