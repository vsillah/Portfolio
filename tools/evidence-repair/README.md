# Phase 5A evidence repair playbooks

This package proposes review-only repairs from versioned, cleared evidence. It has no provider, database, upload, scheduling, publishing, messaging, or approval path. A proposal never mutates its input candidate. The integration surface is intentionally separate from live Social Content contracts.

Run `node --test tools/evidence-repair/engine.test.mjs` and `node tools/evidence-repair/evaluate.mjs`. The latter writes deterministic JSON and Markdown reports beside the code.

`source-manifest.json` identifies the raw historical corpus and SHA-256 hashes. The named recordings and several adjacent packets are retained in the main Portfolio checkout but are absent from the exact production base commit; they are referenced read-only and are not bundled here. The committed description cohort receipt is also referenced. Historical observations are reduced to bounded fixtures in `fixtures.mjs`. Recordings show route states, not authority to repair or approve a candidate.

The nine contracts in `playbooks.mjs` state qualification, allowed evidence keyed by accepted receipt kind, permitted change, meaning invariant, receipts, provenance/hash rule, stop condition, rollback, and Human QA route. Required and accepted receipt kinds derive from the same map; multiplicity is one receipt per kind. The engine rejects unexpected kinds, duplicate IDs or kinds, incomplete or expired provenance, unknown privacy or rights, changed meaning, unsupported claims, and playbook-specific missing proof. All accepted proposals carry rollback data and `external_actions_allowed: false`.

Evaluation precision and unsupported-change rate describe synthetic rule behavior only. The retained historical material does not establish approved repairs for these six comparison cases, so those cases remain unresolved. No production accuracy claim follows from the synthetic score. A later phase needs explicit, version-bound approved repair outcomes before measuring historical repair precision or enabling any assisted workflow.

## Phase 5B shadow replay

Run `node --test tools/evidence-repair/engine.test.mjs tools/evidence-repair/shadow-replay.test.mjs` and `node tools/evidence-repair/shadow-replay.mjs`. The latter verifies every fixture hash and every referenced raw-file SHA-256, then writes deterministic `shadow-report.json` and `shadow-report.md`. It reads the committed repo or retained main Portfolio checkout; it never copies or modifies source files. Missing or changed source bytes stop replay.

`shadow-corpus.json` extends the read-only observations to campaign batch, YouTube packets, production blocker, description review, platform draft, and an adjacent visual receipt. The last receipt explicitly describes a local Human QA fallback rather than a production-bound approved repair. No historical case has an explicit approved repair outcome. The two passing refresh cases are expected unresolved; the other seven have insufficient labels. Neither a recording, a passing review status, a recommended angle, nor a later artifact supplies authority.

`approved-outcome.schema.json` defines the versioned label; `shadow-outcomes.json` is the explicit empty label package for this retained corpus. `shadow-replay.mjs` additionally requires the approval source bytes to be a JSON receipt with `receipt_type: approved_evidence_repair_outcome` and exact case, versions, playbook, approval, Human QA, and approved-change bindings. A label must include its own SHA-256, verified source hashes, before and after meaning and claim IDs, a complete rollback matching the Phase 5A proposal, and all external-action exclusions. Duplicate, stale, forged, or partial labels remain insufficient. Synthetic test labels exercise the contract; they are not counted as historical approvals.

The machine report separates exact match, bounded disagreement, unsupported change, expected unresolved, and insufficient label. Labeled-case precision and unsupported-change rate remain `null` until a real approved outcome can be verified. This phase does not connect to Social Content, release state, providers, or production data.
