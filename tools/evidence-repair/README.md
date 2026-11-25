# Phase 5A evidence repair playbooks

This package proposes review-only repairs from versioned, cleared evidence. It has no provider, database, upload, scheduling, publishing, messaging, or approval path. A proposal never mutates its input candidate. The integration surface is intentionally separate from live Social Content contracts.

Run `node --test tools/evidence-repair/engine.test.mjs` and `node tools/evidence-repair/evaluate.mjs`. The latter writes deterministic JSON and Markdown reports beside the code.

`source-manifest.json` identifies the raw historical corpus and SHA-256 hashes. The named recordings and several adjacent packets are retained in the main Portfolio checkout but are absent from the exact production base commit; they are referenced read-only and are not bundled here. The committed description cohort receipt is also referenced. Historical observations are reduced to bounded fixtures in `fixtures.mjs`. Recordings show route states, not authority to repair or approve a candidate.

The nine contracts in `playbooks.mjs` state qualification, allowed evidence, permitted change, meaning invariant, receipts, provenance/hash rule, stop condition, rollback, and Human QA route. The engine rejects incomplete or expired provenance, unknown privacy or rights, changed meaning, unsupported claims, and playbook-specific missing proof. All accepted proposals carry rollback data and `external_actions_allowed: false`.

Evaluation precision and unsupported-change rate describe synthetic rule behavior only. The retained historical material does not establish approved repairs for these six comparison cases, so those cases remain unresolved. No production accuracy claim follows from the synthetic score. A later phase needs explicit, version-bound approved repair outcomes before measuring historical repair precision or enabling any assisted workflow.
