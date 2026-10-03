# Campaign Autopilot Closure: phase 2 qualification

This draft adds an offline packet assembler, durable local simulation, disabled provider interfaces, and readiness/receipt/recovery details on Campaign Release Review. No execution endpoint, provider SDK, migration, activation, upload, send, or production write was added or used. SMS remains parked.

## Implementation

- `lib/campaign-release-packet.ts` reads canonical export snapshots. Social membership follows calendar `social_content_id`; warm outreach follows `generation_inputs.calendar_source.id`; video follows `rag_context.social_video_production.video_generation_job_id`. Missing or ambiguous links block assembly. Source rows remain unchanged for fingerprint checks. Exact channel-review bindings cover source fingerprint, final copy/assets, account, recipients, and evidence expiration. Calendar timing must match. Packets are topologically ordered and deeply frozen. YouTube requires its final rendered asset and metadata.
- `lib/campaign-release-simulation.ts` provides durable-store transaction contracts, globally keyed delivery attempts within a store namespace, owner/version checks, dependency receipts, reservation/spend accounting, definite no-dispatch retry, and uncertain-outcome reconciliation. Unknown outcomes retain both claim and reservation. Reconciliation never dispatches. Receipts are explicitly synthetic.
- `lib/campaign-release-file-store.ts` implements local transactions with an exclusive directory lock, fsynced temporary snapshot, atomic rename, and directory fsync. Restart preserves attempts and budget. A crashed process's lock is never stolen automatically. Different directories are independent simulation namespaces; this is not a distributed production store.
- Provider interfaces for social, manual warm outreach, HeyGen, YouTube, Gmail and Slack return blocked preflight and reject execution. Telnyx remains parked. The simulator cannot accept an executable provider callback.
- `lib/campaign-release-progress.ts` strips owner tokens and raw events from client summaries. Campaign Release Review shows reservations, spending, attempt counts, dependency status, synthetic receipt IDs, and channel-review recovery links. Without supplied simulation evidence, it explicitly reports disconnected execution storage. The deployed release API remains unchanged.

## Validation

Commands run from this worktree:

```sh
node_modules/.bin/vitest run lib/campaign-release-*.test.ts 'app/api/admin/campaigns/[id]/releases/route.test.ts' 'app/admin/campaigns/[id]/page.test.tsx'
node_modules/.bin/eslint lib/campaign-release-{packet,simulation,file-store,progress}*.ts components/admin/CampaignReleaseReview.tsx scripts/qa/campaign-release-phase2-fixtures.ts
node --import tsx scripts/build-chatbot-knowledge.ts
node_modules/.bin/tsc --noEmit --pretty false
node --import tsx scripts/qa/campaign-release-phase2-fixtures.ts
node scripts/qa/slack-receipt-status-server.cjs
node scripts/qa/campaign-release-phase2.cjs
git diff --check
```

Focused tests: 72 passing. Changed-file ESLint and whitespace checks pass. After generating the ignored knowledge module, full typecheck is blocked by existing duplicate properties at `lib/social-comment-inbox-ui.test.ts:51-52`; no phase-2 type errors were reported. Production build was not run while that baseline typecheck fails.

Browser tests exercise the actual localhost campaign route with intercepted synthetic API responses, isolated synthetic auth, and blocked outbound traffic at 390, 768, and 1440 pixels. The new recovery link is clicked. Existing approve, revise, hold, stop, scope, evidence-expired, unavailable and empty states are also exercised. Simulation progress snapshots come from the actual packet/claim/no-dispatch/retry/reconcile code and a durable local store. Screenshots at all three widths were visually inspected. The integrated browser was opened to the same route but lacked fixture interception and reported Campaign not found; it is not counted as successful route QA. Automated recordings use isolated Chromium.

Evidence: `docs/campaign-autopilot/qa/phase2/`, including MP4 at every viewport, disabled/uncertain/confirmed screenshots, and result JSON. This is local synthetic evidence, not a live campaign, preview authorization, provider delivery or deployment proof.

## Follow-on gates and risks

1. Wire canonical read-only loaders and existing channel-review attestations into an operator packet-preparation path. The snapshot reader is implemented; live database loading and UI assembly are not connected.
2. Supply a transactional distributed execution store before serverless/provider execution. The filesystem implementation qualifies local restart/CAS behavior only. Stale-lock recovery requires verifying that the prior process stopped, inspecting `state.json`, preserving uncertain attempts, then removing only the stale `transaction.lock`; no automated timeout takeover exists.
3. Connect authenticated progress/reconciliation routes to that store. The current production release API does not return simulation progress or run the simulator.
4. Certify provider-specific consent, suppression, final-submission, budget, and emergency-stop checks. The existing phase-1 coordinator remains unchanged and is not backed by this simulation store. The simulation APIs intentionally cannot dispatch.
5. Captain review, baseline typecheck repair, both Vercel contexts, and human QA remain required. Stop before merge.

Base: `38df8c1a28166e1f042983bec1eb7a8220533001` (#1001). Open PR inspection found no direct file overlap; #976 owns Slack canary/status tests, #999 owns testing/remediation routes. No changes were made to those files. Branch: `codex/campaign-autopilot-phase2`.
