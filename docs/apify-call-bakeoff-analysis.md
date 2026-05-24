# Apify Call Bakeoff Analysis

Date: 2026-05-06

Purpose: keep Apify under active watch, identify every current Portfolio call surface found in n8n exports, and define the evidence needed before replacing Apify with a cheaper or better tool.

## Current Spend

- Confirmed recurring charge: $39/month.
- Evidence: Apify payment-success invoices on 2026-04-03 and 2026-05-03.
- Current recommendation: keep for now, but run a replacement bakeoff before the next renewal window.

## Runtime Evidence

- n8n Cloud execution `13174` for workflow `HqpDGIHxvJqXKHuT` succeeded on 2026-05-06.
- That execution checked `alien_force~facebook-scraper-pro` and `harvestapi~linkedin-profile-search`.
- Both monitored actors returned `no_runs` with `totalRuns: 0`, producing warning alerts rather than evidence of recent productive actor usage.
- Static exports show more Apify call surfaces than the current monitor checks. The monitor should be expanded or the bakeoff should pull direct Apify run history before a final replacement decision.
- 2026-05-09 dashboard readiness update: the admin Subscription Watch budget query exposes this analysis as the Apify watch path and treats the 12 configured actor surfaces as replacement-analysis scope, not cancellation evidence by itself.
- 2026-05-09 direct Apify API pull sampled the latest 10 runs for each configured actor surface. The sample found 59 runs, 40 successes, 19 failures, 315 dataset items, and $1.99585 in actor usage cost, or about $0.00634 per dataset item before manual acceptance review.

## Direct Run-History Findings

| Actor surface | Latest sampled result | Items | Sample cost | Decision signal |
| --- | ---: | ---: | ---: | --- |
| Facebook friends | No runs | 0 | $0.00000 | Pause unless a campaign-owned Facebook source is active. |
| Facebook groups | No runs | 0 | $0.00000 | Pause; prefer manual group review or approved community export. |
| Facebook comments | No runs | 0 | $0.00000 | Pause unless a specific post-engagement campaign justifies it. |
| LinkedIn connections | 4 failed / 0 succeeded | 0 | $0.04000 | Replace or keep disabled. |
| LinkedIn post engagement | 1 succeeded / 0 failed | 0 | $0.00005 | Investigate inputs before keeping; success with zero items is not useful output. |
| Reddit listening | 10 succeeded / 0 failed | 72 | $0.47360 | Keep for now; compare against Reddit API/RSS/search. |
| Google Maps | 10 succeeded / 0 failed | 68 | $0.58600 | Keep only if Google Places API or manual CSV cannot match accepted evidence. |
| LinkedIn post search | 4 succeeded / 0 failed | 135 | $0.27220 | Strongest current Apify value signal; compare against browser-agent sampling. |
| G2 reviews | 5 succeeded / 5 failed | 0 | $0.00000 | Replace with manual/source-registered capture unless non-empty output can be proven. |
| Capterra reviews | 10 succeeded / 0 failed | 40 | $0.62400 | Keep only for targeted evidence collection; test browser/manual replacement. |
| Profile enrichment | No runs | 0 | $0.00000 | Remove from active watch if the older HeyGen cold-email flow is retired. |
| Website screenshot/video | No runs | 0 | $0.00000 | Replace with Playwright, Browser Use, or Vercel Chromium capture if still needed. |

Current read: Apify's $39/month subscription is not justified by all configured actors equally. Four actor categories produced useful-looking volume in the sample: Reddit listening, Google Maps, LinkedIn post search, and Capterra reviews. Eight configured surfaces are no-run, failing, or empty-output and should be paused, replaced, or retired before Apify is treated as a durable default.

## Replacement Bakeoff Gate

Run replacement tests only for the productive categories. Do not spend time
benchmarking no-run, failing, or empty-output actors until a workflow owner
proves the campaign still needs that source.

| Productive category | Current Apify signal | Replacement to test first | Why this is the first challenger | Gate |
| --- | ---: | --- | --- | --- |
| Reddit listening | 72 items / $0.47360 | Brave Search API with Reddit/source filters, then official Reddit Data API only if terms fit | Brave is $5 per 1,000 search requests with $5 monthly credits, which is enough for a low-volume evidence monitor. Reddit's official free API has rate limits and commercial use can require a separate agreement. | Promote replacement only if it captures the same conversations with lower review burden and acceptable source attribution. |
| Google Maps | 68 items / $0.58600 | Google Places API Text Search/Nearby Search with field masks and strict quotas | Google Places pricing is transparent; Text Search/Nearby Search Pro list 5,000 free monthly calls, then $32 per 1,000 for the first paid tier. This can beat Apify if the workflow needs verified place data instead of broad scraping. | Promote only if Places returns enough qualified businesses with required fields while staying inside the free/low-tier quota. |
| LinkedIn post search | 135 items / $0.27220 | Browser-agent sampling plus manual review packet | This is the strongest current Apify value signal, but LinkedIn-style extraction has account and compliance risk. A browser/manual packet should test whether smaller sampled searches produce enough accepted leads. | Keep Apify unless the replacement returns comparable accepted leads without increasing account risk or manual time. |
| Capterra reviews | 40 items / $0.62400 | Brave Search or browser capture into a source register | Review-site evidence is usually sparse and source-sensitive. A search/browser capture may be cheaper if it preserves URLs, snippets, and review context without needing a dedicated actor. | Promote only if accepted evidence quality matches Apify and source URLs remain reviewable. |

Source notes for the bakeoff packet:

