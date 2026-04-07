#!/usr/bin/env bash
# Send a test POST to WF-DIAG-COMP (Diagnostic Completion → Slack + JSON response).
#
# Usage:
#   ./scripts/trigger-diagnostic-completion-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-diagnostic-completion-webhook.sh   # n8n "Listen for test event"
#   N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL=https://... ./scripts/trigger-diagnostic-completion-webhook.sh
#
# Payload: scripts/diagnostic-completion-mock-payload.json (override with PAYLOAD_FILE=...)
#
# Production URL (n8n Cloud):
#   https://amadutown.app.n8n.cloud/webhook/diagnostic-completion

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/diagnostic-completion-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="diagnostic-completion"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_URL="${N8N_BASE_URL}/webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_URL="${N8N_BASE_URL}/webhook/${WEBHOOK_PATH}"
fi
N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL="${N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL:-${WEBHOOK_URL}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Sending POST to WF-DIAG-COMP..."
echo "URL: $N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$N8N_DIAGNOSTIC_COMPLETION_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/diagnostic-completion-response.txt

echo "Response body:"
cat /tmp/diagnostic-completion-response.txt
echo ""
