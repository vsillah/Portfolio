#!/bin/bash
# Verify a template can build standalone (simulates what a spin-off repo would contain).
#
# Usage:
#   ./scripts/verify-spinoff-standalone.sh <template-path>
#   ./scripts/verify-spinoff-standalone.sh --all
#
# Examples:
#   ./scripts/verify-spinoff-standalone.sh client-templates/chatbot-template
#   ./scripts/verify-spinoff-standalone.sh --all

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

verify_template() {
  local TEMPLATE_PATH="$1"

  if [ ! -d "$TEMPLATE_PATH" ]; then
    echo "ERROR: Directory '$TEMPLATE_PATH' does not exist."
    return 1
  fi

  local TEMPLATE_NAME
  TEMPLATE_NAME=$(basename "$TEMPLATE_PATH")
  local WORK_DIR
  WORK_DIR=$(mktemp -d)

  echo "=== Verifying standalone build: $TEMPLATE_NAME ==="
  echo "  Source: $TEMPLATE_PATH"
  echo "  Temp dir: $WORK_DIR"
  echo ""

  echo "[1/4] Copying template to temp directory..."
  cp -R "$TEMPLATE_PATH"/* "$WORK_DIR"/
  cp -R "$TEMPLATE_PATH"/.env.example "$WORK_DIR"/ 2>/dev/null || true

  echo "[2/4] Checking required files..."
  local MISSING=0
  for f in package.json tsconfig.json next.config.js tailwind.config.ts postcss.config.js app/layout.tsx app/page.tsx app/globals.css; do
    if [ ! -f "$WORK_DIR/$f" ]; then
      echo "  MISSING: $f"
      MISSING=1
    fi
  done
  if [ "$MISSING" -eq 1 ]; then
    echo ""
    echo "FAIL: Missing required files. Template is not standalone-ready."
    rm -rf "$WORK_DIR"
    return 1
  fi
  echo "  All required files present."

  echo "[3/4] Running npm install..."
  (
    cd "$WORK_DIR"

    cat > .env.local <<'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key
ENVEOF

    npm install --loglevel=error 2>&1

    echo "[4/4] Running npm run build..."
    npm run build 2>&1
  )
  local BUILD_EXIT=$?

  rm -rf "$WORK_DIR"

  if [ "$BUILD_EXIT" -ne 0 ]; then
    echo ""
    echo "=== FAIL: $TEMPLATE_NAME standalone build failed ==="
    return 1
  fi

  echo ""
  echo "=== PASS: $TEMPLATE_NAME builds standalone ==="
  return 0
}

if [ "$1" = "--all" ]; then
  PASSED=0
  FAILED=0
  FAILED_NAMES=""

  for pkg in "$PROJECT_ROOT"/client-templates/*/package.json; do
    TDIR=$(dirname "$pkg")
    TNAME=$(basename "$TDIR")
    # Skip shared utilities directory
    if [ "$TNAME" = "shared" ]; then continue; fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if verify_template "$TDIR"; then
      PASSED=$((PASSED + 1))
    else
      FAILED=$((FAILED + 1))
      FAILED_NAMES="$FAILED_NAMES $TNAME"
    fi
  done

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "SUMMARY: $PASSED passed, $FAILED failed"
  if [ "$FAILED" -gt 0 ]; then
    echo "  Failed:$FAILED_NAMES"
    exit 1
  fi
  exit 0
fi

if [ -z "$1" ]; then
  echo "Usage: $0 <template-path>"
  echo "       $0 --all"
  echo ""
  echo "  e.g. $0 client-templates/chatbot-template"
  echo "       $0 --all   (verify all templates)"
  exit 1
fi

verify_template "$1"
