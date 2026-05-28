# Google Places Production Runner Decision

Date: 2026-05-28

Purpose: close the Google Places production-runner decision gate for the Apify Google Maps replacement path without assuming static outbound egress exists.

## Decision

Use `WF-VEP-002: Social Listening Pipeline` as the production-like runner for Google Places replacement validation. Portfolio/Vercel remains the admin trigger and reporting surface, not the place where the Google Places replacement should be promoted first.

Do not apply IP address application restrictions to the Google Places production key yet. Static outbound egress is not confirmed for the current n8n runner, and Vercel outbound traffic is dynamic unless Static IPs or Secure Compute are enabled.

## Evidence

- Repo workflow export: `n8n-exports/WF-VEP-002-Social-Listening-Pipeline.json` contains `Scrape Google Maps` as an Apify node inside the social-listening workflow.
- Setup guide: `docs/value-evidence-pipeline-setup.md` describes Portfolio as calling `N8N_VEP002_WEBHOOK_URL`, which means the app triggers n8n rather than directly running the scraping/replacement flow.
- Vercel docs: Vercel Static IPs provide fixed outbound egress for deployments on Pro and Enterprise plans.
- Vercel docs: Secure Compute provides dedicated static IPs and private networking for Enterprise plans.

Reference URLs:

- https://vercel.com/docs/connectivity/static-ips/
- https://vercel.com/docs/secure-compute
- https://vercel.com/guides/how-to-allowlist-deployment-ip-address

## Recommendation

Create or promote a separate production key only when the Google Places replacement is ready to be wired into the production-like runner.

Recommended production key name:

```text
portfolio-apify-replacement-google-places-prod
```

Required controls:

- Restrict the key to Places API (New).
- Keep application restrictions API-only until the runner has stable outbound egress.
- Add IP address restrictions only after the production runner's outbound IPs are stable and documented.
- Set strict Google Maps quota limits and billing alerts before the key is synced to any runtime sink.
- Add a rotation review date because API-only application posture is temporary.
- Sync to Infisical and Vercel/n8n runtime sinks only after approval.
- Rerun `npm run apify:replacement-bakeoff -- --run` from the production-like runner before replacing the Apify Google Maps actor.

## Rejected Options

### Use the local/Codex key as production

Rejected. The local key is acceptable for bakeoff, but it should not become the durable production credential.

### Add IP restrictions now

Rejected for now. IP restrictions can break the replacement workflow if the actual runner uses dynamic egress.

### Move the first production replacement into Vercel Functions

Not recommended as the first move. Portfolio currently triggers n8n for this social-listening workflow. Moving the workflow into Vercel would expand scope and still would not solve static egress unless Static IPs or Secure Compute are enabled.

## Validation Gate

Before replacing Apify's Google Maps actor:

1. Confirm where the production-like replacement run executes.
2. Confirm whether that runner has stable outbound egress.
3. Create or promote the production key with Places API (New) restriction.
4. Add IP restrictions only if stable outbound egress is available.
5. Run the live bakeoff from the production-like runner.
6. Compare accepted-result rate, cost, source quality, and operator review burden against the Apify baseline.
7. Keep Apify as rollback until the replacement meets or beats the baseline.
