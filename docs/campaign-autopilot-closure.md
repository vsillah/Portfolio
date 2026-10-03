# Campaign autopilot closure

Audit: 2026-10-03 UTC. Base: `bada9bf1902e397d484e2aa1c9e1b949ccc09d62`.
Scope: repository inspection and GitHub deployment status reads. No provider calls, account configuration reads, database queries, external messages, scheduling, or activation.

## First delivery and remaining objective

This foundation adds `lib/campaign-release-manifest.ts` and adversarial contract tests. It is not connected to a route, Slack callback, database, or provider. No new approval authority is active. The existing per-recipient Gmail and final social approval gates remain authoritative.

The contract owns a deeply frozen parsed snapshot. SHA-256 covers all fields with sorted object keys and ordered arrays. Unknown fields fail validation. Copy bytes are preserved. Any material change, including a restored prior payload under a new revision, changes the approval digest. A fresh revision must be allocated by the future database transaction; the pure helper cannot enforce revision monotonicity or prevent caller fabrication.

Two classes are supported:

- `broadcast_release`: reviewed one-to-many publishing and HeyGen rendering.
- `relationship_outreach_batch`: exact-recipient Gmail sends, manual social handoffs, and parked Telnyx actions.

Both carry objective, campaign, audience, source identity/version, exact copy and metadata, asset hashes, account, schedule, USD spend caps, consent/suppression evidence and expiration, stop conditions, action IDs, and expected receipt types. Each relationship action names one recipient reference. References must resolve to immutable account/recipient snapshots in the integration; a mutable contact lookup must never silently change the authorized destination. Asset hashes must be verified against fetched bytes before use. Expiring URLs may be refreshed only when the fetched bytes match.

`campaignActionKeys` supplies a payload hash, a revision-bound idempotency key, and a stable campaign/source/account/recipient delivery key. The stable key deliberately survives copy changes. A later intentional repeat requires an explicitly distinct source action and new review; changing IDs cannot be used to evade reconciliation. Cross-campaign duplicate detection must additionally compare the underlying native queue/send identifiers.

## Capability matrix

“Built” means source exists. “Canary-tested” below means a historical receipt is checked into the repository, not a fresh live test. Configuration and production proof require current scoped evidence. No path is labeled production-proven by this audit.

| Path | Classification | Repository evidence | Live evidence or unresolved dependency |
| --- | --- | --- | --- |
| LinkedIn | Built | `lib/publishing/linkedin.ts`, `lib/social-content-publisher.ts`, `docs/social-release-safety.md` | Claims/fingerprint gate exist; current account, scope and accepted post receipt not verified. |
| Gmail | Canary-tested, historical single recipient | `docs/warm-outreach-qa/warm-gmail-send-canary-833e1019.md`, `lib/warm-outreach-slack-send-approval.ts` | Recorded message/thread identity from August 28; execution flag was removed. No batch or renewed-send authority. |
| HeyGen | Built | `lib/heygen.ts`, `lib/heygen-config.ts`, `app/api/admin/video-generation/generate/route.ts` | Privacy review, exact script/avatar/voice configuration, enforceable render cost limit, current account and completed render receipt required. |
| YouTube | Built | `lib/publishing/youtube.ts`, `lib/youtube-publication-reconciliation-preview.ts` | OAuth/account, exact final asset, metadata/privacy/schedule and upload identity need verification. |
| Instagram | Built | `lib/publishing/instagram.ts` | Account permissions and container-to-publication receipts unverified. |
| Facebook | Built | `lib/publishing/facebook.ts` | Page identity, scopes and post receipt unverified. |
| X | Built | `lib/publishing/x.ts` | Account/API entitlement and accepted post receipt unverified. |
| TikTok | Built | `lib/publishing/tiktok.ts` | App/account certification, publishing constraints and final publish status unverified. |
| Telnyx SMS | Blocked | `lib/warm-outreach-sms-live-execution.ts`, `lib/warm-outreach-sms-provider-readiness.ts` | Brand/campaign/sender certification and current recipient consent not verified. Manifest planner unconditionally returns `sms_parked`. |
| Slack | Built | `lib/slack-action-receipts.ts`, `lib/slack-receipt-canary.ts`, `docs/qa/slack-receipt-status-2026-09-12/README.md` | Existing receipt path and canary are not campaign approvals. Signed source/actor checks, durable campaign decision and original-card update need integration and scoped live proof. |
| n8n | Built; legacy SOC-002 obsolete/blocked | `lib/n8n.ts:triggerSocialContentPublish`, `docs/social-release-safety.md` | Native entry point refuses legacy publish dispatch. External workflow pause state and in-flight calls are not verified. |
| Portfolio | Built | Calendar handoff, Social Content, outreach, video-generation and Agent Ops receipt surfaces | Cross-channel manifest persistence and execution lifecycle are not built by this foundation. |
| Vercel | Configured; base checks passed | GitHub status API for the base SHA | Both `Vercel – portfolio` and `Vercel – portfolio-staging` returned success. No live route smoke performed. Branch checks must be assessed separately. |
| Supabase | Tools exposed; connection/schema verification pending | Callable production stdio and connector SQL/migration/table tools discovered; CLI MCP entries enabled | CLI auth reports Unknown/Unsupported, not verified authentication. No connection or migration parity claim. No schema changes made. |

