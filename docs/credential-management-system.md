# Credential Management And Rotation System

This system makes 1Password and Infisical the credential sources of truth, while Vercel, n8n, Supabase, and local `.env` files stay runtime sinks.

## Operating Model

- **1Password Business:** human logins, client-shared passwords, OAuth recovery details, browser-session credentials, and agent service accounts scoped to exact vaults.
- **Infisical:** runtime/API secrets for Portfolio and client stacks, separated by client and environment.
- **Credential broker:** `scripts/credential-broker.ts` is the agent-facing interface for due-date reporting, scoped injection, rotation packets, runtime sync preparation, and smoke checks.

Default boundaries:

| Boundary | Dev | Staging | Production |
| --- | --- | --- | --- |
| 1Password vault | `Portfolio / dev` | `Portfolio / staging` | `Portfolio / prod` |
| Infisical environment | `dev` | `staging` | `prod` |
| Infisical path | `/portfolio` | `/portfolio` | `/portfolio` |
| Agent identity | dev-scoped | staging-scoped | prod-scoped, approval-gated |

For clients, duplicate this shape as `{Client Name} / dev`, `{Client Name} / staging`, `{Client Name} / prod`, plus one Infisical project or namespace per client.

## Broker Commands

All commands read `docs/credential-inventory.json`.

```bash
npm run credentials:list-due -- --env staging
npm run credentials:report -- --env staging
npm run credentials:report -- --env staging --check-sinks
npm run credentials:report -- --env staging --json
npm run credentials:baseline-template -- --env staging
npm run credentials:baseline-template -- --env staging --json
npm run credentials:inject -- --env staging -- npm run n8n:drift-check -- --warn
npm run credentials:rotate -- --secret n8n-ingest-secret --env staging
npm run credentials:sync-runtime -- --secret n8n-ingest-secret --env staging
npm run credentials:smoke -- --env staging
npm run credentials:smoke -- --env staging --require-provider-access
```

The broker never prints raw secret values. Rotation packets are written to `.credential-rotation-audits/`, which is ignored by git.

Use plain `credentials:smoke` for local registry checks. Use `--require-provider-access` after `op` and `infisical` are installed/authenticated; that mode fails unless the broker can read one scoped test secret from each source of truth without printing its value.

Use `credentials:report` for rotation visibility. It is read-only and summarizes the inventory by status, source of truth, risk, runtime sink, approval boundary, and next action. It does not fetch or print secret values. The same report is exposed to admins at `/admin/credentials` through `/api/admin/credentials/report`.

Use `credentials:report -- --check-sinks` when the operator needs runtime sink presence visibility. This mode inspects local env files, Vercel environment metadata, n8n credential names/types, and n8n Variable keys by metadata only. n8n Variable values are reduced away before the broker records evidence, so values are not printed or stored. If `N8N_API_KEY` lacks read access to `/api/v1/variables`, n8n Variable sinks are reported as `unavailable` with the missing scope action instead of remaining `unknown`. Unknown/unavailable sink states should be treated as visibility gaps, not proof that a credential is absent.

The report includes runtime sink gap actions for `missing`, `unknown`, and `unavailable` sink states. These are operator tasks, not automatic mutations: sync missing sinks from the source of truth, restore read-only metadata access when checks are unavailable, or add a key-only adapter before treating unknown states as verified.

When local `.credential-rotation-audits/*.json` packets exist, `credentials:report` and `/admin/credentials` also summarize packet metadata by status (`drafted`, `synced`, `verified`, `revocation-pending`, `blocked`). Packet reporting is value-free: it shows secret ids/env var names, timestamps, approval state, runtime sinks, and verification commands, not credential values.

Use `credentials:baseline-template` when `credentials:report` shows `needs-baseline`. It emits provider-confirmation placeholders for each missing environment baseline so the operator can verify provider history, fill `lastRotatedAt`, preserve evidence, and update `docs/credential-inventory.json` without guessing from local env files.

