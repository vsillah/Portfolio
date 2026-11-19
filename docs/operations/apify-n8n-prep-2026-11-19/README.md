# Apify / n8n workflow preparation — 2026-11-19

Status: **review only**. This packet makes no change to n8n, Apify, credentials, schedules, or production data. It does not run an Actor.

## Bound sources

The published n8n workflows were captured read only on 2026-11-19. Their complete JSON baselines are in a private local evidence directory outside the repository. `manifest.json` gives their SHA-256 digests and active version IDs. Re-read each workflow and compare its active version ID and the target node's original code hash before any later application; stop on drift.

| Workflow | ID | Published version | Observation |
| --- | --- | --- | --- |
| Production WF-MON-001 | `HqpDGIHxvJqXKHuT` | `c5bddd5b-9b7c-4c78-8133-e71842238d76` | Checks two Actor IDs, including a stale LinkedIn target. |
| Staging WF-MON-001 | `R5xVO3JBGMBjQ9f5` | `8089ad6c-534b-4530-9065-da38c44a70a0` | Checks the same two IDs. |
| Production Facebook warm leads | `SGGvj8MavKXYcJZL` | `d3d1a639-25fa-41a1-95e7-ca21e6c8eefd` | Has three Apify nodes, all without Actor input parameters. |
| Production LinkedIn warm leads | `oMUimdg7FTFDut9i` | `09133bd0-659b-47dc-b586-14636e7326af` | Has two Apify nodes. |

The production workflows' actual Actor IDs are:

| Workflow | Node | Actor ID |
| --- | --- | --- |
| Facebook | Scrape FB Friends (Apify) | `alien_force~facebook-scraper-pro` |
| Facebook | Scrape FB Groups (Apify) | `mdgjtp1~facebook-group-member` |
| Facebook | Scrape FB Post Comments (Apify) | `apify~facebook-comments-scraper` |
| LinkedIn | Scrape LI Connections (Apify) | `addeus~get-connections` |
| LinkedIn | Scrape LI Post Engagement (Apify) | `harvestapi~linkedin-profile-posts` |

## Prepared production monitor change

`production-monitor-candidate.patch.json` binds a single `Check Actor Runs` node field, `parameters.jsCode`, to the captured production monitor version and original code hash. `production-monitor-code.diff` shows the exact proposed code change. `production-monitor-check-actor-runs.js` is the standalone candidate for syntax and output checks. It enumerates all five Actor IDs that the two production warm-lead workflows use. The monitor's existing downstream `Fetch Actor Runs` request already sends the Apify token in an Authorization header and is outside this proposed edit.

**Do not apply this candidate yet.** The Facebook workflow cannot currently supply valid Actor input. Monitoring all five targets now could produce expected `no_runs` or failure alerts that do not distinguish that known defect from a new incident. The later decision should sequence Facebook repair and monitor publication, then confirm alert behavior before leaving the monitor active.

## Facebook input contract blocker

Production execution `33355` stopped at `Scrape FB Friends (Apify)` with HTTP 400: `Input is not valid: Field input.function is required`. The three Facebook nodes currently specify only `actorId` in their parameters, so later nodes have unresolved input requirements too.

Read-only public default-build input schemas showed:

| Actor | Required field | Missing decision or value |
| --- | --- | --- |
| [`alien_force~facebook-scraper-pro`](https://api.apify.com/v2/acts/alien_force~facebook-scraper-pro/builds/default) | `function` | Current enum has `facebook_search_scraper`, `facebook_profiles_scraper`, `facebook_posts_scraper`, `facebook_comments_scraper`; it has no friends function. The product intent for “Scrape FB Friends” must be resolved before selecting a function or Actor. |
| [`mdgjtp1~facebook-group-member`](https://api.apify.com/v2/acts/mdgjtp1~facebook-group-member/builds/default) | `groupId` | No group ID or approved source for it is defined in the workflow. |
| [`apify~facebook-comments-scraper`](https://api.apify.com/v2/acts/apify~facebook-comments-scraper/builds/default) | `startUrls` | No post URLs or approved source for them is defined in the workflow. |

These are current public schema observations, not a claim that the Actors' run semantics, cost, or required login material are established. [Apify's schema specification](https://docs.apify.com/actors/development/actor-definition/input-schema/specification/v1) describes input validation at Actor run start. No input repair is prepared for application; guessing values would change the workflow's purpose or source data.

## Staging and credential coverage

The live staging warm-lead workflows reviewed are webhook/synthetic smoke flows with no Apify nodes. The staging monitor's intended targets and account binding are therefore unresolved. The production target list must not be copied into staging without an explicit operating decision.

n8n credential listing returned `403 NOT_SUPPORTED`, preventing a read-only confirmation of credential identity and age. The Apify connector returned `user-or-token-not-found`, so this review used public Actor metadata and default-build schemas without authentication. Neither result authorizes a credential change.

## Validation and later rollback

Local validation should confirm the captured JSON digests, the production monitor node's original code hash, exact match between candidate IDs and production Apify nodes, JavaScript syntax and five emitted items, plus a clean diff. Before a later live update, recapture all affected published versions and compare them with this packet. Validate the monitor through read-only API requests and its non-billable execution output; do not start an Actor just to test it. Confirm alert behavior for Actors with no legitimate runs.

If a later approved monitor publication misbehaves, restore only the original `Check Actor Runs` code from the private immutable production monitor baseline, publish that workflow, and verify the restored active version and non-billable monitor output. This packet does not modify staging or Facebook, so it creates no rollback action for those workflows.

## Decisions required for the next phase

The workflow owner needs to specify what “Facebook friends” means here and the supported Actor/function that performs it; identify the approved source of `groupId` and comment `startUrls`; and state whether staging should monitor an Apify account at all and, if so, which account and Actor set. Do not send session cookies, API tokens, recovery codes, or private source records in chat. A separate bounded approval is required before changing and publishing live workflows. Confirm Actor pricing and any session/authentication requirement before a test run; this packet authorizes no run or charge.
