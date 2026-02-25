#!/usr/bin/env bash
# Trigger WF-007: Automated Progress Updates — wake webhook to run on demand.
#
# WF-007 runs on a daily schedule, but also exposes a wake webhook for manual triggers.
#
# Usage:
#   ./scripts/trigger-progress-updates-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-progress-updates-webhook.sh

set -e

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="wake-wf007-progress"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_URL="${N8N_BASE_URL}/webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_URL="${N8N_BASE_URL}/webhook/${WEBHOOK_PATH}"
fi

echo "Triggering WF-007: Automated Progress Updates (wake)..."
echo "URL: $WEBHOOK_URL"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual_wake", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"}' \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/progress-updates-response.txt

echo "Response body:"
cat /tmp/progress-updates-response.txt
echo ""
