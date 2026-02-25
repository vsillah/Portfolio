#!/usr/bin/env bash
# Trigger WF-TSK: Task Slack Sync — posts action items to Slack channels.
#
# Usage:
#   ./scripts/trigger-task-slack-sync-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-task-slack-sync-webhook.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/task-slack-sync-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="task-slack-sync"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_URL="${N8N_BASE_URL}/webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_URL="${N8N_BASE_URL}/webhook/${WEBHOOK_PATH}"
fi

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-TSK: Task Slack Sync..."
echo "URL: $WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/task-slack-sync-response.txt

echo "Response body:"
cat /tmp/task-slack-sync-response.txt
echo ""
