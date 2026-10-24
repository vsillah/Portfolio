# Social Content backlog visual recovery QA

## Scope and eligibility

Read-only production inventory on 2026-10-24 found two approved, single-image Social Content records with the established `version_bound_provider_none_mp4` backlog source, a work-item binding, and no image, deterministic asset receipt, or visual review contract: Dark Castle (`21c492c2-9279-4e08-afc9-49207935a681`) and JEV (`f966123f-05eb-48ec-a7c2-970afce642ef`). This change generalizes the missing-contract recovery path to eligible records. Calendar items, drafts, carousels, records with a bound image or asset, and records with a review contract are excluded. The inventory read only status, IDs, platform, format, and contract markers; it did not copy post text or evidence into this packet.

## Exact local route and walkthrough

- Branch: `codex/social-backlog-visual-recovery`
- Reviewed code commit: `29040f3834290d68f14f29bfdef541fd79deecae`
- Local route: `http://localhost:5202/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=visuals&qa_fixture=social_visual_backlog_recovery&rev=29040f38`
- Fixture: local development only and read-only. Saved Copy approval and source presence are represented by fixture metadata; text and source identities are withheld. It does not load or modify the production row. Hosted deployments ignore it.
- Viewports: 1440 × 900 and 390 × 844.
- States: [desktop overview](00-desktop-overview.jpg), [desktop blocker](01-desktop-recovery.jpg), [desktop Copy gate](02-desktop-copy.jpg), [desktop YouTube preview](05-desktop-youtube.jpg), [phone overview](00-phone-overview.jpg), [phone blocker](03-phone-recovery.jpg), [phone Copy gate](04-phone-copy.jpg), [phone YouTube preview](06-phone-youtube.jpg).
- [MP4 walkthrough](recovery-walkthrough.mp4): 32.08 seconds, H.264, 1440 × 900, 770 frames. SHA-256: `6bc018958ffdd4c4b93a111968f4115d593f670dd4501d95813e0fec477de967`.

The MP4 sequences screenshots captured from the in-app browser as the recovery link was followed at both widths. It is a state walkthrough, not a continuous screen recording. Recreate it with `./render-walkthrough.sh`.

Observed: the read-only route no longer disables or dims its whole approval surface. Both Social Content sticky-header variants use an opaque theme background without backdrop blur. On the reviewed dark desktop and phone route, the computed header background was `rgb(18, 30, 49)` and backdrop filter was `none`; scrolled workflow cards no longer show as colored shadows through it. Back navigation, step navigation, and review disclosures work, while the visual format control, render, visual approval, Copy approval, and editing remain blocked. The missing-contract warning names the blocker, the same-record action opens `?step=copy#social-copy-gate`, and the Copy gate and stepper both show Approved. The right column shows a neutral YouTube review preview with no invented video, thumbnail, or public copy. No production mutation, provider call, media render/upload, platform draft, schedule, publication, or external send was exercised.

## Validation

- `./node_modules/.bin/vitest run lib/social-visual-contract-recovery.test.ts lib/social-visual-backlog-qa-fixture.test.ts lib/social-deterministic-visual.test.ts components/admin/SocialVisualContractRecovery.test.tsx components/admin/DarkCastleVisualRecovery.test.tsx 'app/admin/social-content/[id]/page.test.tsx' 'app/admin/social-content/[id]/social-visual-backlog-qa.test.tsx' 'app/api/admin/social-content/[id]/dark-castle-visual-qa.test.ts'` — 138 passed. The route tests assert opaque, non-blurred sticky headers in both detail variants, an enabled read-only review surface, safe step navigation, blocked format changes, and GET-only fixture access.
- `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=qa-fixture-only SUPABASE_SERVICE_ROLE_KEY=qa-fixture-only npm run build` — passed from a clean `.next` after stopping the local dev server sharing that output directory.
- `ffprobe` confirmed the MP4 codec, size, frame count, and duration.
- `git diff --check` — passed.
- Repository-wide `tsc --noEmit` remains red on pre-existing test typing errors in campaign, JEV, Social Content page test, and other unrelated test files. No errors were reported in files added or changed by this lane.

PR #1133 owns three nearby regression test files. None of its edits are changed here. Integration Captain should sequence these dependent PRs and perform hosted review before any client-facing Human QA gate.
