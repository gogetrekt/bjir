#!/usr/bin/env bash
# Download + extract rtk release binaries for all bundled targets into bjir/rtk/.
# rtk = rtk-ai/rtk (Apache-2.0). Assets are Rust target-triple archives.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$REPO_ROOT/bjir/rtk"
mkdir -p "$DEST"

# normalized name -> release asset (target-triple archive)
declare -A ASSETS=(
  [linux-x64]="rtk-x86_64-unknown-linux-musl.tar.gz"
  [linux-arm64]="rtk-aarch64-unknown-linux-gnu.tar.gz"
  [darwin-x64]="rtk-x86_64-apple-darwin.tar.gz"
  [darwin-arm64]="rtk-aarch64-apple-darwin.tar.gz"
  [win32-x64]="rtk-x86_64-pc-windows-msvc.zip"
)

REL="$(curl -fsSL https://api.github.com/repos/rtk-ai/rtk/releases/latest)"
get_url() { echo "$REL" | grep -o "https://[^\"]*$1" | head -1; }

for name in "${!ASSETS[@]}"; do
  asset="${ASSETS[$name]}"
  url="$(get_url "$asset")"
  [ -z "$url" ] && { echo "warn: no asset for $name ($asset)"; continue; }
  tmp="$(mktemp -d)"
  echo "fetch $name <- $asset"
  curl -fsSL "$url" -o "$tmp/a"
  case "$asset" in
    *.zip) (cd "$tmp" && unzip -qo a) ;;
    *)     tar -xzf "$tmp/a" -C "$tmp" ;;
  esac
  bin="$(find "$tmp" -type f \( -name rtk -o -name 'rtk.exe' \) | head -1)"
  [ -z "$bin" ] && { echo "warn: no rtk binary in $asset"; rm -rf "$tmp"; continue; }
  ext=""; [ "$name" = "win32-x64" ] && ext=".exe"
  cp "$bin" "$DEST/rtk-$name$ext"
  chmod +x "$DEST/rtk-$name$ext" 2>/dev/null || true
  rm -rf "$tmp"
done

# Convenience copy for the host platform as bare `rtk` (used by dev + detection).
host="linux-x64"
case "$(uname -s)" in Darwin) host="darwin-$([ "$(uname -m)" = arm64 ] && echo arm64 || echo x64)";; esac
[ -f "$DEST/rtk-$host" ] && cp "$DEST/rtk-$host" "$DEST/rtk" && chmod +x "$DEST/rtk"
echo "done -> $DEST"
