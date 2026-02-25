#!/usr/bin/env bash
# Update existing n8n Cloud workflows from local export JSON files.
# Matches by workflow name and PUTs updated nodes/connections/settings.
#
# Usage:
#   ./scripts/update-cloud-workflows-from-exports.sh
#   # Dry run (show what would be updated):
#   DRY_RUN=1 ./scripts/update-cloud-workflows-from-exports.sh
#
# Requires:
#   - N8N_CLOUD_API_KEY env var (or in .env.local)
#   - Workflow JSON files in n8n-exports/
#   - curl, python3

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXPORTS_DIR="${PROJECT_DIR}/n8n-exports"
CLOUD_BASE_URL="https://amadutown.app.n8n.cloud/api/v1"
DRY_RUN="${DRY_RUN:-0}"

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

echo "=== Update n8n Cloud Workflows from Exports ==="
echo "Cloud API: ${CLOUD_BASE_URL}"
echo "Exports dir: ${EXPORTS_DIR}"
[[ "$DRY_RUN" == "1" ]] && echo "DRY RUN (no changes will be made)"
echo ""

# Fetch all Cloud workflows
echo "Fetching workflows from n8n Cloud..."
curl -s -o /tmp/n8n-cloud-workflows.json \
  -H "X-N8N-API-KEY: ${N8N_CLOUD_API_KEY}" \
  "${CLOUD_BASE_URL}/workflows"

# Build name -> id map (n8n returns { data: [ { id, name, ... } ] } or { data: { workflows: [...] } })
declare -A NAME_TO_ID
while IFS= read -r line; do
  name=$(echo "$line" | cut -d'|' -f1)
  id=$(echo "$line" | cut -d'|' -f2)
  [[ -n "$name" && -n "$id" ]] && NAME_TO_ID["$name"]="$id"
done < <(python3 -c "
import json
with open('/tmp/n8n-cloud-workflows.json') as f:
    data = json.load(f)
workflows = data.get('data', [])
if isinstance(workflows, dict) and 'workflows' in workflows:
    workflows = workflows['workflows']
for w in workflows if isinstance(workflows, list) else []:
    if isinstance(w, dict) and w.get('name') and w.get('id'):
        print(f\"{w['name']}|{w['id']}\")
")

echo "Found ${#NAME_TO_ID[@]} workflows in Cloud"
echo ""

SUCCESS=0
FAILED=0
SKIPPED=0
NOT_FOUND=0

for json_file in "${EXPORTS_DIR}"/*.json; do
  filename=$(basename "$json_file")

  if [[ "$filename" == "manifest.json" ]]; then
    continue
  fi

  workflow_name=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
print(data.get('name', 'Unknown'))
" "$json_file" 2>/dev/null || echo "Unknown")

  cloud_id="${NAME_TO_ID[$workflow_name]:-}"

  if [[ -z "$cloud_id" ]]; then
    echo "SKIP: ${workflow_name} — not found in Cloud"
    NOT_FOUND=$((NOT_FOUND + 1))
    continue
  fi

  # Clean the workflow JSON (same fields as migrate script)
  python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
clean = {
    'name': data.get('name', 'Unnamed Workflow'),
    'nodes': data.get('nodes', []),
    'connections': data.get('connections', {}),
    'settings': {'executionOrder': data.get('settings', {}).get('executionOrder', 'v1')}
}
with open('/tmp/n8n-update-payload.json', 'w') as out:
    json.dump(clean, out)
" "$json_file" 2>/dev/null || true

  if [[ ! -f /tmp/n8n-update-payload.json ]]; then
    echo "SKIP: Could not parse ${filename}"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "DRY RUN: Would update '${workflow_name}' (${cloud_id})"
    SUCCESS=$((SUCCESS + 1))
    continue
  fi

  echo -n "Updating: ${workflow_name}..."

  http_code=$(curl -s -o /tmp/n8n-update-response.txt -w "%{http_code}" \
    -X PUT "${CLOUD_BASE_URL}/workflows/${cloud_id}" \
    -H "X-N8N-API-KEY: ${N8N_CLOUD_API_KEY}" \
    -H "Content-Type: application/json" \
    -d @/tmp/n8n-update-payload.json)

  if [[ "$http_code" == "200" ]]; then
    echo " OK"
    SUCCESS=$((SUCCESS + 1))
  else
    echo " FAIL (HTTP ${http_code})"
    cat /tmp/n8n-update-response.txt 2>/dev/null | head -5
    echo ""
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "=== Update Complete ==="
echo "Updated: ${SUCCESS}"
echo "Failed:  ${FAILED}"
echo "Skipped: ${SKIPPED}"
echo "Not found in Cloud: ${NOT_FOUND}"
