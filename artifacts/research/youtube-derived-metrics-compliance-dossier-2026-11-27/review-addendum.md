# YouTube compliance review addendum — synthetic-only

> **2026-11-27 authority reconciliation:** This file's original `b832e832` observations and hashes are a historical inventory. Current review base is `2df663832b6b5868fc5f2dbe0a5d67b54e2f6c6b`. Production legal deployment `dpl_EunLzGy1LzjFjJz4dbip3tjYWvY7` from `90e567a5f683ed7d7b3e984c36a820b40c9a9d13` is live at `amadutown.com`; `/legal/privacy` and `/legal/data-deletion` passed desktop and 390×844, internal-link keyboard navigation, overflow and console checks. Current source hashes: privacy `3b05a8ac489093f363a9bc145651c3d790667b8abe87da1b563a896cea9ed291`, deletion `2b276efae9a7b56675c61fba1b6917a64ab198385e326fdbcf497ba1865670fa`. This resolves notice parity and request-route visibility, not a live purge or privacy/rights authority. Review-only retention design PR #1354 merged as `2df66383`; its synthetic trace, TypeScript, 8 GB build, both PR Vercel contexts and database health check passed. No external cohort store/job was activated. The [owner-review workbook](owner-review-audit-workbook.md) records the current form interpretation and remaining action-time gates.

**Status:** owner review; no audit submission, terms acceptance, live collection, evidence linkage, score activation, or production mutation. **Source commit:** `b832e83296bda150c17aff80b1794d3c9f94e345`. **Observed:** 2026-11-27 16:02 UTC. This addendum extends the original [dossier](../../../docs/content-strategy/youtube-derived-metrics-compliance-dossier.md) without replacing its historical source register or response hashes.

## Project and client binding

| Claim | Evidence and limit |
| --- | --- |
| Production selector | `YOUTUBE_CLIENT_ID` is configured for the Vercel `portfolio` production target. Source precedence is `YOUTUBE_CLIENT_ID`, then `GOOGLE_CLIENT_ID`, then `GOOGLE_GMAIL_OAUTH_CLIENT_ID` in `lib/youtube-oauth.ts` and the callback. Vercel's sensitive-variable API did not disclose a value. |
| Exact client match | Vambah reported that the current 1Password `Portfolio / prod` `YOUTUBE_CLIENT_ID` was SHA-256 hashed in process memory and the clipboard cleared; digest `087b837193068e592c387e0d5e64a41c2b26d532da65abb274f6a80dea1eb675`. He reported an exact match to Google Cloud OAuth client **Portfolio Gmail Drafts** in project `amadutown-advisory-solutions`, observed read-only on 2026-11-27. This packet contains no raw ID, secret, token, or key. This is owner-reported provenance, not an independent authenticated Console export. Reconfirm at submission. |
| Distinct authority | The client/project match does not establish amendment acceptance, OAuth consent, granted token scopes, quota, audit approval, privacy clearance, or media rights. No exact project-specific acceptance record is present. |

The Gmail OAuth flow uses the separate `GOOGLE_GMAIL_OAUTH_CLIENT_ID` key and requests `gmail.compose` and `userinfo.email` (`lib/gmail-user-api.ts`). Its production value was not fingerprint-matched in this review. The **client's name** does not prove that Gmail and YouTube flows use the same OAuth client ID.

## Whole-client route and scope inventory

All paths below are source inventory, not permission to invoke them. `social_content_config` is the server-side YouTube connection row; the OAuth callback stores tokens there. The admin config route now projects credential-safe metadata for default, filtered, `safe=true`, and PUT success responses. The bridge and publication preview read this row server-side.

