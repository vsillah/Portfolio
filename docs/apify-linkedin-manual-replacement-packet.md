# LinkedIn Post Search Replacement Packet

Date: 2026-05-25

Purpose: test whether the productive Apify LinkedIn post-search surface can be
replaced with a lower-risk manual or browser-assisted review packet before
making any spend decision about Apify.

## Boundary

This packet does not authorize LinkedIn scraping, auto-viewing, auto-messaging,
profile copying, or automated browser activity against LinkedIn. LinkedIn's
current help guidance says automated tools, crawlers, browser plug-ins, and
extensions that scrape or automate activity on LinkedIn are not permitted. The
replacement test therefore uses human review and source registration, not a bot
that extracts LinkedIn data.

Primary references checked on 2026-05-25:

- LinkedIn Help: Prohibited software and extensions.
- LinkedIn Help: Automated activity on LinkedIn.
- LinkedIn Professional Community Policies.

## Baseline To Beat

Current Apify signal from the latest run-history sample:

| Surface | Actor | Runs | Items | Sample cost | Signal |
| --- | --- | ---: | ---: | ---: | --- |
| LinkedIn post search | `harvestapi~linkedin-post-search` | 4 | 135 | $0.27220 | Strongest current Apify value signal, but still needs accepted-result review. |

Apify should stay for this category unless the replacement returns comparable
accepted leads or evidence with lower account risk and acceptable manual effort.

## Test Design

Run a 30-minute manual review sprint using the same campaign intent that the
Apify actor is meant to support.

Suggested search prompts:

- `nonprofit website migration`
- `website redesign nonprofit CRM`
- `donor experience website migration`
- `nonprofit digital transformation website`

For each useful post, record only review-safe metadata:

| Field | Rule |
| --- | --- |
| `source_url` | Link to the post or search result if manually opened and relevant. |
| `author_or_org` | Publicly visible name only; no hidden profile data. |
| `snippet` | Short paraphrase of the relevant pain point or buying signal. |
| `signal_type` | One of `migration_pain`, `crm_donor_ops`, `website_redesign`, `fundraising_ops`, `other`. |
| `fit_score` | `1` to `5`, based on relevance to Portfolio outreach or value-evidence work. |
| `next_action` | `ignore`, `source_register`, `manual_follow_up`, or `needs_review`. |

Do not record private contact details, scrape profile fields, export connection
lists, or use automated actions.

## Acceptance Gate

The manual replacement wins only if it satisfies all of these:

- Produces at least 15 accepted evidence items or leads in a 30-minute sprint.
- Maintains a fit-score average of 3.5 or higher.
- Preserves source URLs and short human-written signal summaries.
- Avoids automated LinkedIn access and account-risky extraction.
- Requires less than 2 minutes of review time per accepted item.

If it cannot meet those gates, keep Apify for LinkedIn post search while
continuing to look for an approved lower-risk source.

## Decision Outcomes

| Outcome | Meaning | Action |
| --- | --- | --- |
| `replace` | Manual/browser review beats Apify on accepted-result quality and risk. | Pause Apify LinkedIn post-search actor and route the workflow to the source register. |
| `keep_apify` | Apify remains materially more efficient or comprehensive. | Keep Apify for this one category; continue pausing weaker actors. |
| `needs_official_api` | Manual review is too slow and Apify is too risky. | Investigate LinkedIn-approved partner/API paths before spending more. |
| `pause_category` | Neither path produces useful accepted results. | Pause LinkedIn post-search sourcing until a campaign owner proves need. |

## Next Run

After the sprint, append a result table here:

| Date | Reviewer | Minutes | Items reviewed | Accepted items | Avg fit score | Avg minutes per accepted item | Outcome |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Pending | Pending | 30 | Pending | Pending | Pending | Pending | Pending |
