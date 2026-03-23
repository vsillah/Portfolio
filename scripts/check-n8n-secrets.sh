#!/bin/bash
# Fail if n8n workflow exports contain raw secrets or unfilled placeholders.
# Run before committing n8n-exports/ changes.

set -euo pipefail

EXPORTS_DIR="$(dirname "$0")/../n8n-exports"
EXIT_CODE=0

echo "Checking n8n exports for secrets and placeholders..."

# Pattern 1: REPLACE_WITH_* placeholders (should be filled or removed)
if rg -l 'REPLACE_WITH_' "$EXPORTS_DIR"/*.json 2>/dev/null; then
  echo ""
  echo "ERROR: Found REPLACE_WITH_* placeholders in n8n exports."
  echo "       Replace these with \$env.VAR_NAME references in the n8n editor."
  EXIT_CODE=1
fi

# Pattern 2: Hardcoded Bearer tokens that look like real API keys
if rg -l '"value":\s*"=?Bearer [A-Za-z0-9_-]{20,}"' "$EXPORTS_DIR"/*.json 2>/dev/null | \
   rg -v 'REPLACE_WITH_|API_KEY|\{\{' 2>/dev/null; then
  echo ""
  echo "WARNING: Possible hardcoded Bearer tokens found."
  echo "         Verify these are placeholders, not real keys."
  EXIT_CODE=1
fi

# Pattern 3: Hardcoded N8N_INGEST_SECRET values (not $env references)
if rg -l 'N8N_INGEST_SECRET.*[a-f0-9]{16,}' "$EXPORTS_DIR"/*.json 2>/dev/null; then
  echo ""
  echo "ERROR: Hardcoded N8N_INGEST_SECRET value found."
  echo "       Use \$env.N8N_INGEST_SECRET in n8n Code nodes instead."
  EXIT_CODE=1
fi

# Pattern 4: Stripe secret keys (sk_live_ or sk_test_ with long suffix)
if rg -l 'sk_(live|test)_[A-Za-z0-9]{20,}' "$EXPORTS_DIR"/*.json 2>/dev/null; then
  echo ""
  echo "ERROR: Stripe secret key found in n8n exports."
  EXIT_CODE=1
fi

# Pattern 5: Supabase service role keys (sbp_ or eyJ... JWT patterns)
if rg -l '"(sbp_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{100,})"' "$EXPORTS_DIR"/*.json 2>/dev/null; then
  echo ""
  echo "WARNING: Possible Supabase service role key or JWT in exports."
  EXIT_CODE=1
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "Clean — no secrets or placeholders found."
fi

exit $EXIT_CODE
