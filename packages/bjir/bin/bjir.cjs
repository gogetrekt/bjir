#!/usr/bin/env node
// bjir launcher — find binary, start gateway if needed, run agent.
const childProcess = require("child_process")
const fs = require("fs")
const path = require("path")
const os = require("os")
const http = require("http")

const platformMap = { darwin: "darwin", linux: "linux", win32: "windows" }
const archMap = { x64: "x64", arm64: "arm64", arm: "arm" }
const platform = platformMap[os.platform()] || os.platform()
const arch = archMap[os.arch()] || os.arch()
const base = "bjir-" + platform + "-" + arch
const binName = platform === "windows" ? "bjir.exe" : "bjir"
const names = [base, base + "-baseline", base + "-musl", base + "-baseline-musl"]

function findBinary(startDir) {
  let current = startDir
  for (;;) {
    const modules = path.join(current, "node_modules")
    if (fs.existsSync(modules)) {
      for (const name of names) {
        const candidate = path.join(modules, name, "bin", binName)
        if (fs.existsSync(candidate)) return candidate
      }
    }
    const parent = path.dirname(current)
    if (parent === current) return
    current = parent
  }
}

const binary = process.env.BJIR_BIN_PATH || findBinary(path.dirname(fs.realpathSync(__filename)))
if (!binary) {
  console.error("bjir: could not find the platform binary (" + names.join(" / ") + "). Reinstall `bjir`.")
  process.exit(1)
}

const PORT = Number(process.env.BJIR_GATEWAY_PORT || 9090)
const args = process.argv.slice(2)

// `bjir gateway ...` -> run the gateway directly (no wrapper orchestration).
if (args[0] === "gateway") {
  childProcess.spawn(binary, args, { stdio: "inherit" }).on("exit", (c) => process.exit(c || 0))
  return
}

// Ensure a default config exists (never clobber an existing one).
try {
  const cfgDir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode")
  const cfg = path.join(cfgDir, "opencode.json")
  const def = path.join(__dirname, "..", "share", "opencode.json")
  if (!fs.existsSync(cfg) && fs.existsSync(def)) {
    fs.mkdirSync(cfgDir, { recursive: true })
    fs.copyFileSync(def, cfg)
  }
  // Seed bundled coding skills into the global skills dir (only if absent, never clobber).
  const skillsSrc = path.join(__dirname, "..", "share", "skills")
  const skillsDest = path.join(cfgDir, "skills")
  if (fs.existsSync(skillsSrc) && !fs.existsSync(skillsDest)) {
    fs.cpSync(skillsSrc, skillsDest, { recursive: true })
  }
} catch {}

function health(cb) {
  const req = http.get({ host: "localhost", port: PORT, path: "/health", timeout: 500 }, (res) => {
    res.resume()
    cb(res.statusCode === 200)
  })
  req.on("error", () => cb(false))
  req.on("timeout", () => {
    req.destroy()
    cb(false)
  })
}

function startAgent(routerProc) {
  // Bare launch (no subcommand) -> open the TUI in the user's cwd.
  const passed = args.length === 0 ? [process.cwd()] : args
  const child = childProcess.spawn(binary, passed, { stdio: "inherit" })
  const cleanup = () => {
    if (routerProc) try { routerProc.kill() } catch {}
  }
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, () => { try { child.kill(s) } catch {} })
  child.on("exit", (code, signal) => {
    cleanup()
    if (signal) return process.kill(process.pid, signal)
    process.exit(typeof code === "number" ? code : 0)
  })
}

health((up) => {
  if (up) return startAgent(null)
  const router = childProcess.spawn(binary, ["gateway"], { stdio: "ignore", detached: false })
  let waited = 0
  const tick = () =>
    health((ok) => {
      if (ok || waited >= 6000) return startAgent(router)
      waited += 250
      setTimeout(tick, 250)
    })
  setTimeout(tick, 250)
})
