# YouTube derived-metrics compliance dossier

- **State:** review-only preparation packet; incomplete; not submitted.
- **Project:** `amadutown-advisory-solutions`
- **Prepared against:** Portfolio `30c68dcec9ca50108cae7bbcfc845ff04d627af6`
- **Prepared:** 2026-11-27 09:30 ET / 2026-11-27 14:30 UTC
**Machine-readable packet:** `artifacts/research/youtube-derived-metrics-compliance-dossier-2026-11-27/application-candidate.json`

This dossier prepares the evidence needed for an explicit YouTube API compliance review. It is not legal advice, an accepted amendment, a quota request, a policy receipt, or permission to calculate, retain, link, display, or publish derived metrics.

## Current decision

Portfolio cannot treat OAuth consent, API enablement, public metadata access, or the absence of an objection as acceptance of YouTube's additional derived-metrics rules. Current YouTube policy says the additional rules apply to audited analytics use cases that explicitly apply through the standard audit and quota-extension process. The official derived-metrics page directs an applicant to identify **Analytics & Reporting** in Section 5 to accept the amendment.

The correct next external gate is therefore a reviewed compliance-audit submission, not a Google Cloud technical-support purchase. Until YouTube returns a project-specific determination:

- `scoring_enabled=false`;
- `persistence_enabled=false` for a derived cohort or score;
- `evidence_linkage_enabled=false`;
- no production packet may rely on a calculated outlier result;
- non-authorized API data remains subject to delete-or-refresh within 30 calendar days and any earlier applicable requirement;
- no audit form, provider message, notification, upload, schedule, publication, or other external action is authorized by this dossier.

## Exact system binding