| Surface | Scope / API use | Local or external effect | Review boundary |
| --- | --- | --- | --- |
| `GET /api/auth/youtube` and callback | Requests `youtube.upload`, `youtube.readonly`, `youtube.force-ssl`; exchanges code, then `channels.list?mine=true` with `id,snippet`. | OAuth state cookie; callback upserts connection tokens and channel settings in `social_content_config`. | Connection/consent workflow; excluded from synthetic execution. |
| `POST /api/admin/social-content/[id]/youtube-readonly-evidence` | Stored `youtube.readonly`; exact bounded `videos.list` (`snippet,contentDetails,statistics,status`) and `channels.list` (`statistics`); optional in-memory token refresh. | Reads three canonical DB rows; makes GETs and possibly token POST; returns an unscored observation response. No bridge DB writer. | **Do not invoke live.** `qualification_blockers` remain and `source_policy_expires_at=null`; no approval or persistence follows. |
| `POST /api/admin/social-content/youtube/publication-preview` | Stored `youtube.readonly` plus `youtube.force-ssl`; `videos.list` for an exact selected video. | Read-only reconciliation proposal; no token refresh or publish write. | Separate owned-channel workflow, not external cohort authority. |
| `POST /api/admin/social-content/engagement/refresh` and selected comment inbox routes | Stored `youtube.readonly` plus `youtube.force-ssl`; `commentThreads.list` and `comments.list`; refresh may update tokens and local comment/ingestion rows. | Internal engagement persistence. | Existing connected-channel workflow; do not include comment text or identities in the proposed external cohort. |
| Selected comment reply submission path | Stored `youtube.force-ssl`; `comments.insert` after canonical claim/readiness gates; token refresh may update connection row. | External reply and local submission evidence when separately authorized. | Outside this review's execution scope. |
| YouTube upload adapter / platform submission | Stored upload token; `videos.insert` multipart; token refresh and local publish status writes. | External upload when its independent human submission gate permits it. | Outside this review's execution scope. |
| `GET/PUT /api/admin/social-content/config` | No YouTube provider call; reads/writes connection configuration. | GET and PUT success return credential-safe projection after PR #1351; PUT still mutates configuration. | Do not call PUT. Presence booleans are not client identity or authority. |

The three requested YouTube scopes belong to the **YouTube OAuth connection path**, not to the proposed public-metadata use alone. Granted scopes for a stored token were not inspected. The separate Gmail key's client identity remains unverified.

## Proposed external-cohort field flow

This is a trace of the current bridge, not a statement that collection or derived use is approved. Request and route are exact Social Content/calendar/cohort/version bound. The bridge checks the active connection and `youtube.readonly` before calling YouTube. A missing, stale, private, unlisted, hidden, zero-denominator, mismatched, or out-of-band value is excluded or left null. The 15–60 second duration band is a Portfolio candidate rule, not proof of YouTube's own Shorts classification.

| Source field / derived item | Collection and in-memory use | Return, storage, and authority |
| --- | --- | --- |
| Video ID, channel ID, canonical URL | Exact approved seed; `videos.list` item ID and `snippet.channelId` checked against it. | IDs, URL, decisions, and exclusions may be returned to admin. No bridge persistence. Source/rights and freshness receipts remain absent. |
| `publishedAt`, `contentDetails.duration`, `status.privacyStatus` | Timestamp and duration parsed; public status, exact identity, age and duration band checked. | Observation and exclusion details may be returned. Private/unlisted and changed objects are excluded. |
| `statistics.viewCount`, `likeCount`, `commentCount` | Public counts parsed when returned; view count required, like/comment nullable. | Counts may be returned in records; no raw body stored by bridge. No approved refresh/expiry receipt exists. |
| Channel `statistics.subscriberCount`, `hiddenSubscriberCount` | Public nonzero subscriber count required; hidden/missing excluded; audience band calculated. | Public subscriber count and band may be returned; the band is a Portfolio classification requiring review before operational use. |
| Baseline video view counts | Same-channel seed video GETs; median calculated only from qualifying baseline rows. | Baseline IDs, median, exclusions and hashes may be returned; no bridge DB write. |
| Three ratios | `views / same-channel median`, `views / public subscribers`, and `views / age-days` are calculated in memory and may be returned. | **Permission-dependent proposed metrics.** Do not persist, link, rank, approve, or use them for a production decision without project-specific YouTube authority, privacy/rights clearance and a reviewed implementation gate. |
| Normalized method, score, outlier qualification | PR #1350 removed calculation and response fields. | `scoring_enabled=false`; no normalized score or outlier result is returned by the bridge. |
| HTTP status, endpoint/part, observation instant, response hashes | GET response bytes are bounded and SHA-256 hashed; parsed response and collection hashes are calculated separately. | Hashes and status may be returned. The raw body is discarded; a reported hash cannot independently prove the original bytes after the request. No issuable source receipt is created. |