Historical evidence is retained at its original source; this document intentionally excludes personal recipient data and provider credentials. No obsolete external workflow was disabled by this audit.

## Ordered dependency sequence

1. **Foundation (this PR):** immutable classes, canonical digests, bounded decision reducer, planning blockers, tests and audit. No user-facing workflow changes; rendered human QA and MP4 are not applicable to this contract-only step.
2. **Durable coordination:** inspect live schema using direct Supabase tools and reuse Agent Ops runs/approvals/events plus native queue records. Add an append-only manifest snapshot/decision/action ledger only where the existing records cannot enforce required uniqueness and transactions. Captain owns migration review/application. Prove concurrent approval and claim behavior against an isolated database, not mocks alone.
3. **Slack transaction and existing UI:** extend existing signed Slack actions/receipts with Approve release, Request revision, Hold, Open in Portfolio, and Emergency stop. Add compact review/receipt state to existing campaign/calendar, social, outreach and video surfaces. Never display an enabled approval button before durable callback handling exists.
4. **Vertical execution slice:** bind calendar brief, LinkedIn queue row, bounded warm Gmail batch, reviewed HeyGen job and final YouTube asset/metadata through native adapters. Dry-run reconciliation first; then separately approved provider canaries. Capture accepted provider IDs and canonical database receipts. A rendered video is new asset material: preauthorize render preparation separately, then review the resulting bytes in the publication manifest. One approval cannot authorize an unknown future video hash.
5. **Operator QA and certification:** exact-route narrow mobile, mid-width and desktop content-lane walkthroughs; click all affected actions and blocked recovery paths. Attach privacy-safe MP4 and screenshots from those routes. Captain checks both deployment contexts, reviews integration, and requests human QA. SMS stays parked until certification and explicit scope are proven.

The full objective remains open after step 1. Steps 2–5 must land in order; this document is the dependency handoff, not a claim of autopilot closure.

## Durable transaction requirements

The pure decision reducer expects trusted, authenticated inputs and is not an authorization boundary. Never accept a client-supplied review state, digest wrapper, actor identity or claimed provider gate as authoritative.

