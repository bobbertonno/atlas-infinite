#!/usr/bin/env bash
# Atlas Infinite Experience Lab — one-command macOS launcher.
#
#   ./scripts/launch-mac.sh            Build and run a local production server
#   ./scripts/launch-mac.sh --dev      Run the hot-reloading development server
#   ./scripts/launch-mac.sh --vercel   Build locally, then deploy to Vercel (production)
#   PORT=4000 ./scripts/launch-mac.sh  Use a different port (default 3000)

set -euo pipefail

MODE="local"
case "${1:-}" in
  --dev) MODE="dev" ;;
  --vercel) MODE="vercel" ;;
  -h|--help) sed -n 2,8p "$0"; exit 0 ;;
  "") ;;
  *) echo "Unknown option: $1 (use --help)"; exit 1 ;;
esac

PORT="${PORT:-3000}"
MIN_NODE_MAJOR=20
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
step() { printf "\n\033[1;32m==>\033[0m \033[1m%s\033[0m\n" "$1"; }
warn() { printf "\033[1;33m!!\033[0m %s\n" "$1"; }
fail() { printf "\033[1;31mxx\033[0m %s\n" "$1"; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || warn "This script targets macOS; continuing anyway."

step "Checking Node.js (>= ${MIN_NODE_MAJOR})"
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    bold "Node.js not found — installing with Homebrew..."
    brew install node
  else
    fail "Node.js is not installed. Install Homebrew (https://brew.sh) then run: brew install node — or download Node LTS from https://nodejs.org"
  fi
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < MIN_NODE_MAJOR )); then
  fail "Node.js $(node -v) is too old. Upgrade with: brew upgrade node (or install the LTS from nodejs.org)."
fi
echo "Node $(node -v)"

step "Checking pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1; then
    echo "Enabled pnpm via Corepack."
  else
    bold "Installing pnpm globally with npm..."
    npm install -g pnpm
  fi
fi
echo "pnpm $(pnpm -v)"

step "Preparing environment (.env.local)"
ENV_FILE="$ROOT/.env.local"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
if ! grep -q '^ATLAS_LAB_SECRET=' "$ENV_FILE"; then
  echo "ATLAS_LAB_SECRET=$(openssl rand -base64 32)" >> "$ENV_FILE"
  echo "Generated a new ATLAS_LAB_SECRET (stored only in .env.local, git-ignored)."
else
  echo "Using existing ATLAS_LAB_SECRET from .env.local."
fi

step "Installing dependencies"
pnpm install --frozen-lockfile || {
  warn "Frozen install failed (lockfile drift). Retrying with a regular install..."
  pnpm install
}

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "Port $PORT is already in use. Stop that process or rerun with PORT=<other> $0"
fi

open_browser() {
  ( for _ in $(seq 1 60); do
      if curl -fs "http://localhost:$PORT" >/dev/null 2>&1; then open "http://localhost:$PORT" 2>/dev/null || true; exit 0; fi
      sleep 1
    done ) &
}

case "$MODE" in
  dev)
    step "Starting development server on http://localhost:$PORT"
    open_browser
    exec pnpm exec next dev -p "$PORT"
    ;;
  local)
    step "Building production bundle"
    pnpm build
    step "Starting production server on http://localhost:$PORT (Ctrl+C to stop)"
    open_browser
    exec pnpm exec next start -p "$PORT"
    ;;
  vercel)
    step "Building production bundle (sanity check)"
    pnpm build
    step "Deploying to Vercel"
    if ! command -v vercel >/dev/null 2>&1; then
      bold "Installing the Vercel CLI..."
      npm install -g vercel
    fi
    vercel whoami >/dev/null 2>&1 || vercel login
    [[ -f .vercel/project.json ]] || vercel link
    if ! vercel env ls production 2>/dev/null | grep -q ATLAS_LAB_SECRET; then
      bold "Adding ATLAS_LAB_SECRET to the Vercel production environment..."
      grep '^ATLAS_LAB_SECRET=' "$ENV_FILE" | cut -d= -f2- | vercel env add ATLAS_LAB_SECRET production
    fi
    vercel deploy --prod
    ;;
esac