- Google Maps Platform pricing should be checked from the official pricing page before each run; as of the 2026-05-24 check, Places API Text Search Pro and Nearby Search Pro list 5,000 free monthly calls and then $32 per 1,000 in the first paid tier.
- Brave Search API pricing should be checked from Brave before each run; as of the 2026-05-24 check, Search is listed at $5 per 1,000 requests with $5 monthly credits.
- Reddit source use must be reviewed against Reddit's Data API Wiki and Data API Terms before any commercial workflow uses official Reddit API data. The official wiki lists 100 QPM free-access limits for eligible OAuth clients; the terms say commercial or out-of-scope use may require a separate agreement.

### Executable Test Packet

Use the replacement bakeoff harness to keep this gate repeatable:

```bash
npm run apify:replacement-bakeoff
```

Dry-run mode reports which challengers are ready and which are blocked by
missing read-only credentials. Live API mode is intentionally explicit:

```bash
npm run apify:replacement-bakeoff -- --run --out=docs/apify-replacement-bakeoff-latest.json
```

Current credential gate from the 2026-05-24 worktree check:

- `APIFY_TOKEN` and `APIFY_API_TOKEN` exist locally.
- `BRAVE_SEARCH_API_KEY` is missing, so Reddit/Capterra replacement API tests
  are blocked.
- `GOOGLE_MAPS_API_KEY` is missing, so Google Places replacement tests are
  blocked.
- LinkedIn post-search replacement remains manual/browser-agent ready because
  it should be evaluated on accepted leads and account-risk burden, not API
  result count alone.

## Configured Apify Call Surfaces

| Workflow | Node | Actor | Purpose | Replacement candidates |
| --- | --- | --- | --- | --- |
| `WF-WRM-001: Facebook Warm Lead Scraper` | `Scrape FB Friends (Apify)` | `alien_force~facebook-scraper-pro` | Facebook warm lead discovery from profile/friends data. | Native/manual Facebook review, browser-agent extraction, LinkedIn-first warm lead path, disable unless campaign-owned cookies are valid. |
| `WF-WRM-001: Facebook Warm Lead Scraper` | `Scrape FB Groups (Apify)` | `mdgjtp1~facebook-group-member` | Facebook group member discovery. | Manual group review, Meta/community export where available, browser-agent extraction behind approval. |
| `WF-WRM-001: Facebook Warm Lead Scraper` | `Scrape FB Post Comments (Apify)` | `apify~facebook-comments-scraper` | Commenter discovery from Facebook posts. | Native post export/manual triage, browser-agent extraction, shift warm lead collection to opted-in forms. |
| `WF-WRM-003: LinkedIn Warm Lead Scraper` | `Scrape LI Connections (Apify)` | `addeus~get-connections` | LinkedIn 1st-degree connection extraction. | LinkedIn CSV export/manual upload, browser-agent extraction, CRM/contact imports. |
| `WF-WRM-003: LinkedIn Warm Lead Scraper` | `Scrape LI Post Engagement (Apify)` | `harvestapi~linkedin-profile-posts` | LinkedIn post engagement leads. | LinkedIn native analytics/manual export, browser-agent extraction, lower-frequency campaign review. |
| `WF-VEP-002: Social Listening Pipeline` | `Scrape Reddit` | `trudax~reddit-scraper-lite` | Reddit social listening for value evidence. | Reddit API/search RSS where allowed, Brave/Search API, browser search with cached source register. |
| `WF-VEP-002: Social Listening Pipeline` | `Scrape Google Maps` | `compass~crawler-google-places` | Local business/place discovery and reviews. | Google Places API, manual CSV, Google Business Profile exports, SerpAPI/Maps alternatives. |
| `WF-VEP-002: Social Listening Pipeline` | `Scrape LinkedIn` | `harvestapi~linkedin-post-search` | LinkedIn content listening. | LinkedIn native/manual search, browser-agent sampling, campaign-limited runbooks. |
| `WF-VEP-002: Social Listening Pipeline` | `Run G2 Actor` | `focused_vanguard~g2-reviews-scraper` | G2 review evidence. | G2 manual export where permitted, browser/search snippets, vendor review APIs. |
| `WF-VEP-002: Social Listening Pipeline` | `Run Capterra Actor` | `dionysus_way~capterra-reviews` | Capterra review evidence. | Capterra manual export where permitted, browser/search snippets, vendor review APIs. |
| `HeyGen Cold Email - Sub Agent - Jono Catliff` | `Get Profile data` | `VhxlqQXRwhW8H5hNV` | LinkedIn profile enrichment in an older cold-email flow. | Remove if flow is retired; otherwise compare with Hunter/Apollo/Clay-style enrichment. |
| `HeyGen Cold Email - Sub Agent - Jono Catliff` | `Run Website Video Scraper: Sync` | `dz_omar~ultimate-screenshot` | Website screenshot/video capture for personalization. | Playwright screenshot/video capture, Browser Use capture, Vercel/Chromium job. |

## Bakeoff Criteria

Score every replacement against the same packet:

- Cost per useful lead or usable evidence item.
- Source reliability and duplication rate.
- Compliance and account-risk exposure.
- Runtime reliability, retry behavior, and observability.
- Fit with existing n8n and Portfolio admin trace surfaces.
- Replacement effort and rollback path.

## Recommended Next Step

Run a read-only Apify run-history pull before renewal:

1. Pull recent run counts, cost/compute units, status, and dataset item counts for every actor above.
2. Mark actors with `no_runs` or empty datasets as pause candidates.
3. For actors with meaningful output, run one bakeoff packet against at least one alternative.
4. Keep Apify only for actors that produce a lower cost per useful result or materially better data quality than the replacement.
