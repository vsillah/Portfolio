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

## 2026-06-02 Production-Like n8n Bakeoff Preflight

Live workflow inspected: `WF-VEP-002: Social Listening Pipeline`
(`gUyOBZOknpAt41aF`, active version `ddfbae42-7e29-4ccd-8802-4682f026c531`).

Preflight result:

- Google Maps can be isolated through the existing source gate by sending
  `sources: ["google_maps"]`.
- The live graph still posts downstream results into Portfolio ingest endpoints
  after scraping, so this is not a read-only n8n execution.
- The checked-in Portfolio `ingest-market` route did not preserve
  `is_test_data` before this change, even though the database migration already
  provides the column.
- The live n8n run was therefore not triggered from this preflight. Running it
  before this test flag is deployed could create unmarked production
  `market_intelligence` rows.

Safe run payload after deployment and n8n export sync:

```json
{
  "workflow": "WF-VEP-002",
  "action": "google_places_replacement_bakeoff",
  "sources": ["google_maps"],
  "searchTerms": ["nonprofit organizations near Omaha NE"],
  "googleMapsQuery": "nonprofit organizations near Omaha NE",
  "maxResults": 5,
  "is_test_data": true
}
```

Promotion gate:

1. Deploy the Portfolio ingest test-data propagation change.
2. Sync the `WF-VEP-002` n8n graph so `Set Search Parameters`, `POST Raw to
   Market Intel`, and `POST Pain Points` forward `is_test_data`.
3. Trigger the isolated Google Maps run above.
4. Confirm inserted `market_intelligence` and `pain_point_evidence` rows, if
   any, are marked `is_test_data = true`.
5. Compare result quality and cost against the Apify Google Maps baseline before
   replacing the actor.

## 2026-06-03 Production Callback Run

After PR #475 merged and both Vercel contexts were green, WF-VEP-002 was
triggered against `https://amadutown.com` with the same isolated payload:

```json
{
  "sources": ["google_maps"],
  "searchTerms": ["nonprofit organizations near Omaha NE"],
  "googleMapsQuery": "nonprofit organizations near Omaha NE",
  "maxResults": 5,
  "is_test_data": true
}
```

Execution evidence:

- n8n execution `16026` completed successfully.
- `IF GMaps Enabled` evaluated true while Reddit, LinkedIn, G2, and Capterra
  stayed disabled.
- `Scrape Google Maps` returned 2 places.
- `Extract GMaps Results` produced 20 Google Maps review/listing items.
- Portfolio completion callbacks succeeded.

Ingestion blocker found:

- `POST Raw to Market Intel` inserted 0 rows.
- The route returned repeated errors:
  `there is no unique or exclusion constraint matching the ON CONFLICT specification`.
- Root cause: the deployed database does not expose the `source_url` uniqueness
  expected by the route's `upsert(... onConflict: "source_url")` path.

Recommendation:

Use an application-level fallback before considering a production schema
mutation. If the `source_url` upsert fails because the constraint is missing,
the route should query for an existing `source_url`; if none exists, perform a
plain insert and preserve `is_test_data`. This keeps the bakeoff moving without
changing shared production schema under pressure.
