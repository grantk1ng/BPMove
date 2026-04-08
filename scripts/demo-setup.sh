#!/bin/bash
#
# demo-setup.sh — Clean-slate setup for BPMove demo
#
# Run this on a clean clone or before demo day to ensure
# a reproducible build environment. Tests on a fresh state.
#
# Usage: ./scripts/demo-setup.sh [--skip-tests]
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[demo-setup]${NC} $1"; }
warn()  { echo -e "${YELLOW}[demo-setup]${NC} $1"; }
error() { echo -e "${RED}[demo-setup]${NC} $1"; }

SKIP_TESTS=false
if [[ "${1:-}" == "--skip-tests" ]]; then
  SKIP_TESTS=true
fi

cd "$(dirname "$0")/.."

# --- 1. Kill existing Metro bundler ---
info "Killing existing Metro processes..."
pkill -f "react-native.*start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

# --- 2. Clear caches ---
info "Clearing watchman watches..."
watchman watch-del-all 2>/dev/null || warn "watchman not running (ok)"

info "Clearing Metro cache..."
rm -rf /tmp/metro-* 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

info "Clearing React Native temp files..."
rm -rf /tmp/react-* 2>/dev/null || true

# --- 3. Reinstall JS dependencies ---
info "Installing node_modules (frozen lockfile)..."
npm ci --frozen-lockfile

# --- 4. iOS: reinstall pods ---
if [[ -d "ios" ]]; then
  info "Installing CocoaPods..."
  cd ios
  bundle install --quiet 2>/dev/null || warn "bundle install failed — is bundler installed?"
  bundle exec pod install
  cd ..
  info "CocoaPods installed."
else
  warn "No ios/ directory found — skipping pod install."
fi

# --- 5. Check .env ---
if [[ ! -f ".env" ]]; then
  warn ".env file not found! Spotify provider will fall back to local tracks."
  warn "Copy .env.example → .env and fill in keys if you want Spotify."
else
  info ".env file found."
fi

# --- 6. Run tests ---
if [[ "$SKIP_TESTS" == false ]]; then
  info "Running unit tests..."
  npm test

  info "Running demo smoke test..."
  npx jest --testPathPattern=demo-smoke --verbose
else
  warn "Skipping tests (--skip-tests flag)."
fi

# --- 7. Verify iOS bundle compiles ---
info "Verifying iOS bundle compiles..."
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output /tmp/main.jsbundle \
  --quiet 2>/dev/null || {
    error "iOS bundle failed! Fix import/bundler errors before demo."
    exit 1
  }
info "iOS bundle compiled successfully."

# --- Done ---
echo ""
info "============================================"
info "  Demo setup complete!"
info "  Next: npm start, then npm run ios"
info "============================================"
