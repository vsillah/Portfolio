# YouTube description evidence review · 2026-10-20

## Scope and result

This is a repository-bound, read-only Social Content review fixture. Dark Castle Chess and AI Audit Calculator remain **Unscored at 1/3** qualifying full descriptions each. The requirement remains three distinct descriptions per campaign, score at least 75, and observation age strictly under 14 days. No content decision or external execution is enabled.

The source receipt is `artifacts/research/approved-youtube-campaign-descriptions-2026-10-19/receipt.json`. Its 14 previously included watch pages were rechecked against exact video identity and prior SHA-256 fingerprints. Thirteen full descriptions matched and one was unavailable. The bounded additional search is recorded in `artifacts/research/approved-youtube-campaign-descriptions-2026-10-19/search-recheck.json`; those candidates were not promoted into the approved score inventory.

## Rendered routes

- Dark Castle Chess: `/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?qa_fixture=social_campaign_review_assets_v1`
- AI Audit Calculator: `/admin/social-content/3dad4cca-72b7-4705-8fb6-273bf7500ce6?qa_fixture=social_campaign_review_assets_v1`

The routes were loaded in the Codex in-app Browser from this worktree's localhost server with local-only placeholder Supabase values and outbound n8n disabled. No production record was read or changed. The reviewed states show the Unscored gate, exact 1/3 count, attributable source, threshold and expiry, and disabled approval controls. Desktop was inspected at 1280 × 720; narrow layout at 390 px width (1000–1200 px capture height). There was no horizontal clipping of the evidence card at the narrow width.

## Media

`youtube-description-evidence-review.mp4` is a silent 20-second H.264 walkthrough assembled from four Codex Browser captures, ordered AI Audit desktop/mobile then Dark Castle desktop/mobile. The reviewed route is static and read-only, so the video shows the meaningful campaign and responsive states rather than an action sequence. The four JPEG captures are included separately. `ffprobe` confirmed H.264, 1280 × 720, 600 frames, and 20.0 seconds; an extracted frame was visually checked.

## Remaining gate

Capture two additional distinct, same-topic, full-description YouTube sources **per campaign**, with exact public URL and creator, current observation, complete description and fingerprint, full channel baseline, score components and recomputed score at least 75. Re-evaluate all included sources as one coherent cohort. Do not promote the search candidates or the saved playlist on title, popularity, or taste alone. The current evidence expires at the strict 14-day boundary after 2026-10-18T23:57:00Z.
