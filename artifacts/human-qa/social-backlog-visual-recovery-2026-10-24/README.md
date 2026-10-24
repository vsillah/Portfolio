# Social Content backlog visual recovery QA

## Scope and eligibility

Read-only production inventory on 2026-10-24 found two approved, single-image Social Content records with the established `version_bound_provider_none_mp4` backlog source, a work-item binding, and no image, deterministic asset receipt, or visual review contract: Dark Castle (`21c492c2-9279-4e08-afc9-49207935a681`) and JEV (`f966123f-05eb-48ec-a7c2-970afce642ef`). This change generalizes the missing-contract recovery path to eligible records. Calendar items, drafts, carousels, records with a bound image or asset, and records with a review contract are excluded. The inventory read only status, IDs, platform, format, and contract markers; it did not copy post text or evidence into this packet.

## Exact local route and walkthrough

- Branch: `codex/social-backlog-visual-recovery`
- Reviewed code commit: `a21875b9ab4dfa62301b38ea1a91dde02a0265d2`
- Local route: `http://localhost:5202/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=visuals&qa_fixture=social_visual_backlog_recovery&rev=a21875b9`
- Fixture: local development only and read-only. Saved Copy approval and source presence are represented by fixture metadata; text and source identities are withheld. It does not load or modify the production row. Hosted deployments ignore it.
- Viewports: 1440 × 900 and 390 × 844.
- States: [desktop blocker](01-desktop-recovery.jpg), [desktop Copy gate](02-desktop-copy.jpg), [desktop YouTube preview](05-desktop-youtube.jpg), [phone blocker](03-phone-recovery.jpg), [phone Copy gate](04-phone-copy.jpg), [phone YouTube preview](06-phone-youtube.jpg).
- [MP4 walkthrough](recovery-walkthrough.mp4): 24.08 seconds, H.264, 1440 × 900, 578 frames. SHA-256: `1beb4d53050a56b34ae5d5c4aea65a77e15e8dfd7ee91f90242fe9b222be5c54`.

The MP4 sequences screenshots captured from the in-app browser as the recovery link was followed at both widths. It is a state walkthrough, not a continuous screen recording. Recreate it with `./render-walkthrough.sh`.

Observed: the missing-contract warning names the blocker, the same-record action opens `?step=copy#social-copy-gate`, and the Copy gate and stepper both show Approved with approval disabled. The right column shows a neutral YouTube review preview with no invented video, thumbnail, or public copy. Render and visual approval are disabled on the Visuals gate. No production mutation, provider call, media render/upload, platform draft, schedule, publication, or external send was exercised.

## Validation

- `./node_modules/.bin/vitest run lib/social-visual-contract-recovery.test.ts lib/social-visual-backlog-qa-fixture.test.ts lib/social-deterministic-visual.test.ts components/admin/SocialVisualContractRecovery.test.tsx components/admin/DarkCastleVisualRecovery.test.tsx 'app/admin/social-content/[id]/page.test.tsx' 'app/admin/social-content/[id]/social-visual-backlog-qa.test.tsx' 'app/api/admin/social-content/[id]/dark-castle-visual-qa.test.ts'` — 137 passed. The new route test asserts saved Copy approval, YouTube preview, absence of LinkedIn preview, disabled visual render, and GET-only fixture access.
- `MOCK_N8N=true N8N_DISABLE_OUTBOUND=true NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=qa-fixture-only SUPABASE_SERVICE_ROLE_KEY=qa-fixture-only npm run build` — passed after `npm ci --ignore-scripts --no-audit --no-fund` in this worktree.
- `ffprobe` confirmed the MP4 codec, size, frame count, and duration.
- `git diff --check` — passed.
- Repository-wide `tsc --noEmit` remains red on pre-existing test typing errors in campaign, JEV, Social Content page test, and other unrelated test files. No errors were reported in files added or changed by this lane.

PR #1133 owns three nearby regression test files. None of its edits are changed here. Integration Captain should sequence these dependent PRs and perform hosted review before any client-facing Human QA gate.
