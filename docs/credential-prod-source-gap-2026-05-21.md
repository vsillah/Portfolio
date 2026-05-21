# Production Credential Source-Of-Truth Gap

Date: 2026-05-21

## Summary

The production credential broker can reach the configured source-of-truth providers. Infisical production was initially only partially populated, then bootstrapped from the local production runtime sink on 2026-05-21 after an explicit approval.

Verified value-free checks:

- `npm run credentials:smoke -- --env prod --require-provider-access` passes for provider reachability.
- 1Password scoped read works for `LINKEDIN_COOKIE`.
- Infisical scoped read works for `N8N_INGEST_SECRET`.
- A guarded dry-run found 34 tracked Infisical-backed production entries available in `.env.local`.
- `bootstrap-infisical --env prod --source .env.local --apply` populated 34 Infisical-backed production entries without printing values.
- A value-free provider presence scan after import found 34 Infisical-backed production entries present, 0 empty, and 0 failed.

No secret values were printed, copied, or committed.

## Impact

Infisical `prod:/portfolio` is now populated enough to act as the runtime/API source of truth for tracked Infisical-backed production secrets.

This import fixes source-of-truth availability. It does not prove provider rotation history and does not by itself rotate credentials. Provider-confirmed baselines are still required before the inventory can report these secrets as rotation-governed.

## Bootstrapped Infisical-Backed Production Entries

The following tracked prod entries were bootstrapped into Infisical at `prod:/portfolio` from `.env.local`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `APIFY_API_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GITHUB_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `SUPABASE_DB_PASSWORD`
- `PRINTFUL_API_KEY`
- `PRINTFUL_WEBHOOK_SECRET`
- `VAPI_PRIVATE_KEY`
- `CALENDLY_API_KEY`
- `N8N_WEBHOOK_SECRET`
- `SLACK_BOT_TOKEN`
- `N8N_CLOUD_API_KEY`
- `USPS_CLIENT_SECRET`
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`
- `GAMMA_API_KEY`
- `LINKEDIN_CLIENT_SECRET`
- `HEYGEN_API_KEY`
- `HEYGEN_WEBHOOK_SECRET`
- `BUILTWITH_API_KEY`
- `HUNTER_API_KEY`
- `PINECONE_API_KEY`
- `READ_AI_CLIENT_SECRET`
- `READ_AI_ACCESS_TOKEN`
- `READ_AI_REFRESH_TOKEN`
- `SOURCE_PROTOCOL_INGEST_SECRET`
- `N8N_API_KEY`

## Runtime Sink Gaps

After importing `N8N_API_KEY`, `credentials:report -- --env prod --check-sinks` can inspect n8n credential metadata and reports:

- Runtime sinks present: 52
- Runtime sinks missing: 16
- Runtime sinks unknown/unavailable: 9
- Missing provider-confirmed baselines: 36

The remaining missing sink findings are Vercel production key-name gaps. The remaining unknowns are n8n Variables because the current broker intentionally avoids reading variable values without a key-only metadata path.

## CTO Recommendation

Use a three-step closeout from here:

1. Record provider-confirmed rotation baselines in `docs/credential-inventory.json`.
2. Prepare explicit runtime-sync packets for the 16 missing Vercel production keys.
3. Add a key-only n8n Variables metadata adapter or approved sanitized evidence path before treating n8n Variable unknowns as verified.

This keeps production safe while moving the system toward the intended credential architecture.

## Verification Commands

Run these from `/Users/vambahsillah/Projects/Portfolio`:

```bash
npm run credentials:smoke -- --env prod --require-provider-access
npm run credentials:report -- --env prod --check-sinks
npm run credentials:baseline-template -- --env prod
npm run credentials:inject -- --env prod --secret N8N_API_KEY -- npm run credentials:report -- --env prod --check-sinks
```

Use `bootstrap-infisical` for future guarded imports:

```bash
npx tsx scripts/credential-broker.ts bootstrap-infisical --env prod --source .env.local
npx tsx scripts/credential-broker.ts bootstrap-infisical --env prod --source .env.local --apply
```
