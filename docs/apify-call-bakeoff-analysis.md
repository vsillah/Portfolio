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
