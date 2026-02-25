#!/usr/bin/env bash
# Trigger WF-000B: Discovery Session Complete with a mock Read.ai webhook payload.
#
# WF-000B uses a Webhook trigger (POST /discovery-session-complete).
# This script POSTs a Read.ai-style meeting payload.
#
# Usage:
#   ./scripts/trigger-discovery-session-complete-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-discovery-session-complete-webhook.sh
#
# Prerequisite: A sales_session must exist for client_email (test-discovery@example.com).
# Run ./scripts/trigger-discovery-call-booked-webhook.sh first to create one via WF-000A.
#
# WF-000B must be ACTIVE for the webhook to respond.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/discovery-session-complete-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="discovery-session-complete"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_SUFFIX="webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_SUFFIX="webhook/${WEBHOOK_PATH}"
fi
WEBHOOK_URL="${N8N_DISCOVERY_SESSION_WEBHOOK_URL:-${N8N_BASE_URL}/${WEBHOOK_SUFFIX}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-000B: Discovery Session Complete..."
echo "URL: $WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/discovery-session-response.txt

echo "Response body:"
cat /tmp/discovery-session-response.txt
echo ""
