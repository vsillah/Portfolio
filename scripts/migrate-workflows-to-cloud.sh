#!/usr/bin/env bash
# Migrate workflows from local n8n to n8n Cloud via API.
# Reads workflow JSON files from n8n-exports/ and POSTs them to n8n Cloud.
#
# Usage:
#   ./scripts/migrate-workflows-to-cloud.sh
#
# Requires:
#   - N8N_CLOUD_API_KEY env var (or set in .env.local)
#   - Workflow JSON files in n8n-exports/ (exported via n8n MCP or UI)
#   - curl, python3

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXPORTS_DIR="${PROJECT_DIR}/n8n-exports"
CLOUD_BASE_URL="https://amadutown.app.n8n.cloud/api/v1"

# Load API key from .env.local if not already set
if [[ -z "${N8N_CLOUD_API_KEY:-}" ]]; then
  if [[ -f "${PROJECT_DIR}/.env.local" ]]; then
    N8N_CLOUD_API_KEY=$(grep '^N8N_CLOUD_API_KEY=' "${PROJECT_DIR}/.env.local" | cut -d= -f2-)
  fi
fi

if [[ -z "${N8N_CLOUD_API_KEY:-}" ]]; then
  echo "ERROR: N8N_CLOUD_API_KEY not set. Add it to .env.local or export it."
  exit 1
fi

echo "=== n8n Workflow Migration: Local → Cloud ==="
echo "Cloud API: ${CLOUD_BASE_URL}"
echo "Exports dir: ${EXPORTS_DIR}"
echo ""

SUCCESS=0
FAILED=0
SKIPPED=0

for json_file in "${EXPORTS_DIR}"/*.json; do
  filename=$(basename "$json_file")

  # Skip manifest.json
  if [[ "$filename" == "manifest.json" ]]; then
    continue
  fi

  workflow_name=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
print(data.get('name', 'Unknown'))
" "$json_file" 2>/dev/null || echo "Unknown")

  echo "Importing: ${workflow_name} (${filename})..."

  # Clean the workflow JSON for import -- n8n Cloud API is strict about allowed fields
  cleaned=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)

clean = {
    'name': data.get('name', 'Unnamed Workflow'),
    'nodes': data.get('nodes', []),
    'connections': data.get('connections', {}),
    'settings': {'executionOrder': data.get('settings', {}).get('executionOrder', 'v1')}
}

print(json.dumps(clean))
" "$json_file" 2>/dev/null)

  if [[ -z "$cleaned" ]]; then
    echo "  SKIP: Could not parse ${filename}"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # POST to n8n Cloud
  http_code=$(curl -s -o /tmp/n8n-import-response.txt -w "%{http_code}" \
    -X POST "${CLOUD_BASE_URL}/workflows" \
    -H "X-N8N-API-KEY: ${N8N_CLOUD_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$cleaned")

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    cloud_id=$(python3 -c "
import json
with open('/tmp/n8n-import-response.txt') as f:
    data = json.load(f)
print(data.get('id', 'unknown'))
" 2>/dev/null || echo "unknown")
    echo "  OK (cloud id: ${cloud_id})"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  FAIL (HTTP ${http_code})"
    cat /tmp/n8n-import-response.txt 2>/dev/null | head -3
    echo ""
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "=== Migration Complete ==="
echo "Success: ${SUCCESS}"
echo "Failed:  ${FAILED}"
echo "Skipped: ${SKIPPED}"
