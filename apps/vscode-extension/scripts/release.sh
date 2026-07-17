#!/usr/bin/env bash
#
# Build, verify and publish the Envault VS Code extension.
#
# Usage:
#   scripts/release.sh                 # verify + package a local .vsix (no publish)
#   scripts/release.sh pre             # publish to the PRE-RELEASE channel
#   scripts/release.sh stable          # publish to the STABLE channel
#   scripts/release.sh pre patch       # bump patch, then publish pre-release
#   scripts/release.sh pre 0.3.1       # set explicit version, then publish pre-release
#
# Version arg accepts an explicit SemVer (0.3.1) or an increment (major|minor|patch).
# Pre-release builds should use an ODD minor (0.3.x, 0.5.x); stable an EVEN minor.
#
# Auth (publish only): set a Marketplace token via `export VSCE_PAT=xxxx`,
# or run `pnpm exec vsce login envault` once beforehand.

set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-package}"     # package | pre | stable
VERSION="${2:-}"         # optional: explicit version or increment

# Use the repo-pinned Node version when nvm is present.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null 2>&1 || true
fi

echo "▶ Verifying (lint, typecheck, test, build)…"
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build

# Assemble vsce arguments.
ARGS=(--no-dependencies)
case "$MODE" in
  package)  VERB="package"; ;;
  pre)      VERB="publish"; ARGS+=(--pre-release); ;;
  stable)   VERB="publish"; ARGS+=(); ;;
  *) echo "Unknown mode: '$MODE' (use: package | pre | stable)" >&2; exit 1 ;;
esac

# `package` cannot take a version increment; only `publish` bumps package.json.
if [ -n "$VERSION" ]; then
  if [ "$VERB" = "package" ]; then
    echo "Version bumping is only supported when publishing (pre|stable)." >&2
    exit 1
  fi
  ARGS+=("$VERSION")
fi

CURRENT_VERSION="$(node -p "require('./package.json').version")"

if [ "$VERB" = "package" ]; then
  echo "▶ Packaging local .vsix (v${CURRENT_VERSION}, pre-release layout)…"
  pnpm exec vsce package --pre-release "${ARGS[@]}"
  echo "✔ Packaged. Install locally with: code --install-extension envault-vscode-${CURRENT_VERSION}.vsix"
  exit 0
fi

if [ -z "${VSCE_PAT:-}" ]; then
  echo "ℹ VSCE_PAT is not set — vsce will use a saved 'vsce login envault' session if available."
fi

echo "▶ Publishing to '${MODE}' channel…"
pnpm exec vsce "$VERB" "${ARGS[@]}"
echo "✔ Published. Marketplace propagation and client auto-update can take a few minutes."
