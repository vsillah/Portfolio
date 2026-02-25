#!/usr/bin/env bash
# Trigger WF-000: Inbound Lead Intake with a mock LinkedIn DM payload.
#
# Usage:
#   ./scripts/trigger-inbound-lead-webhook.sh
#   # Or with custom URL:
#   N8N_INBOUND_WEBHOOK_URL=https://n8n.example.com/webhook/inbound-lead ./scripts/trigger-inbound-lead-webhook.sh
#
# Webhook path: inbound-lead
# Production: ${N8N_BASE_URL}/webhook/inbound-lead
# Test: ${N8N_BASE_URL}/webhook-test/inbound-lead (requires "Listen for test event")
#
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-inbound-lead-webhook.sh  # test mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/inbound-lead-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="inbound-lead"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_SUFFIX="webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_SUFFIX="webhook/${WEBHOOK_PATH}"
fi
N8N_INBOUND_WEBHOOK_URL="${N8N_INBOUND_WEBHOOK_URL:-${N8N_BASE_URL}/${WEBHOOK_SUFFIX}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-000: Inbound Lead Intake..."
echo "URL: $N8N_INBOUND_WEBHOOK_URL"
echo "Mode: $([[ -n "${USE_TEST_WEBHOOK}" ]] && echo "test (one-shot)" || echo "production (workflow must be active)")"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$N8N_INBOUND_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/inbound-lead-response.txt

echo "Response body:"
cat /tmp/inbound-lead-response.txt
echo ""
