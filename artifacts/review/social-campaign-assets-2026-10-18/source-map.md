# Social Content campaign asset source map

This package supports internal review of the approved next-week Jev, Dark Castle Chess, and AI Audit Calculator campaigns. It performs no provider call, paid render, upload, platform-draft creation, scheduling, publishing, external send, credential change, migration, or production write.

## LinkedIn visuals

| Review asset | Product proof | Source receipt | What it supports | Boundary |
| --- | --- | --- | --- | --- |
| `public/review-assets/social-content/campaign-review/jev-linkedin-decision-system.png` (`sha256:5927f3b90b7895145464fb3c95d3c0d962214c2257379766bc892e43aa7bb141`) | `artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-operator-field-guide.png` | `sha256:7e123f1c11a156e86b36e0d2306ad1f42d97d3c63dac335588e804f6bc74f8e9` | Decision-only AI, typed probability, policy bands, human ownership, and receipts | Illustrative thresholds; live-provider reliability remains unproven |
| `public/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png` (`sha256:f31f4dd07484c769c7dfd3b43c95269540facd387ca82a02fea2a15ff19c8334`) | `public/review-assets/social-content/dark-castle-customer-facing-poster.png` | `sha256:e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78` | Owned gameplay board, decision guidance, notation, and coaching state | Product-state proof only; no measured learning outcome |
| `public/review-assets/social-content/campaign-review/ai-audit-linkedin-hidden-bill.png` (`sha256:73263abe49dc749383050e91cf10cab3266451eba866bf0b661d8bb88aa9efd5`) | `public/audit_calculator_img.png` | `sha256:bef9eeb1d8d15f7b4197bb03240c27a3b6b96fe114ce06f4c7027690c3e49b97` | Owned result UI, captured dimensions, scores, and action guidance | Product UI proof only; no customer outcome or ROI benchmark |

The deterministic generator is `scripts/generate-social-campaign-review-visuals.mjs`. It uses local Sharp composition and the default portrait AmaduTown shield at `public/amadutown-logo-upscaled.png`. It does not use a model or media provider.

## Drive search receipt

The documented AmaduTown Drive roots were searched for Jev, audit-calculator, Dark Castle Chess, product, dashboard, and screenshot assets. No more authoritative campaign-specific proof was found than the checked-in Jev field guide, Dark Castle gameplay proof, and AI Audit Calculator screen above. No Drive file was copied into this package. The existing approved Jev Shorts receipt remains the exception: it already records its exact Drive subject asset and staged output.

## YouTube packaging

- Jev reuses `thumbnail:jev:youtube-shorts:20261018:v5` exactly: title `AI Scored It. Who Makes the Call?`, thumbnail hook `WHEN SHOULD AI STOP?`, and `/review-assets/social-content/jev-youtube-short-thumbnail-v5.png`. Its distinct-copy performance claim remains Unscored.
- Dark Castle Chess binds `cohort:youtube:chess-decision-learning:20261018:v1` to `thumbnail:dark-castle:youtube-long-form:20261018:v2`. Eight public long-form examples qualified. The 1280×720 candidate uses the `full-bleed-decision-board-bottom-hook` family: the owned board is dominant, the decision square and consequence path are highlighted, and the hook occupies a bottom band. Its source, scores, copy pair, composition signature, adopted traits, rejected traits, and candidate hash live in `artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/`.
- AI Audit Calculator binds `cohort:youtube:ai-cost-audit-roi:20261018:v1` to `thumbnail:ai-audit:youtube-long-form:20261018:v2`. Six public long-form examples qualified. Three were excluded because their subscriber count or same-channel baseline could not support reproducible normalization. The 1280×720 candidate uses the distinct `human-anchor-tilted-calculator-question` family: an approved first-party Vambah portrait anchors the left side, the ownership question leads, and the owned calculator result is tilted on the right. Its source, scores, copy pair, composition signature, adopted traits, rejected traits, and candidate hash live in `artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/`.

Both v2 receipts bind to batch `social-campaign-youtube:20261018:v2`. The canonical batch validator rejects duplicate layout families or composition signatures unless every repeated candidate cites the same explicit evidence-required exception receipt. Generic fallback signatures fail closed.
- Both title-thumbnail relationships remain editorial hypotheses. Their performance state is Unscored. A product-proof PNG and SHA receipt alone do not qualify as YouTube packaging evidence.
- Each review projection exposes a thumbnail only after its version-bound `ArtifactEvidenceManifest` passes `validateYouTubePackagingEvidence`. The descriptions remain independently Unscored at 0/3, so final video generation stays blocked.

## Production read receipt

Production was queried read-only for the six supplied `social_content_queue` records and six supplied `social_content_calendar_items`. The two blocked YouTube calendar rows both reported `blocked_missing_outlier_cohort` and: `Only 0 fresh, attributable same-topic outlier description(s) qualified; 3 are required.` No production row was changed.
