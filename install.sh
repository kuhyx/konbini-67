#!/bin/bash

# ============================================================================
# Installs the toolchain and dependencies for 6/7 (konbini-67).
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

log() {
    echo "==> $*"
}

# Installs a pacman package if its binary is missing.
ensure_pacman_pkg() {
    local binary="$1" package="$2"
    if command -v "$binary" >/dev/null 2>&1; then
        return 0
    fi
    log "installing $package"
    if ! sudo pacman -S --needed --noconfirm "$package"; then
        echo "Error: could not install $package. Run manually: sudo pacman -S $package" >&2
        exit 1
    fi
}

main() {
    cd "$SCRIPT_DIR"

    ensure_pacman_pkg node nodejs
    ensure_pacman_pkg npm npm

    if [[ -f package-lock.json ]]; then
        log "npm ci"
        npm ci
    else
        log "npm install"
        npm install
    fi

    log "done"
}

main "$@"
