# Official signals to Portfolio campaign: review state

This handoff uses one stable topic candidate in the existing Social Content backlog. It joins these exact public packets:

| Packet | Public source | Current production review state, October 21, 2026 |
| --- | --- | --- |
| `c10915a5-4cda-4d2b-843d-9d37e11c0790` | [OpenAI Agents API changelog](https://developers.openai.com/api/docs/changelog) | `review_ready`; source-bound measurement absent |
| `23427cb8-0331-4b18-9de0-5f2bd64abe02` | [Meta Forum engineering](https://engineering.fb.com/2026/10/15/ml-applications/how-meta-built-forum-ai-native-engineering/) | `review_ready`; source-bound measurement absent |
| `82919e2b-a395-4445-9248-11d4affbe08d` | [Meta Muse Wonder release](https://about.fb.com/news/2026/10/introducing-muse-wonder-models/) | `review_ready`; source-bound measurement absent |

The approved, public-safe Portfolio implementation receipts are `coverage:f3c15e47d4bb3cda04a021f3dec337db` for the governed agent control plane and `coverage:12167bf629f29cfadf8b267d426b6edd` for the memory/calendar path. These receipts prove repository implementation. They do not prove a customer outcome or grant content approval.

## Current blocker

The candidate key is `topic-portfolio-agentic-operating-system-official-signals-v1`. Read-only production inspection found no existing row for that key. The three packets remain pending and unmeasured, so no LinkedIn or YouTube review records or calendar bindings qualify. This document records the blocked state without running production reconciliation or changing production rows.

The existing Social Content evidence panel now shows the exact packet lineage, observed versus required evidence, owner, and recovery path. Its `Prepare exact review handoff` action persists one deduplicated backlog state when an admin deliberately runs it. The action creates two internal `draft` review records and binds two existing campaign calendar slots only after the source, freshness, Portfolio implementation, owned visual, privacy, originality, outlier, and calendar checks all pass. It does not approve copy or assets or call an external provider.

## Recovery sequence

1. In Social Content → Launch evidence, inspect each official packet and its exact public observations. The content reviewer approves the public claim in Content Intelligence only after each packet has three current source observations on distinct URLs across two hosts, including the official URL, with attention and relevance at or above `0.65`.
2. The Portfolio product owner captures a redacted, current `/admin/` route showing the governed agent decision. Record its owned asset path, SHA-256, capture time, rights and privacy review, and claim binding as an approved Portfolio source receipt.
3. Research records separate current LinkedIn and YouTube outlier decisions. Each needs at least five attributable same-channel public comparables, one normalized score at or above `75`, and zero performance weight for any curated playlist. Keep included and excluded comparisons traceable.
4. Content and privacy reviewers record passed receipts against the exact handoff input version shown in the evidence panel. Prepare one future LinkedIn and one future YouTube slot in the existing campaign calendar, under the same campaign, with `official_campaign_candidate_key` set to the key above. The slots remain pending and unbound until the handoff passes.
5. Reopen the evidence panel and run **Prepare exact review handoff**. An unchanged evidence version should return the same candidate, content identities, and bindings. If any gate fails, the backlog remains blocked with its next action and no channel record is created.

The YouTube title and thumbnail teaser are deliberately distinct. A product screenshot or exact route proof is required before review records can be created. The generated channel text is an internal starting point for review; final copy, final visual/media, thumbnail selection, provider use, platform drafts, external scheduling, and publication remain separate decisions.

## Local preview

Use `/admin/social-content?officialQa=campaign-handoff-v1#official-campaign-handoff` on the exact branch build. The fixture is synthetic, performs no source reads or writes, and shows the current blocked path. No live workflow or customer-data smoke was run for this PR.
