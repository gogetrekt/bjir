#!/usr/bin/env bash
# bjir launcher — start gateway in the background, wait for health, then run the
# bjir agent (opencode fork). Kills the router on exit. Pass-through all args.
#
# Dev usage:  ./bin/bjir.sh run --model bjir/auto "hi"
# Env: BJIR_GATEWAY_PORT (default 9090). Reads .env at repo root if present.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_CWD="$PWD"
PORT="${BJIR_GATEWAY_PORT:-9090}"

# Make bun + node visible even when launched from a bare shell (no manual export).
for d in "$HOME/.bun/bin" "$HOME/.local/node/bin" "$HOME/.local/bin"; do
  [ -d "$d" ] && case ":$PATH:" in *":$d:"*) ;; *) PATH="$d:$PATH" ;; esac
done
export PATH
if ! command -v bun >/dev/null 2>&1; then
  echo "bjir: 'bun' not found on PATH. Install Bun (https://bun.sh) or add it to PATH." >&2
  exit 127
fi

# Load repo .env (MiMo key etc.) if present — never commit secrets.
if [ -f "$REPO_ROOT/.env" ]; then set -a; . "$REPO_ROOT/.env"; set +a; fi

# Zero-config: ensure a default opencode config exists (registers the gateway
# provider + model). Only writes if MISSING — never clobbers an existing config.
GLOBAL_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"
if [ ! -f "$GLOBAL_CFG" ] && [ -f "$REPO_ROOT/bjir.opencode.json.draft" ]; then
  mkdir -p "$(dirname "$GLOBAL_CFG")"
  cp "$REPO_ROOT/bjir.opencode.json.draft" "$GLOBAL_CFG"
  echo "bjir: wrote default config -> $GLOBAL_CFG" >&2
fi
# Seed bundled coding skills into the global skills dir (only if absent).
SKILLS_DEST="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/skills"
if [ ! -d "$SKILLS_DEST" ] && [ -d "$REPO_ROOT/packages/bjir/share/skills" ]; then
  mkdir -p "$(dirname "$SKILLS_DEST")"
  cp -r "$REPO_ROOT/packages/bjir/share/skills" "$SKILLS_DEST"
  echo "bjir: seeded skills -> $SKILLS_DEST" >&2
fi

ROUTER_PID=""
cleanup() { [ -n "$ROUTER_PID" ] && kill "$ROUTER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# Start gateway unless something already answers on the port.
if ! curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
  bun run "$REPO_ROOT/packages/router/src/index.ts" >/tmp/bjir-router.log 2>&1 &
  ROUTER_PID=$!
  for _ in $(seq 1 20); do
    curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1 && break
    sleep 0.25
  done
fi

# Run the bjir agent. In a source checkout, always use the dev entry (avoids
# picking up an unrelated `bjir` on PATH). Otherwise exec the installed binary.
if [ -f "$REPO_ROOT/packages/opencode/src/index.ts" ]; then
  # --cwd packages/opencode is required so bun resolves the right tsconfig
  # (Solid JSX) + bunfig. That sets process.cwd to packages/opencode, so for the
  # bare TUI launch we pass the user's real dir as the [project] positional.
  if [ "$#" -eq 0 ]; then
    exec bun run --cwd "$REPO_ROOT/packages/opencode" --conditions=browser src/index.ts "$USER_CWD"
  fi
  exec bun run --cwd "$REPO_ROOT/packages/opencode" --conditions=browser src/index.ts "$@"
fi
exec bjir "$@"
