#!/bin/bash

# ============================================================================
# 6/7 (konbini-67) — build, check, and play.
#
#   ./run.sh          build and open the game in a browser (default)
#   ./run.sh dev      vite dev server with hot reload
#   ./run.sh check    typecheck + lint + tests at 100% coverage
#   ./run.sh build    production build only
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly PORT=4173
PREVIEW_PID=""

log() {
    echo "==> $*"
}

cleanup() {
    if [[ -n "$PREVIEW_PID" ]] && kill -0 "$PREVIEW_PID" 2>/dev/null; then
        kill "$PREVIEW_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Installs dependencies on first run.
ensure_deps() {
    if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
        log "node_modules missing, running install.sh"
        "$SCRIPT_DIR/install.sh"
    fi
}

# Waits for the preview server to accept connections, without needing curl.
wait_for_port() {
    local attempts=0
    while ((attempts < 100)); do
        if (echo >"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
            return 0
        fi
        sleep 0.1
        ((attempts += 1))
    done
    echo "Error: preview server did not come up on port $PORT" >&2
    return 1
}

play() {
    log "building"
    npm run build
    log "serving on http://localhost:$PORT"
    npm run preview -- --port "$PORT" --strictPort &
    PREVIEW_PID=$!
    wait_for_port
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true
    fi
    log "serving — Ctrl-C to stop"
    wait "$PREVIEW_PID"
}

main() {
    cd "$SCRIPT_DIR"
    ensure_deps

    case "${1:-play}" in
    play)
        play
        ;;
    dev)
        npm run dev
        ;;
    check)
        npm run check
        ;;
    build)
        npm run build
        ;;
    *)
        echo "Usage: $0 [play|dev|check|build]" >&2
        exit 1
        ;;
    esac
}

main "$@"
