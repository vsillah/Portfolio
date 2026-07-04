#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/vambahsillah/Projects/Portfolio/agentified"

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  if [[ -n "${OP_ANTHROPIC_API_KEY_REF:-}" ]]; then
    if ! op whoami >/dev/null 2>&1; then
      cat >&2 <<'MSG'
1Password CLI is not signed in.

Open 1Password, then enable:
  Settings > Security > Touch ID
  Developer > Settings > Integrate with 1Password CLI

Then run:
  op signin --account vambahsillah.1password.com

MSG
      exit 1
    fi

    echo "Reading Anthropic API key from 1Password reference without printing it..."
    export ANTHROPIC_API_KEY
    ANTHROPIC_API_KEY="$(op read "$OP_ANTHROPIC_API_KEY_REF")"
  else
    cat >&2 <<'MSG'
ANTHROPIC_API_KEY is not set and OP_ANTHROPIC_API_KEY_REF was not provided.

After 1Password CLI is signed in, run with an op:// reference, for example:

  OP_ANTHROPIC_API_KEY_REF='op://Private/Anthropic API Key/api key' \
    ./scripts/run-fable5-outline-loop-with-1password.sh

Use your actual vault/item/field path. The key will be read into the environment and will not be printed.
MSG
    exit 1
  fi
fi

exec "$ROOT/scripts/run-fable5-outline-loop.sh"
