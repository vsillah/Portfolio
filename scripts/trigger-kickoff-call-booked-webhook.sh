#!/usr/bin/env bash
# Trigger WF-002: Kickoff Call Scheduled via WF-CAL Calendly Webhook Router.
#
# Usage:
#   ./scripts/trigger-kickoff-call-booked-webhook.sh
#   USE_TEST_WEBHOOK=1 ./scripts/trigger-kickoff-call-booked-webhook.sh
#
# Prereq: Seed a client_project with client_email test-kickoff@example.com and
#   project_status onboarding_completed (see scripts/seed-kickoff-test-client-project.sql).
# WF-CAL routes atas-kick-off-meeting events to WF-002. Both must be ACTIVE.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD_FILE="${PAYLOAD_FILE:-${SCRIPT_DIR}/kickoff-call-booked-mock-payload.json}"

N8N_BASE_URL="${N8N_BASE_URL:-https://amadutown.app.n8n.cloud}"
WEBHOOK_PATH="calendly-webhook-router"
if [[ -n "${USE_TEST_WEBHOOK}" ]]; then
  WEBHOOK_SUFFIX="webhook-test/${WEBHOOK_PATH}"
else
  WEBHOOK_SUFFIX="webhook/${WEBHOOK_PATH}"
fi
WEBHOOK_URL="${N8N_KICKOFF_WEBHOOK_URL:-${N8N_BASE_URL}/${WEBHOOK_SUFFIX}}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "Payload file not found: $PAYLOAD_FILE"
  exit 1
fi

echo "Triggering WF-002: Kickoff Call Scheduled (via WF-CAL)..."
echo "URL: $WEBHOOK_URL"
echo "Payload: $PAYLOAD_FILE"
echo ""

curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d @"$PAYLOAD_FILE" \
  -w "\nHTTP status: %{http_code}\n" \
  -o /tmp/kickoff-call-response.txt

echo "Response body:"
cat /tmp/kickoff-call-response.txt
echo ""
