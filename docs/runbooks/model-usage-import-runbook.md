# Model Usage Import Runbook

Use this runbook to import reviewed model usage into Agent Ops without connecting provider billing, syncing credentials, changing model routing, or storing private prompts.

## Scope

This V1 path supports reviewed source-file imports for:

- Codex session JSON
- Claude Code session JSON
- Gemini usage CSV
- OpenAI usage JSONL
- Anthropic usage JSONL
- local and open-weight model JSON

The import path writes only normalized model-usage ledger rows and subscription allocation rows after admin review. Provider billing access, OAuth setup, credential sync, hosted workflow activation, outbound sends, publishing, deploys, and automatic model routing remain outside this path.

## Safety Rules

- Use synthetic or reviewed summary files only.
- Exclude raw prompts, messages, transcripts, content bodies, credentials, API keys, access tokens, refresh tokens, passwords, and secrets.
- Keep raw exports separate from reviewed source files.
- Run dry run first.
- Import only after the dry run returns the expected event count, allocation count, and warnings.
- Use `clientSafe=true` on the summary API when preparing client-facing projections.

## Admin UI Path

1. Open `/admin/agents/model-usage`.
2. In `Reviewed source file`, choose the source format.
3. Paste reviewed source text or load a `.json`, `.jsonl`, `.csv`, or `.txt` file.
4. Set the client label and optional export batch id.
5. Click `Stage source file`.
6. Click `Dry run`.
7. Review event count, allocation count, warnings, model, task category, client, cost basis, and confidence.
8. Click `Import reviewed packet` only after the packet is clean.
9. Use `Copy client-safe JSON` when a scrubbed client projection is needed.

## API Dry Run

```bash
curl -sS \
  -X POST "$PORTFOLIO_ORIGIN/api/admin/model-usage/import" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @docs/model-usage-import-fixtures/reviewed-source-files-request.json
```

The request defaults to `dryRun: true` in the fixture. A successful dry run returns:

- `ok: true`
- `dryRun: true`
- `eventCount`
- `subscriptionAllocationCount`
- `warnings`

## Client-Safe Projection

```bash
curl -sS \
  "$PORTFOLIO_ORIGIN/api/admin/model-usage/summary?from=2026-07-01&to=2026-07-31&clientSafe=true" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"
```

Client-safe projection redacts private trace ids and internal action labels from events while preserving rollups, cost basis, confidence, and advisory recommendations.

## Fixture Map

| Fixture | Source format | Purpose |
| --- | --- | --- |
| `codex-session.json` | Codex JSON | Portfolio coding session summary |
| `claude-code-session.json` | Claude Code JSON | QA/review session summary |
| `gemini-usage.csv` | Gemini CSV | Research usage export row |
| `openai-usage.jsonl` | OpenAI JSONL | Outreach/social API usage row |
| `anthropic-usage.jsonl` | Anthropic JSONL | Planning/API usage row |
| `local-open-weight-run.json` | Local JSON | Local/open-weight RAG run summary |
| `reviewed-source-files-request.json` | Import request | End-to-end dry-run packet using all fixture formats |

## Approval Boundary

This runbook does not authorize:

- connecting a provider account,
- importing raw provider logs without review,
- syncing credentials,
- changing model routing,
- changing client-facing defaults,
- creating provider webhooks,
- sending outbound communications,
- publishing or deploying,
- mutating client data outside the model usage ledger.

Any of those actions require a separate `agent_approvals` path.
