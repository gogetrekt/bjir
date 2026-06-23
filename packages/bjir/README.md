<h1 align="center">BJIR</h1>

<p align="center">A token-lean AI coding agent for the terminal.</p>

<p align="center"><b>One obsession: do the same work for far fewer tokens.</b></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.id.md">Bahasa Indonesia</a>
</p>

---

## What is BJIR?

BJIR is an AI coding agent you run in your terminal. It reads and edits code, runs commands, and talks to a model (Claude, GPT, Gemini, MiMo, local models).

The difference is token usage. Every request is trimmed, every reply is steered to be terse, and noisy tool output (test logs, big JSON, `git status`) is compressed before it reaches the model. These optimizations are compiled in and always on, so you save without configuring anything. Less context in and less text out means lower cost, faster replies, and longer sessions.

## Install

### npm (recommended)

```bash
npm i -g bjir          # or: bun add -g bjir / pnpm add -g bjir / yarn global add bjir
bjir                   # launch
```

### From source

```bash
git clone https://github.com/gogetrekt/bjir
cd bjir
bun install
./bin/bjir.sh
```

To run `bjir` from anywhere on a source checkout, symlink it onto your PATH:

```bash
ln -s "$PWD/bin/bjir.sh" ~/.local/bin/bjir
```

### API key

BJIR needs a model provider. Launch `bjir`, open the provider dialog, and add one (OpenAI-compatible, Anthropic-compatible, or a preset). Name, base URL, key, and models are saved and persist across restarts.

## Quick start

Run `bjir` (just `bjir`) to open the interactive TUI:

```bash
bjir                       # open the TUI in the current directory
bjir /path/to/project      # open the TUI in a specific project
bjir run "summarize today's changes"   # one-shot, non-interactive
bjir gain                  # show tokens saved
```

In the TUI: type to chat, press `Tab` to switch between the build agent (full access) and the plan agent (read-only), run `/reducer` to change optimization intensity, and watch the sidebar for a live tokens-saved counter.

## Optimizations

Built into the binary, always on. Nothing to configure.

| Optimization | What it does |
| --- | --- |
| Ponytail | Code-minimalism rules. The agent writes the smallest correct change, so replies and diffs stay small. |
| Caveman | Response-style rules that make the model answer tersely. The biggest cut to output tokens. Three intensity levels (see `/reducer`). |
| I/O Refiner | Trims the assembled prompt right before it is sent, cutting input tokens. |
| Context Prune | Drops stale history each turn so old context stops costing tokens. |
| Read Dedup | Skips re-sending a file that was already read. |
| Semantic Read | Returns only the relevant parts of a file when that is enough. |
| Tool-output compression | Big tool results are compressed by type: SmartCrusher for large JSON, Log Compressor for build and shell logs, and CCR, which stashes the full output and lets the agent pull back any part on demand. Lossless or skipped. |
| RTK | Wraps shell commands (`git`, `cargo`, `npm`, `bun`, `docker`) so their output is compressed before the agent sees it. |
| BJIR Gateway | A local OpenAI-compatible gateway that routes across providers with automatic fallback and meters token usage. |

### Intensity

Caveman has three levels: `lite`, `standard`, `ultra`. Switch live in the TUI with `/reducer` (also `/caveman`, `/ponytail`); it applies on your next message. From the CLI, `bjir profile [explain|balanced|ultra]` sets a persistent profile. Set `BJIR_OPTIMIZE=0` to turn the layer off.

## Savings

```bash
bjir gain              # ranked table of tokens saved
bjir gain --json       # machine-readable
bjir gain --reset      # clear history
```

Numbers come from real session data. The TUI sidebar shows a running total.

## Commands

Run `bjir <command> --help` for options.

| Command | Description |
| --- | --- |
| `bjir` | Launch the interactive TUI (default). |
| `bjir run "<prompt>"` | One-shot, non-interactive run. |
| `bjir serve` | Run the headless HTTP API server. |
| `bjir attach` | Connect to a running server. |
| `bjir gain` | Show the token-savings summary. |
| `bjir compress` | Caveman-compress memory files (`CLAUDE.md`, `AGENTS.md`, `.opencode/memory.md`). |
| `bjir profile [name]` | Show or switch the optimization profile. |
| `bjir gateway` | Start the BJIR Gateway (usually automatic). |
| `bjir models` | List available models. |
| `bjir providers` | Manage providers and credentials. |
| `bjir revoke [id]` | Remove a connected provider. |
| `bjir agent` | Create and manage agents. |
| `bjir mcp` | Manage MCP servers. |
| `bjir github` | Set up and run the GitHub agent. |
| `bjir upgrade` | Update to the latest version. |
| `bjir uninstall` | Uninstall BJIR. |

## Configuration

BJIR reads config from `~/.config/opencode/opencode.json` (seeded on first run) and a project-local `opencode.json` or `.opencode/opencode.json`. Providers added through the connect dialog are written here. Built-in optimizations are not config; tune them with `/reducer`, `bjir profile`, and `BJIR_*` environment variables.

## Agents

Switch with `Tab`:

- build: full-access agent for writing and changing code.
- plan: read-only, denies edits and asks before running commands.

Invoke the general subagent for complex searches with `@general`.

## License

MIT. BJIR is a fork of [opencode](https://github.com/anomalyco/opencode) and is not affiliated with or endorsed by the opencode team.
