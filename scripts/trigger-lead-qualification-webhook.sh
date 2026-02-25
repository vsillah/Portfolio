#!/usr/bin/env bash
# Trigger the Lead Research and Qualifying Agent workflow (n8n) with a mock payload.
#
# Usage:
#   ./scripts/trigger-lead-qualification-webhook.sh
#   # Use the new prototype payload (richer B2B lead profile):
#   PAYLOAD_FILE=./scripts/lead-qualification-mock-payload-prototype.json ./scripts/trigger-lead-qualification-webhook.sh
#   # Or with custom URL:
#   N8N_LEAD_WEBHOOK_URL=https://n8n.example.com/webhook/your-id ./scripts/trigger-lead-qualification-webhook.sh
#   # Or switch base URL to n8n Cloud:
#   N8N_BASE_URL=https://your-workspace.app.n8n.cloud ./scripts/trigger-lead-qualification-webhook.sh
#
# The webhook path for this workflow is: b4bc3f71-8d92-4441-8f31-01118b85a610
# Production (webhook/): workflow must be ACTIVE; runs every time.
# Test (webhook-test/): requires "Listen for test event" in n8n; one-shot only.
#
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-lead-qualification-webhook.sh  # test mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/lead-qualification-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="b4bc3f71-8d92-4441-8f31-01118b85a610"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_SUFFIX="webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_SUFFIX="webhook/${WEBHOOK_PATH}"
fi
N8N_LEAD_WEBHOOK_URL="${N8N_LEAD_WEBHOOK_URL:-${N8N_BASE_URL}/${WEBHOOK_SUFFIX}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering Lead Qualification workflow..."
echo "URL: $N8N_LEAD_WEBHOOK_URL"
echo "Mode: $([[ -n "${USE_TEST_WEBHOOK}" ]] && echo "test (one-shot)" || echo "production (workflow must be active)")"
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

