#!/bin/bash
# Verify a template can build standalone (simulates what a spin-off repo would contain).
# Usage: ./scripts/verify-spinoff-standalone.sh <template-path>
# Example: ./scripts/verify-spinoff-standalone.sh client-templates/chatbot-template

set -e

TEMPLATE_PATH="$1"

if [ -z "$TEMPLATE_PATH" ]; then
  echo "Usage: $0 <template-path>"
  echo "  e.g. $0 client-templates/chatbot-template"
  exit 1
fi

if [ ! -d "$TEMPLATE_PATH" ]; then
  echo "ERROR: Directory '$TEMPLATE_PATH' does not exist."
  exit 1
fi

TEMPLATE_NAME=$(basename "$TEMPLATE_PATH")
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "=== Verifying standalone build: $TEMPLATE_NAME ==="
echo "  Source: $TEMPLATE_PATH"
echo "  Temp dir: $TMPDIR"
echo ""

echo "[1/4] Copying template to temp directory..."
cp -R "$TEMPLATE_PATH"/* "$TMPDIR"/
cp -R "$TEMPLATE_PATH"/.env.example "$TMPDIR"/ 2>/dev/null || true

echo "[2/4] Checking required files..."
MISSING=0
for f in package.json tsconfig.json next.config.js tailwind.config.ts postcss.config.js app/layout.tsx app/page.tsx app/globals.css; do
  if [ ! -f "$TMPDIR/$f" ]; then
    echo "  MISSING: $f"
    MISSING=1
  fi
done
if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "FAIL: Missing required files. Template is not standalone-ready."
  exit 1
fi
echo "  All required files present."

echo "[3/4] Running npm install..."
cd "$TMPDIR"

# Create a minimal .env.local so the build doesn't crash on missing env vars
cat > .env.local <<'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key
ENVEOF

npm install --loglevel=error 2>&1

echo "[4/4] Running npm run build..."
npm run build 2>&1

echo ""
echo "=== PASS: $TEMPLATE_NAME builds standalone ==="
