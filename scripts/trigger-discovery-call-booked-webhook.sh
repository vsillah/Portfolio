#!/usr/bin/env bash
# Trigger WF-000A: Discovery Call Booked with a mock Calendly invitee.created payload.
#
# WF-000A uses a Calendly Trigger (OAuth). When active, n8n exposes a webhook that
# receives the same payload format Calendly sends. This script POSTs that format.
#
# Usage:
#   ./scripts/trigger-discovery-call-booked-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-discovery-call-booked-webhook.sh
#
# WF-000A uses a Calendly Trigger (OAuth) - Calendly pushes to n8n; no direct POST path.
# Use WF-CAL's calendly-webhook-router to simulate. WF-CAL must be ACTIVE.
# WF-CAL now executes WF-000A when routing discovery events.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/discovery-call-booked-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
# WF-CAL Calendly Webhook Router - receives Calendly events
WEBHOOK_PATH="calendly-webhook-router"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_SUFFIX="webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_SUFFIX="webhook/${WEBHOOK_PATH}"
fi
WEBHOOK_URL="${N8N_DISCOVERY_WEBHOOK_URL:-${N8N_BASE_URL}/${WEBHOOK_SUFFIX}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-000A: Discovery Call Booked..."
echo "URL: $WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/discovery-call-response.txt

echo "Response body:"
cat /tmp/discovery-call-response.txt
echo ""
