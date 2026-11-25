# Phase 5D decision receipt capture contract

## Boundary

This phase supplies a versioned, review-only receipt contract and an optional local archive. It has no Human QA user interface, production database binding, provider connection, label promotion, or external action path. The retained historical cases remain unresolved. A receipt can be captured only from an already qualified Phase 5A fixture and an explicit, pre-existing human approval source whose bytes bind the exact decision. A recording, PR merge, visual similarity, or general approval cannot satisfy that source.

## Bound decision

`decision-receipt.schema.json` defines `evidence-repair-decision-receipt/v1`. The capture binds one `case_id` and fixture digest to candidate and blocker versions, playbook, before and after meaning and claim IDs, complete approved change and rollback, reviewed and approved fields, explicit scope exclusions, an artifact version, content and artifact paths and SHA-256 digests, PR number, full commit SHA, reviewer identity and human authority role, approval timestamp, approval source path and digest, all source paths and digests, privacy and rights clearance with review time, and the eight external-action exclusions. It verifies the source, content, artifact, and approval bytes through a caller-supplied read-only resolver. The approval source must be JSON with exact matching fields. Unknown or uncleared privacy or rights, incomplete authority, stale versions, missing hashes, or changed meaning fail before construction.

The receipt has a canonical SHA-256 over all bound fields other than its own digest. `appendDecisionReceipt` uses an exclusive-create file keyed by a hash of the case ID. Exact replay returns the existing bytes; a different decision for the same case fails. Callers must keep that directory under appropriate access control and retain the original source bytes. The hash is tamper evidence, not a digital signature or independent proof that the named person approved; the approval source and operating procedure remain the authority. No historical approval is inferred.

`reconciliationEligibility` only returns `eligible_for_review` or `ineligible`, always with `promoted: false`. It does not create a Phase 5B approved outcome or write `shadow-outcomes.json`. A later, separately authorized integration must verify receipt and source bytes again and explicitly ratify any outcome before promotion. The current Phase 5C chain format is unchanged.

## Validation and rollback

Run `node --test tools/evidence-repair/*.test.mjs`, `node tools/evidence-repair/shadow-replay.mjs`, `node tools/evidence-repair/reconcile.mjs`, and `git diff --check`. Tests use synthetic approval, artifact, content, and source bytes; the existing Phase 5B and 5C tests verify retained historical source hashes read-only. The replay and reconciliation reports must continue to show zero approved historical outcomes and zero proposed labels.

Rollback is limited to reverting the Phase 5D files before integration. No existing receipt or label is migrated or rewritten. If a local archive was created by a future operator, preserve its bytes for audit and disable the capture call rather than editing or deleting a receipt. There are no deployment, database, environment, or provider changes in this phase.