- Store immutable canonical manifest bytes, digest and monotonically increasing revision. Load and re-seal stored bytes server-side before every decision. Bind Slack source environment, workspace, channel, message and authorized actor to the stored approval record. Button values carry only opaque identity, revision and digest; never recipient copy or secrets.
- Use a transaction/CAS for pending-to-approved/held/revision-requested decisions plus append-only audit events. Replayed callbacks return the durable prior result. Old-card approval after hold or revision request requires a new manifest; emergency stop is absorbing for that revision. A campaign-level stop must also block newer revisions and stale-card workers until a separately reviewed restart.
- Atomically claim native actions and reserve spend before provider handoff. Enforce unique authorization keys and stable delivery keys. Check stop, source version, suppression, evidence expiry, provider/account readiness, schedule, remaining spend and native execution gates immediately before dispatch. A planning result with no blockers is not an execution claim.
- Stop conditions must use typed, enforced policies in the worker; the current text descriptions are review material only. A stop prevents further unclaimed work but cannot retract an accepted provider call. Inspect and cancel provider-side schedules through their own explicitly authorized path.
- Persist `claimed` before I/O. Timeout, interrupted worker, unknown response or failed receipt persistence becomes `uncertain`, retaining the delivery lock. Never treat a timeout as a safe retry. Reconcile by provider identity before any decision to resume. Retry automatically only when durable evidence proves dispatch never occurred.
- Match receipt to manifest digest, action ID, account, source, idempotency key, expected type and provider identity. Native provider receipts remain canonical. Failed/missing persistence is not completion. Partial success retains confirmed receipts and untouched pending actions; it never resets the entire batch.
- Treat Gmail draft creation, HeyGen rendering, upload, provider scheduling, publishing and sending as distinct external actions with separate gates. Enforce an actual maximum for metered spend; the manifest's number alone is not a vendor cap. No global expense rule overrides explicit provider or privacy gates.

## Ownership and operator recovery

Keep Shaka as coordinator and Yaa Asantewaa on existing automation contracts until a dedicated Campaign Orchestrator contract has clear scope. A dedicated role is justified once steps 2–3 exist: it would assemble manifests, reconcile native evidence and route blockers, with no inherent send authority. Select a culturally grounded display name after verifying the historical association; preserve technical keys. This PR does not create or rename agents.

For an uncertain action, open its existing native source record from the manifest, inspect the provider receipt/status, record reconciliation evidence, then request a new bounded decision for untouched work. Do not requeue a successful or uncertain action. For stale copy, return to the source editor, produce a new manifest revision, and issue a fresh review card. For stopped work, inspect in-flight and provider-scheduled actions before proposing restart. For a provider gate, show the exact missing certification/configuration/evidence and its existing Portfolio settings/review link.

Required evidence for closure: manifest identity/digest; per-action native references and receipts; decision actor/source/timestamp; concurrency and replay tests; enforced spend reservation; kill-switch race tests; uncertain-outcome recovery; exact route/viewport video; deployment SHAs; and unresolved provider gates. Synthetic fixtures cannot satisfy live receipt requirements.

## Foundation validation

- `npx vitest run lib/campaign-release-manifest.test.ts`: 27 tests passed.
- `npx vitest run lib/campaign-release-manifest.test.ts lib/social-approval-release.test.ts lib/social-sequential-release.test.ts lib/social-regeneration-release.test.ts lib/social-content-publisher.test.ts lib/agent-slack-actions.test.ts lib/warm-outreach-slack-send-approval.test.ts`: 121 tests passed across seven files.
- `npx eslint lib/campaign-release-manifest.ts lib/campaign-release-manifest.test.ts`: passed.
- `git diff --check`: passed.
- `npx tsc --noEmit --incremental false`: blocked by existing duplicate properties in `lib/social-comment-inbox-ui.test.ts:51–52` (also present on base) and absent ignored `lib/chatbot-knowledge-content.generated.ts`. No errors in changed files. Full production build not run while baseline typecheck fails.
- No UI changes, route smoke, live workflow/customer-data smoke, database writes, provider calls, or spending. No new MP4 is claimed for this foundation. Existing walkthroughs are historical evidence only; integration still requires its own exact-route recordings.
