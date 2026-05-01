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
npm run credentials:inject -- --env staging -- npm run n8n:drift-check -- --warn
npm run credentials:rotate -- --secret n8n-ingest-secret --env staging
npm run credentials:sync-runtime -- --secret n8n-ingest-secret --env staging
npm run credentials:smoke -- --env staging
npm run credentials:smoke -- --env staging --require-provider-access
```

The broker never prints raw secret values. Rotation packets are written to `.credential-rotation-audits/`, which is ignored by git.

Use plain `credentials:smoke` for local registry checks. Use `--require-provider-access` after `op` and `infisical` are installed/authenticated; that mode fails unless the broker can read one scoped test secret from each source of truth without printing its value.

## Rotation Rules

- Critical production keys: rotate every 30 days.
- Client API keys and service-role keys: rotate every 60-90 days.
- Low-risk dev/test keys: rotate every 90-180 days.
- OAuth/session credentials: re-authenticate on expiry, offboarding, or suspected exposure.
- Use a two-secret strategy where the provider supports it: create replacement, update source of truth, sync runtime sinks, verify, then revoke the old credential.
- Production revocation and client-impacting changes require an approval packet unless Vambah explicitly authorizes full autopilot rotation.

## Source And Sink Rules

- The inventory owns canonical secret names, owners, source of truth, runtime sinks, cadence, verification, and rollback notes.
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
- Replace each `pending-provider-confirmation` baseline with a verified `lastRotatedAt` date and evidence note.
- Configure runtime sinks from the source of truth: Vercel env vars, n8n Variables/Credentials, and local ignored env files.
- Run `npm run credentials:smoke -- --env staging` after the first sync.
- Run `npm run credentials:smoke -- --env staging --require-provider-access` before calling the system operational.

## Existing Portfolio References

- `docs/credential-rotation-map.md`
- `docs/credential-rotation-runbook.md`
- `docs/n8n-secrets-remediation.md`
- `n8n-exports/environment-variables-reference.md`

## Codex Automations

- `portfolio-credential-rotation-due-report`: weekly Monday 8:30 AM credential due report for staging and production.
- `portfolio-staging-credential-rotation-drill`: monthly first Monday 10:00 AM staging rotation drill and smoke check.
- `portfolio-production-credential-rotation-proposals`: monthly first Wednesday 9:00 AM production proposal packets only; no production rotation or revocation without approval.