**Boundary:** `persistence_enabled=false` describes the bridge only. Returning API-derived data to an admin caller is still a disclosure and must be governed. Other connected-channel workflows persist tokens, comments, publish status, and their own audit rows. No new external-cohort table, retention job, or evidence link was created here.

## Retention, deletion, privacy, rights, rollback

- The live privacy page describes the proposed public-metadata fields, 30-calendar-day **maximum** delete-or-refresh boundary, Google Privacy Policy link, and `/legal/data-deletion` path. The verified deployment and hashes are recorded above. Notice parity is not source-class approval.
- The live `/legal/data-deletion` page lets a requester identify a public video/channel URL or ID without a connected account. This is a request path, **not** an automated deletion endpoint or a production-smoked external-cohort purge. Current Developer Policies III.E.4.g call for user-requested deletion as soon as possible and within seven calendar days.
- The bridge holds response bodies and tokens in process memory, returns a bounded observation, and has no persistent external-cohort store. There is thus no bridge-held cohort to delete after a synthetic run. Any future persistence must first implement source-keyed deletion/refresh, revocation, requester verification, audit minimization, expiry enforcement and proof of purge; the current dossier's deletion-route smoke item remains open.
- Public facts do not clear creator-media rights or privacy. No title, description, handle, comment text, person identity, image, thumbnail, video or audio is in this proposed cohort. Rights and privacy decisions must be separate, version-bound approvals. Do not repurpose connected-channel comment or upload permissions for this cohort.
- On an invalid source, changed identity/status, revoked permission, privacy or rights objection, or policy change: stop use, invalidate any proposed receipt, remove any proposed derived use, and delete or refresh API data within the applicable limit. This packet has no production state to roll back; revert only its docs if rejected.

## Synthetic compliance demonstration

The [synthetic walkthrough](synthetic-demo.md) and [receipt](synthetic-demo-receipt.json) demonstrate the expected review decisions with invented placeholders. They make **zero** provider, database, or account calls and show no actual creator or learner data. The walkthrough covers accepted public fields, hidden-count and private-status exclusion, missing source/rights authority, disabled normalized scoring, no evidence linkage, the deletion-request path, and rollback. It is a review artifact, not a customer-facing or audit-submitted recording.

## Remaining submission gates

1. Reconfirm the production notice deployment and safe-config runtime version at submission. The production legal route parity was verified at `dpl_EunLzGy1LzjFjJz4dbip3tjYWvY7`; preview success alone is not production proof.
2. Obtain project-specific, accepted written authority for the exact analytics use case, three ratios, any future score/classification, and retention. No acceptance record was found. Audit form and attestations need owner review at action time.
3. Resolve the proposed ratio/audience-band use in code and privacy terms before any live external-cohort read. A source-class policy, privacy and rights receipts, exact freshness/expiry rule and data minimization decision are still absent.
4. The merged retention design is review-only. Implement, validate and production-smoke deletion/refresh and requester recovery for any future persisted cohort before claiming operational readiness.
5. Reconfirm the client fingerprint, granted scopes, quota/audit status, provider response provenance, and exact deployed versions for the single audit submission. These are separate checks.

**Stop state:** audit submission, terms acceptance, live provider collection, scoring, evidence linkage, derived persistence, notifications, media, upload, scheduling, publishing and other external actions remain disabled for this packet.

## Source binding

SHA-256 at the pinned commit: `lib/youtube-oauth.ts` `b872b85517ee14a717fb014befbb95afecdcc493e416ebf58bc6c2e5b054941f`; `lib/youtube-readonly-evidence-acquisition.ts` `322f85cb14b57c9e2fa1513b4b9e616026e2a8ea2729424323cd9acc0cedbe7d`; route `9cb819d0dde0367893901406347f04e8628710e37202f581faac9e776dd7c6c9`; safe config route `6d87178cb55b819f0b95331793b4df8a878cb68f80b60d53e847d6470efc908e`; privacy page `3b05a8ac489093f363a9bc145651c3d790667b8abe87da1b563a896cea9ed291`; deletion page `342ff852b37724cb0b592cd79b91e0655a82dd004fa39b1ad80fd7ed6f3df782`. The original dossier retains its own earlier source hashes and official-policy response hashes. Recheck current official policy and its revision at submission time.
