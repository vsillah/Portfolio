#!/usr/bin/env bash
# Send a test POST to the ATAS Onboarding Plan Email Delivery webhook.
#
# Usage:
#   ./scripts/trigger-onboarding-plan-email-webhook.sh
#   # Or with custom URL (production):
#   N8N_ONBOARDING_WEBHOOK_URL=https://amadutown.app.n8n.cloud/webhook/onboarding-plan-email ./scripts/trigger-onboarding-plan-email-webhook.sh
#
# Test URL (use when "Listen for test event" is active in n8n):
#   https://amadutown.app.n8n.cloud/webhook-test/onboarding-plan-email

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/onboarding-plan-email-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="onboarding-plan-email"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_URL="${N8N_BASE_URL}/webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_URL="${N8N_BASE_URL}/webhook/${WEBHOOK_PATH}"
fi
N8N_ONBOARDING_WEBHOOK_URL="${N8N_ONBOARDING_WEBHOOK_URL:-${WEBHOOK_URL}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Sending POST to Onboarding Plan Email (ATAS)..."
echo "URL: $N8N_ONBOARDING_WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$N8N_ONBOARDING_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/onboarding-plan-email-response.txt

echo "Response body:"
cat /tmp/onboarding-plan-email-response.txt
echo ""
