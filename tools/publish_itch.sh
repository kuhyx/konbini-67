#!/bin/bash

# ============================================================================
# Publish the browser build to https://kuhyx.itch.io/konbini-67 (channel
# "html5"): vite build, prove it boots in headless Chromium, then butler push.
# The upload is versioned with the git commit so itch shows which build is live.
#   tools/publish_itch.sh [--dry-run]
# Needs a one-time `butler login` (browser OAuth). Installs butler if missing.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly TARGET="kuhyx/konbini-67:html5"
readonly BUTLER_URL="https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default"
readonly BIN_DIR="$HOME/.local/bin"
# Build output lives beside the repo, never inside it (no binaries in git).
readonly OUT="$HOME/data/konbini-67_binaries/web"
DRY_RUN=0

ensure_butler() {
    command -v butler >/dev/null 2>&1 && return
    echo "Installing butler into $BIN_DIR..."
    local tmp
    tmp="$(mktemp -d)"
    curl -fsSL -o "$tmp/butler.zip" "$BUTLER_URL"
    unzip -q "$tmp/butler.zip" -d "$tmp"
    mkdir -p "$BIN_DIR"
    install -m 755 "$tmp/butler" "$BIN_DIR/butler"
    rm -rf "$tmp"
    butler --version
}

main() {
    [[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1
    ensure_butler
    if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]]; then
        echo "Error: uncommitted changes; publish a committed build only." >&2
        exit 1
    fi
    (cd "$REPO_ROOT" && pnpm exec vite build --outDir "$OUT" --emptyOutDir)
    uv run --no-project --with playwright python "$REPO_ROOT/tools/web_smoke.py" \
        "$OUT" --shot "$OUT/../web_smoke.png"
    local version
    version="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
    if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "dry run: would push $OUT to $TARGET as $version"
        return
    fi
    butler push "$OUT" "$TARGET" --userversion "$version"
    butler status "$TARGET"
}

main "$@"
