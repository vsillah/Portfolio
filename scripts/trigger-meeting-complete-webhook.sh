#!/usr/bin/env bash
# Send a test POST to the WF-MCH (Meeting Complete Handler) webhook.
#
# Usage:
#   ./scripts/trigger-meeting-complete-webhook.sh
#   # Or with custom URL (production):
#   N8N_MEETING_WEBHOOK_URL=https://n8n.amadutown.com/webhook/meeting-complete ./scripts/trigger-meeting-complete-webhook.sh
#
# Test URL (use when "Listen for test event" is active in n8n):
#   https://n8n.amadutown.com/webhook-test/meeting-complete

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/meeting-complete-mock-payload.json}"

# Default: test URL so the run appears in the n8n editor when listening
N8N_MEETING_WEBHOOK_URL="${N8N_MEETING_WEBHOOK_URL:-https://n8n.amadutown.com/webhook-test/meeting-complete}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Sending POST to Meeting Complete (WF-MCH)..."
echo "URL: $N8N_MEETING_WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$N8N_MEETING_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/meeting-complete-response.txt

echo "Response body:"
cat /tmp/meeting-complete-response.txt
echo ""