## Rotation Rules

- Critical production keys: rotate every 30 days.
- Client API keys and service-role keys: rotate every 60-90 days.
- Low-risk dev/test keys: rotate every 90-180 days.
- OAuth/session credentials: re-authenticate on expiry, offboarding, or suspected exposure.
- Use a two-secret strategy where the provider supports it: create replacement, update source of truth, sync runtime sinks, verify, then revoke the old credential.
- Production revocation and client-impacting changes require an approval packet unless Vambah explicitly authorizes full autopilot rotation.

## Source And Sink Rules

- The inventory owns canonical secret names, owners, source of truth, runtime sinks, cadence, verification, and rollback notes.
- `docs/infisical-secret-map.md` records the current Infisical project/path/environment map and the production import gate.
- Stripe Projects may be evaluated as a provisioning adapter for new stacks, but it is not a credential source of truth until it passes `docs/stripe-projects-bakeoff.md`.
- Each inventory entry has per-environment `baseline` metadata. `pending-provider-confirmation` means the secret is tracked but the last rotation date has not been verified from Infisical, 1Password, a provider dashboard/API, or an approved rotation packet.
- `.env.local` and `.env.staging` are local runtime sinks only. Do not treat them as primary records.
- n8n Variables/Credentials are runtime consumers. Prefer external secrets if the active n8n plan supports it; otherwise keep n8n values synced from Infisical/1Password.
- Vercel env vars are deployment runtime consumers. Changing Vercel values only affects new deployments.
- Supabase Vault is appropriate for Postgres functions, triggers, and webhooks, but not as the global cross-client credential system.

## Agent Safety

- Agents may use `credentials:inject` for task-scoped commands when their machine identity has access.
- Agents may prepare rotation packets and local/staging updates.
- Agents must not print, commit, summarize, or paste secret values.
- Agents must record provider, environment, secret id, runtime sinks, verification commands, and rollback notes.
- Production/client revocation waits for approval unless a later durable rule grants full autopilot rotation.

## Setup Checklist

- Create 1Password vaults for Portfolio dev, staging, and prod.
- Create 1Password service accounts with only the vault permissions needed for the agent/runtime.
- Create an Infisical `portfolio` project with `dev`, `staging`, and `prod` environments.
- Create machine identities per environment, not one broad cross-client identity.
- Populate Infisical secrets using the env var names in `docs/credential-inventory.json`.
- Keep production imports gated: do not populate `prod:/portfolio` from unprefixed local env values unless a production source/approval packet confirms the value.
- Replace each `pending-provider-confirmation` baseline with a verified `lastRotatedAt` date and evidence note.
- Configure runtime sinks from the source of truth: Vercel env vars, n8n Variables/Credentials, and local ignored env files.
- Grant reporting-only n8n API keys the read scopes needed for metadata checks, including credential metadata list access and `variable:list`; do not grant write/delete scopes for reporting-only keys.
- Run `npm run credentials:smoke -- --env staging` after the first sync.
- Run `npm run credentials:smoke -- --env staging --require-provider-access` before calling the system operational.

## Existing Portfolio References

- `docs/credential-rotation-map.md`
- `docs/credential-rotation-runbook.md`
- `docs/credential-baseline-evidence.md`
- `docs/infisical-secret-map.md`
- `docs/stripe-projects-bakeoff.md`
- `docs/n8n-secrets-remediation.md`
- `n8n-exports/environment-variables-reference.md`

## Codex Automations

- `portfolio-credential-rotation-due-report`: weekly Monday 8:30 AM credential due report for staging and production.
- `portfolio-staging-credential-rotation-drill`: monthly first Monday 10:00 AM staging rotation drill and smoke check.
- `portfolio-production-credential-rotation-proposals`: monthly first Wednesday 9:00 AM production proposal packets only; no production rotation or revocation without approval.
