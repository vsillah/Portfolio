#!/usr/bin/env bash
# Trigger WF-001B: Onboarding Call Handler via WF-CAL Calendly Webhook Router.
#
# Usage:
#   ./scripts/trigger-onboarding-call-booked-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-onboarding-call-booked-webhook.sh
#
# WF-CAL routes atas-onboarding-call events to WF-001B. Both must be ACTIVE.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/onboarding-call-booked-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="calendly-webhook-router"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_SUFFIX="webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_SUFFIX="webhook/${WEBHOOK_PATH}"
fi
WEBHOOK_URL="${N8N_ONBOARDING_WEBHOOK_URL:-${N8N_BASE_URL}/${WEBHOOK_SUFFIX}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-001B: Onboarding Call Handler (via WF-CAL)..."
echo "URL: $WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/onboarding-call-response.txt

echo "Response body:"
cat /tmp/onboarding-call-response.txt
echo ""
