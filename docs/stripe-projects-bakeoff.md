# Stripe Projects Bakeoff

Last updated: 2026-05-13

## Decision Question

Should Portfolio adopt Stripe Projects as an agent-facing provisioning and credential-sync adapter for Portfolio and future client stacks?

## Current Default

- **Human/client credentials:** 1Password Business.
- **Runtime/API source of truth:** Infisical.
- **Runtime sinks:** Vercel env vars, n8n Credentials/Variables, Supabase-local consumers, and ignored local `.env` files.
- **Reporting and rotation visibility:** `scripts/credential-broker.ts`, `docs/credential-inventory.json`, and `/admin/credentials`.

## Candidate

Stripe Projects is a developer-preview CLI workflow for provisioning services, generating and storing credentials, and syncing environment variables for agent-built app stacks.

Primary command surface:

```bash
stripe projects init
stripe projects catalog
stripe projects add <provider>/<service>
stripe projects upgrade <provider>
```

## Hypothesis

Stripe Projects may be useful as a **new-stack bootstrap layer** because it can reduce provider dashboard work and credential copy/paste during client setup.

It should not become the Portfolio credential source of truth until it proves:

- encrypted local storage behavior is clear,
- generated files are safe for git,
- agents can read metadata without reading values,
- provider credentials can be rotated or reissued repeatably,
- the workflow can coexist with 1Password, Infisical, Vercel, and n8n.

## Scope

### In Scope

- Disposable sandbox project only.
- Low-risk provider test, preferably one that does not touch production data.
- Inspect generated file paths, gitignore behavior, vault metadata, env sync behavior, and agent ergonomics.
- Evaluate whether Portfolio should add a `stripe-projects` adapter to the credential broker.

### Out Of Scope

- No production Portfolio provisioning.
- No client-stack provisioning.
- No live Stripe API-key rotation.
- No replacement of 1Password or Infisical.
- No committed secret values or generated local vault contents.

## Bakeoff Inputs

| Input | Purpose |
| --- | --- |
| Disposable folder outside Portfolio | Prevent generated provider config from polluting the repo. |
| One low-risk provider from `stripe projects catalog` | Test provisioning and env sync without production impact. |
| Existing Portfolio credential broker report | Compare Stripe Projects output against current governance needs. |
| Git status before and after each command | Confirm generated files are isolated and ignored where appropriate. |

## Scoring

| Dimension | Weight | Pass Criteria |
| --- | ---: | --- |
| Secret safety | 30 | Values are not printed by default, generated vault files are encrypted or ignored, and docs identify how agents retrieve values safely. |
| Agent ergonomics | 20 | An agent can initialize, add a provider, and collect metadata without browser handoff. |
| Governance fit | 20 | Output can map to `docs/credential-inventory.json` source/sink fields and approval boundaries. |
| Rotation support | 15 | Provider credentials can be recreated, rotated, or replaced without losing audit history. |
| Portability | 10 | Environment sync works across local machines without committing sensitive artifacts. |
| Cost and maturity | 5 | Developer-preview risk, billing behavior, and provider plan changes are explicit. |

Promotion threshold: at least 80/100, with a passing score on secret safety.

## Test Plan

1. Create a disposable sandbox folder outside Portfolio.
2. Install or verify Stripe CLI and the Projects plugin.
3. Run `stripe projects init`.
4. Run `stripe projects catalog`.
5. Add one low-risk provider.
6. Inspect generated files without printing values.
7. Confirm `.projects/vault/vault.json` behavior and whether it is encrypted, ignored, or safe only as local state.
8. Confirm `.env` write behavior and whether it can target `.env.local`, `.env.staging`, or named sinks.
9. Record provider metadata and rollback steps.
10. Remove or archive the disposable sandbox after evidence is captured.

## Evidence To Capture

- Commands run.
- Generated file paths.
- Whether generated files contain values, ciphertext, metadata, or references.
- Provider account/project created.
- Env variable names added.
- Whether values were printed, copied, or hidden.
- How billing/usage appears.
- Cleanup command or dashboard steps.

Do not capture or commit secret values.

## Promotion Gate

Stripe Projects can be promoted to a Portfolio adapter only if:

- a sandbox run proves secret-safe behavior,
- generated artifacts are excluded from git or provably value-free,
- the adapter can emit value-free metadata for `/admin/credentials`,
- source-of-truth ownership remains 1Password/Infisical unless explicitly changed,
- production/client provisioning stays approval-gated.

## Rollback

- Delete any sandbox provider resources created during the bakeoff.
- Remove the disposable local sandbox folder.
- Uninstall the Stripe Projects plugin if it adds global behavior that conflicts with existing Stripe CLI use.
- Keep Portfolio on the current 1Password + Infisical + credential broker model.

## CTO Recommendation

Run the bakeoff before changing the credential system.

If the sandbox scores well, use Stripe Projects as a **provisioning adapter** for new stacks and client pilots. Keep 1Password and Infisical as the governance layer until Stripe Projects proves mature enough for audited rotation, scoped agent access, and cross-client boundaries.

## Sources

- [Stripe Projects](https://projects.dev/)
- [Stripe API keys](https://docs.stripe.com/keys)
- [Stripe webhook secret rotation](https://docs.stripe.com/webhooks)