| Binding                                  | Review value                                                                                           | Status                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Cloud project                     | `amadutown-advisory-solutions`                                                                         | Authenticated project identity previously observed; submission must reconfirm it.                                                                 |
| Portfolio base                           | `30c68dcec9ca50108cae7bbcfc845ff04d627af6`                                                             | Exact current main used for this dossier.                                                                                                         |
| OAuth client                             | Resolved at runtime from `YOUTUBE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, or `GOOGLE_GMAIL_OAUTH_CLIENT_ID`    | Exact deployed client ID and a safe SHA-256 fingerprint must be captured at the submission review gate; no credential belongs in this repository. |
| OAuth scopes requested by current client | `youtube.upload`, `youtube.readonly`, `youtube.force-ssl`                                              | Declared in `lib/youtube-oauth.ts`; the audit must describe the whole client, even though the evidence bridge uses only `youtube.readonly`.       |
| Evidence bridge                          | `youtube-readonly-evidence-acquisition-v2`                                                             | Fixed GETs to `videos.list` and `channels.list`; access-token refresh is in-memory; result and credentials are not persisted by the bridge.       |
| Initial review target                    | Social Content `f966123f-05eb-48ec-a7c2-970afce642ef`; calendar `669f6c22-d373-4423-bf7c-77661c484302` | Remains unlinked and unscored.                                                                                                                    |
| Privacy notice candidate                 | PR #1348, `d81d58cbd4954f7c92bdcda37b91685f06c03cf7`                                                   | Human-QA approved but still draft and undeployed. It cannot be represented as the current public notice.                                          |
| Source-class policy                      | `docs/content-strategy/youtube-external-metadata-source-policy-review.md`                              | Inactive review-only governance documentation.                                                                                                    |

## Proposed analytics use case

Portfolio prepares internal, human-reviewed evidence for AmaduTown content. For a YouTube Shorts candidate, the proposed analytics path would:

1. read a bounded, pre-approved set of public `videos.list` and `channels.list` objects;
2. verify exact video, channel, publication, duration, public-status, and observation identities;
3. require at least five same-channel, Shorts-format, audience-band-matched comparisons;
4. compare each candidate with its own same-channel Shorts baseline;
5. calculate a Portfolio-labelled performance score using the declared ratios and percentiles below;
6. use that result only as one internal review input, never as a YouTube-provided metric, causal claim, creator endorsement, or permission to copy a creator's media;
7. retain Human QA and all publication locks.

### Requested calculations

| Portfolio calculation          | Inputs from YouTube API data                                                                     | Purpose and boundary                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Channel-relative ratio         | Comparable views / median views of approved same-channel Shorts baseline                         | Normalizes a public video's views against its own channel history.                                                                               |
| Audience-view ratio            | Comparable views / public subscriber count                                                       | Provides an audience-band-relative comparison only when the subscriber count is public and non-zero.                                             |
| Recency-adjusted views per day | Comparable views / age in days                                                                   | Makes observation maturity explicit; items younger than 24 hours are excluded.                                                                   |
| Normalized performance score   | 50% channel-relative percentile + 30% audience-view percentile + 20% recency-adjusted percentile | Portfolio-generated internal score. It must be labelled as Portfolio analysis and remain disabled until YouTube expressly accepts this use case. |

Hidden, missing, zero-denominator, private, unlisted, deleted, mismatched, cross-format, immature, stale, or unsupported records remain excluded. No value is inferred.

## Data minimization

### Requested public fields

- video ID and channel ID;
- canonical public object URL;
- publication timestamp and observation timestamp;
- ISO-8601 duration and parsed duration;
- public status;
- public view, like, and comment counts when returned;
- public subscriber count when returned and not hidden;
- endpoint, requested `part`, HTTP status, raw-response SHA-256, and canonical parsed-response SHA-256.

### Excluded from this request

- private or unlisted objects;
- individual viewer, subscriber, or commenter identity;
- comment text, contact information, location, or protected-trait inference;
- creator media, thumbnails, audio, video, or likeness reuse;
- titles, descriptions, tags, handles, and creator names as scoring inputs;
- ad-impression, revenue, CPM, or financial-performance claims;
- cross-platform normalization;
- automated approval, publication, outreach, or provider action.

## Retention, privacy, and rights controls

- The current operational ceiling is delete-or-refresh within 30 calendar days for non-authorized API data. The ceiling does not create a freshness receipt or guarantee that an observation remains current for 30 days.
- Any accepted extended-retention permission must be bound to the exact project, client, analytics use case, policy version, approval receipt, permitted fields, permitted calculations, and re-audit or expiration terms.
- Privacy clearance and media/creator rights clearance remain separate gates. Public factual metadata does not authorize reuse of expressive media or imply creator endorsement.
- Raw provider responses, derived cohort files, and scores must remain inaccessible to customer-facing surfaces unless a later, separately reviewed policy explicitly permits the display.
- Deletion and refresh events must retain a minimal compliant audit tombstone only when the accepted policy permits it.

## Audit-form answer workbook

The final form must be re-opened immediately before submission because fields and attestations can change. Never paste secrets into this packet.

| Form area             | Prepared answer or required evidence                                                                                                                                          | Gate                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Request type          | Compliance audit associated with the analytics/derived-metrics permission path described by YouTube policy. Do not claim a prior re-audit request.                            | Confirm the form offers a truthful request type before submission.                              |
| Organization          | AmaduTown Advisory Solutions; project `amadutown-advisory-solutions`.                                                                                                         | Confirm legal/entity and contact details with the authorized owner.                             |
| API client            | Portfolio admin and evidence-review application.                                                                                                                              | Record deployed URL, client-ID fingerprint, environments, and exact owner.                      |
| Business purpose      | Prepare internal evidence for AmaduTown content; no data brokerage, creator ranking product, ad-delivery safety claim, or public leaderboard.                                 | Confirm the description matches the running product.                                            |
| API access            | Documented `videos.list` and `channels.list` reads for the proposed evidence path; current client also has upload/comment-related scopes used by separate approved workflows. | Disclose the whole API client rather than presenting the read-only bridge as the whole product. |
| Analytics & Reporting | Request explicit permission for the four Portfolio calculations above and only the stated internal Human-QA purpose.                                                          | No broader equivalence or unspecified future analytics.                                         |
| Storage               | Request only the minimum retention needed for reproducible internal review. Continue the 30-day delete-or-refresh ceiling unless YouTube explicitly grants a different bound. | Do not assume the general 36-month maximum is granted.                                          |
| Privacy               | Bind the deployed privacy notice version, Google Privacy Policy link, access controls, deletion path, field list, purpose, and retention behavior.                            | PR #1348 is not sufficient until separately merged and deployed.                                |
| Security              | Server-side credentials; no credential returned to the review client; in-memory refresh; no token in logs, receipts, screenshots, or committed artifacts.                     | Confirm with current implementation and deployment configuration.                               |
| Demonstration         | Synthetic or redacted walkthrough showing setup, field minimization, exclusions, provenance, Human QA, disabled external actions, refresh/deletion, and rollback.             | No real creator data is required in the review recording.                                       |
| Attestations          | Review each live attestation verbatim with the authorized owner.                                                                                                              | Never pre-check or infer agreement.                                                             |

## Submission readiness checklist

The application is **not ready to submit** until every item below is satisfied:

- [ ] Exact deployed OAuth client ID is matched to `amadutown-advisory-solutions` and stored only as an approved safe fingerprint.
- [ ] Current running routes, scopes, and API methods are inventoried, including upload/comment workflows sharing the client.
- [ ] Proposed score formulas and all cohort exclusions are confirmed against the exact current code.
- [ ] Data-flow and retention/deletion diagrams are complete.
- [ ] PR #1348 or a superseding privacy notice is separately approved, merged, deployed, and hashed.
- [ ] Data-deletion route is production-smoked.
- [ ] Synthetic/redacted demo and reviewer instructions are complete.
- [ ] Every live audit-form answer and attestation has been captured in a version-bound review artifact.
- [ ] The authorized owner approves the exact application packet and single submission.
- [ ] The submitter can preserve the confirmation page, timestamp, reference number, submitted text, and attachment hashes.

## Approval response handling

An approval is usable only if it identifies the project or client, accepted use case, permitted calculations, retention allowance, policy/amendment version, effective time, conditions, and any re-audit or expiration requirement. Silence, API enablement, OAuth consent, a quota allocation, or a generic support response is insufficient.

If approved, create a separate immutable authority receipt and a separate implementation task. If denied, ambiguous, or narrower than requested, keep scoring and linkage disabled. If YouTube requests changes, prepare a new review-only response packet; do not silently change production behavior.

## Rollback

This phase creates repository documentation only. Rollback is removal of this dossier and its machine-readable candidate. It does not alter production records, provider configuration, OAuth credentials, privacy behavior, calendar records, evidence packets, or external actions.
