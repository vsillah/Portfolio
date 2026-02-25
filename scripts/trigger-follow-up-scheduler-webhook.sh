#!/usr/bin/env bash
# Trigger WF-FUP: Follow-Up Meeting Scheduler — schedules a follow-up meeting.
#
# Usage:
#   ./scripts/trigger-follow-up-scheduler-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-follow-up-scheduler-webhook.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/follow-up-scheduler-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="follow-up-scheduler"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_URL="${N8N_BASE_URL}/webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_URL="${N8N_BASE_URL}/webhook/${WEBHOOK_PATH}"
fi

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-FUP: Follow-Up Meeting Scheduler..."
echo "URL: $WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/follow-up-scheduler-response.txt

echo "Response body:"
cat /tmp/follow-up-scheduler-response.txt
echo ""
