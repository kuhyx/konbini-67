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
    # pnpm, not npm, is the package manager here: this project depends on
    # @kuhyx/ts-core, a subdirectory of the kuhyx/utils monorepo, and npm
    # cannot install a subdirectory of a git repo -- it ignores the `&path:`
    # key and fails looking for package.json at the repo root.
    ensure_pacman_pkg pnpm pnpm
    # run.sh probes the preview server over HTTP; bash's /dev/tcp only resolves
    # the first getaddrinfo result and misses vite's IPv6-only bind.
    ensure_pacman_pkg curl curl

    if [[ -f pnpm-lock.yaml ]]; then
        log "pnpm install --frozen-lockfile"
        pnpm install --frozen-lockfile
    else
        log "pnpm install"
        pnpm install
    fi

    log "done"
}

main "$@"
