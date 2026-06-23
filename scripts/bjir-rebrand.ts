/**
 * BJIR rebrand — exact, idempotent string replacements over user-visible
 * surfaces (identity prompts, CLI help, banner, errors, TUI chrome). Exact
 * pairs only (never token-level) so imports / config keys / env vars / package
 * names are never touched. Re-runnable after upstream merges.
 * Run: bun scripts/bjir-rebrand.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "..")
const ID = '. If asked who you are, answer exactly: "BJIR — Bloat Judgement & I/O Refiner".'

const EDITS: Record<string, [string, string][]> = {
  // --- agent identity (who are you) ---
  "packages/opencode/src/session/prompt/trinity.txt": [
    [
      "You are opencode, an interactive CLI tool that helps users with software engineering tasks.",
      "You are BJIR (Bloat Judgement & I/O Refiner), an interactive CLI coding agent" + ID,
    ],
  ],
  "packages/opencode/src/session/prompt/anthropic.txt": [
    ["You are OpenCode, the best coding agent on the planet.", "You are BJIR (Bloat Judgement & I/O Refiner), a token-lean coding agent" + ID],
  ],
  "packages/opencode/src/session/prompt/codex.txt": [
    ["You are OpenCode, the best coding agent on the planet.", "You are BJIR (Bloat Judgement & I/O Refiner), a token-lean coding agent" + ID],
  ],
  "packages/opencode/src/session/prompt/beast.txt": [["You are opencode, an agent", "You are BJIR (Bloat Judgement & I/O Refiner), an agent"]],
  "packages/opencode/src/session/prompt/gemini.txt": [
    [
      "You are opencode, an interactive CLI agent specializing in software engineering tasks.",
      "You are BJIR (Bloat Judgement & I/O Refiner), an interactive CLI coding agent specializing in software engineering tasks" + ID,
    ],
  ],
  "packages/opencode/src/session/prompt/gpt.txt": [
    ["You are OpenCode, You and the user share", "You are BJIR (Bloat Judgement & I/O Refiner). You and the user share"],
  ],
  "packages/opencode/src/session/prompt/kimi.txt": [
    [
      "You are OpenCode, an interactive general AI agent running on a user's computer.",
      "You are BJIR (Bloat Judgement & I/O Refiner), an interactive general AI agent running on a user's computer" + ID,
    ],
  ],
  "packages/opencode/src/session/prompt/copilot-gpt-5.txt": [["Your name is opencode", "Your name is BJIR (Bloat Judgement & I/O Refiner)"]],

  // --- CLI command descriptions (shown in `bjir --help`) ---
  "packages/opencode/src/cli/cmd/run.ts": [
    ['describe: "run opencode with a message"', 'describe: "run BJIR with a message"'],
    ['describe: "attach to a running opencode server (e.g., http://localhost:4096)"', 'describe: "attach to a running BJIR server (e.g., http://localhost:4096)"'],
  ],
  "packages/opencode/src/cli/cmd/tui.ts": [
    ['describe: "start opencode tui"', 'describe: "start the BJIR TUI"'],
    ['describe: "path to start opencode in"', 'describe: "path to start BJIR in"'],
  ],
  "packages/opencode/src/cli/cmd/pr.ts": [
    ['describe: "fetch and checkout a GitHub PR branch, then run opencode"', 'describe: "fetch and checkout a GitHub PR branch, then run BJIR"'],
  ],
  "packages/opencode/src/cli/cmd/web.ts": [
    ['describe: "start opencode server and open web interface"', 'describe: "start BJIR server and open web interface"'],
  ],
  "packages/opencode/src/cli/cmd/upgrade.ts": [
    ['describe: "upgrade opencode to the latest or a specific version"', 'describe: "upgrade BJIR to the latest or a specific version"'],
  ],
  "packages/opencode/src/cli/cmd/serve.ts": [['describe: "starts a headless opencode server"', 'describe: "starts a headless BJIR server"']],
  "packages/opencode/src/cli/cmd/attach.ts": [['describe: "attach to a running opencode server"', 'describe: "attach to a running BJIR server"']],
  "packages/opencode/src/cli/cmd/uninstall.ts": [
    ['describe: "uninstall opencode and remove all related files"', 'describe: "uninstall BJIR and remove all related files"'],
    ['prompts.intro("Uninstall OpenCode")', 'prompts.intro("Uninstall BJIR")'],
    ['prompts.log.success("Thank you for using OpenCode!")', 'prompts.log.success("Thank you for using BJIR!")'],
  ],
  "packages/opencode/src/cli/cmd/mcp.ts": [['prompts.outro("Add servers with: opencode mcp add")', 'prompts.outro("Add servers with: bjir mcp add")']],

  // --- entry banner / resume hint ---
  "packages/opencode/src/cli/cmd/run/splash.ts": [
    ['"OpenCode"', '"BJIR"'],
    ["`opencode run -i -s ${meta.session_id}`", "`bjir run -i -s ${meta.session_id}`"],
  ],

  // --- error messages ---
  "packages/opencode/src/cli/error.ts": [
    ["Note, opencode does not support MCP authentication yet.", "Note, BJIR does not support MCP authentication yet."],
    ["Try: \\`opencode models\\` to list available models", "Try: \\`bjir models\\` to list available models"],
    ["Or check your config (opencode.json) provider/model names", "Or check your config (bjir.json) provider/model names"],
    ["Run \\`opencode auth login ${url}\\` to re-authenticate.", "Run \\`bjir auth login ${url}\\` to re-authenticate."],
  ],

  // --- TUI chrome ---
  "packages/tui/src/feature-plugins/sidebar/footer.tsx": [
    ["OpenCode includes free models so you can start immediately.", "BJIR includes free models so you can start immediately."],
  ],
  "packages/tui/src/app.tsx": [
    ['setTerminalTitle("OpenCode")', 'setTerminalTitle("BJIR")'],
    ["Successfully updated to OpenCode v${result.data.version}. Please restart the application.", "Successfully updated to BJIR v${result.data.version}. Please restart the application."],
  ],

  // --- Phase A: remaining visible CLI + TUI text ---
  "packages/opencode/src/cli/cmd/pr.ts": [
    ["Found opencode session", "Found BJIR session"],
    ["Starting opencode...", "Starting BJIR..."],
  ],
  "packages/opencode/src/cli/cmd/mcp.ts": [
    ["Add a remote server in opencode.json:", "Add a remote server in bjir.json:"],
  ],
  "packages/opencode/src/cli/cmd/providers.ts": [['describe: "opencode auth provider"', 'describe: "BJIR auth provider"']],
  "packages/opencode/src/cli/cmd/github.handler.ts": [
    ['console.log("opencode session", session.id)', 'console.log("bjir session", session.id)'],
    ["Sending message to opencode...", "Sending message to BJIR..."],
  ],
  "packages/opencode/src/cli/cmd/upgrade.ts": [
    ["opencode is installed to ${process.execPath}", "bjir is installed to ${process.execPath}"],
    ["opencode upgrade skipped:", "bjir upgrade skipped:"],
  ],
  "packages/opencode/src/cli/cmd/run/footer.prompt.tsx": [["close OpenCode", "close BJIR"]],
  "packages/tui/src/routes/session/permission.tsx": [
    ["OpenCode is restarted", "BJIR is restarted"],
    ["Tell OpenCode what to do differently", "Tell BJIR what to do differently"],
  ],

  // --- Phase A: home tips — replace opencode/cloud/.opencode tips with BJIR-centric ones ---
  "packages/tui/src/feature-plugins/home/tips-view.tsx": [
    [
      "Run {highlight}/share{/highlight} to create a public link to your conversation at opencode.ai",
      "Run {highlight}/gain{/highlight} to see how many tokens BJIR has saved you",
    ],
    [
      "Create {highlight}opencode.json{/highlight} for server settings and {highlight}tui.json{/highlight} for TUI settings",
      "Create {highlight}bjir.json{/highlight} for settings and {highlight}tui.json{/highlight} for TUI settings",
    ],
    [
      "Place TUI settings in {highlight}~/.config/opencode/tui.json{/highlight} for global config",
      "BJIR's caveman + ponytail + refiner optimizers are built in and always on",
    ],
    [
      "Add {highlight}.md{/highlight} files to {highlight}.opencode/commands/{/highlight} to define reusable custom prompts",
      "rtk compresses shell output before it reaches the model — automatic",
    ],
    [
      "Add {highlight}.md{/highlight} files to {highlight}.opencode/agents/{/highlight} for specialized AI personas",
      "The I/O Refiner trims your prompts to cut input tokens automatically",
    ],
    [
      "Create {highlight}.ts{/highlight} files in {highlight}.opencode/tools/{/highlight} to define new LLM tools",
      "Run {highlight}bjir compress{/highlight} to caveman-compress your memory files",
    ],
    [
      "Add {highlight}.ts{/highlight} files to {highlight}.opencode/plugins/{/highlight} for event hooks",
      "The BJIR Gateway routes to Claude, GPT, Gemini, or Ollama with automatic fallback",
    ],
    [
      "Use {highlight}/opencode{/highlight} in GitHub issues/PRs to trigger AI actions",
      "Point a model that can't connect directly through the {highlight}BJIR Gateway{/highlight}",
    ],
    [
      "Comment {highlight}/opencode fix this{/highlight} on issues to auto-create PRs",
      "Run {highlight}bjir gain{/highlight} for a full token-savings breakdown",
    ],
    [
      "Create JSON theme files in {highlight}.opencode/themes/{/highlight} directory",
      "Switch themes with {highlight}/themes{/highlight}",
    ],
    [
      "Run {highlight}docker run -it --rm ghcr.io/anomalyco/opencode{/highlight} for containerized use",
      "BJIR caveman makes responses terse — ~65% fewer output tokens",
    ],
    [
      "Use {highlight}/connect{/highlight} with BJIR Zen for curated, tested models",
      "Use {highlight}/connect{/highlight} to add API keys for many LLM providers",
    ],
  ],
}

let changed = 0
let missed = 0
for (const [rel, pairs] of Object.entries(EDITS)) {
  const file = path.join(ROOT, rel)
  if (!existsSync(file)) {
    console.warn(`skip (missing): ${rel}`)
    continue
  }
  let text = readFileSync(file, "utf8")
  for (const [from, to] of pairs) {
    if (text.includes(from)) {
      text = text.split(from).join(to)
      changed++
    } else if (!text.includes(to)) {
      console.warn(`  NOT FOUND in ${rel}: "${from.slice(0, 60)}"`)
      missed++
    }
  }
  writeFileSync(file, text)
}
console.log(`rebrand: ${changed} replacements applied, ${missed} not found`)
