#!/usr/bin/env bash
# Trigger the Lead Research and Qualifying Agent workflow (n8n) with a mock payload.
#
# Usage:
#   ./scripts/trigger-lead-qualification-webhook.sh
#   # Use the new prototype payload (richer B2B lead profile):
#   PAYLOAD_FILE=./scripts/lead-qualification-mock-payload-prototype.json ./scripts/trigger-lead-qualification-webhook.sh
#   # Or with custom URL:
#   N8N_LEAD_WEBHOOK_URL=https://n8n.example.com/webhook/your-id ./scripts/trigger-lead-qualification-webhook.sh
#
# The webhook path for this workflow is: b4bc3f71-8d92-4441-8f31-01118b85a610
# Full URL is typically: https://n8n.amadutown.com/webhook-test/... (test) or webhook/... (production)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/lead-qualification-mock-payload.json}"

# Use env or default to AmaduTown n8n lead webhook
N8N_LEAD_WEBHOOK_URL="${N8N_LEAD_WEBHOOK_URL:-https://n8n.amadutown.com/webhook/b4bc3f71-8d92-4441-8f31-01118b85a610}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering Lead Qualification workflow..."
echo "URL: $N8N_LEAD_WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$N8N_LEAD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/lead-webhook-response.txt

echo "Response body:"
cat /tmp/lead-webhook-response.txt
echo ""
