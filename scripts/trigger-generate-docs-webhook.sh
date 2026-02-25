#!/usr/bin/env bash
# Trigger WF-011: Documentation Generation — generates project handoff docs.
#
# Usage:
#   ./scripts/trigger-generate-docs-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-generate-docs-webhook.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/generate-docs-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="generate-docs"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_URL="${N8N_BASE_URL}/webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_URL="${N8N_BASE_URL}/webhook/${WEBHOOK_PATH}"
fi

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-011: Documentation Generation..."
echo "URL: $WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/generate-docs-response.txt

echo "Response body:"
cat /tmp/generate-docs-response.txt
echo ""
