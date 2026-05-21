# Production Credential Source-Of-Truth Gap

Date: 2026-05-21

## Summary

The production credential broker can reach both configured source-of-truth providers, but Infisical production is not yet populated enough to be treated as the runtime/API credential authority.

Verified value-free checks:

- `npm run credentials:smoke -- --env prod --require-provider-access` passes for provider reachability.
- 1Password scoped read works for `LINKEDIN_COOKIE`.
- Infisical scoped read works for `N8N_INGEST_SECRET`.
- A value-free provider presence scan found 33 empty Infisical-backed production secrets.
- The two 1Password-backed production entries are present.

No secret values were printed, copied, or committed.

## Impact

Do not treat Infisical `prod:/portfolio` as complete yet.

Current production deploys may still work because Vercel, n8n, Supabase, and local env files remain runtime sinks. The governance gap is that the intended source of truth is only partially populated, so agents cannot safely use Infisical to sync missing runtime sinks or prove rotation baselines for most production secrets.

## Empty Infisical-Backed Production Entries

The following tracked prod entries returned an empty value from Infisical at `prod:/portfolio`:

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

`npm run credentials:report -- --env prod --check-sinks` also reported:

- Runtime sinks present: 48
- Runtime sinks missing: 16
- Runtime sinks unknown/unavailable: 13
- Missing provider-confirmed baselines: 36

The Vercel missing-key findings should not be auto-remediated from Infisical until the corresponding Infisical values are provider-confirmed and populated.

## CTO Recommendation

Use a three-step closeout instead of direct runtime mutation:

1. Populate Infisical production from provider-confirmed production sources or approved rotation packets, not from ambiguous local env values.
2. Record provider-confirmed rotation baselines in `docs/credential-inventory.json`.
3. Run runtime sink sync packets only after the source-of-truth values are complete, then verify with `credentials:report -- --env prod --check-sinks`.

This keeps production safe while moving the system toward the intended credential architecture.

## Verification Commands

Run these from `/Users/vambahsillah/Projects/Portfolio`:

```bash
npm run credentials:smoke -- --env prod --require-provider-access
npm run credentials:report -- --env prod --check-sinks
npm run credentials:baseline-template -- --env prod
```

When Infisical production is fully populated, rerun a value-free provider presence scan before syncing runtime sinks.
