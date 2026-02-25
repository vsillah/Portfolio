#!/usr/bin/env bash
# Trigger the ReversR Beta Tester Intake form workflow (n8n) with a mock payload.
#
# Usage:
#   ./scripts/trigger-reversr-intake-webhook.sh
#   # Or with custom URL:
#   N8N_REVERSR_WEBHOOK_URL=https://n8n.example.com/webhook/your-id ./scripts/trigger-reversr-intake-webhook.sh
#
# Webhook path: 53e16572-06e1-476d-a261-7db59d996d53
# Production: ${N8N_BASE_URL}/webhook/...
# Test: ${N8N_BASE_URL}/webhook-test/... (requires "Listen for test event")
#
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-reversr-intake-webhook.sh  # test mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/reversr-intake-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="53e16572-06e1-476d-a261-7db59d996d53"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_SUFFIX="webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_SUFFIX="webhook/${WEBHOOK_PATH}"
fi
N8N_REVERSR_WEBHOOK_URL="${N8N_REVERSR_WEBHOOK_URL:-${N8N_BASE_URL}/${WEBHOOK_SUFFIX}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

# Inject current UTC timestamp into payload (overwrites submittedAt from file)
NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
if command -v jq >/dev/null 2>&1; then
  PAYLOAD=$(jq --arg ts "$NOW_UTC" '.submittedAt = $ts' "$PAYLOAD_FILE")
elif command -v python3 >/dev/null 2>&1; then
  PAYLOAD=$(python3 -c "
import json, sys
from datetime import datetime, timezone
with open(sys.argv[1]) as f:
    p = json.load(f)
p['submittedAt'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
print(json.dumps(p))
" "$PAYLOAD_FILE")
else
  PAYLOAD=$(cat "$PAYLOAD_FILE")
  echo "Note: jq/python3 not found; using submittedAt from payload file"
fi

echo "Triggering ReversR Beta Tester Intake workflow..."
echo "URL: $N8N_REVERSR_WEBHOOK_URL"
echo "Mode: $([[ -n "${USE_TEST_WEBHOOK}" ]] && echo "test (one-shot)" || echo "production (workflow must be active)")"
echo "Payload: $PAYLOAD_FILE"
echo ""

printf '%s' "$PAYLOAD" | curl -s -X POST "$N8N_REVERSR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @- \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/reversr-webhook-response.txt

echo "Response body:"
cat /tmp/reversr-webhook-response.txt
echo ""
