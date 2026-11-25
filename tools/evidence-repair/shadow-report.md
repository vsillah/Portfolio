# Phase 5B shadow replay

Cases: 9; labeled: 0; unlabeled: 9.
Labeled-case precision: unavailable; unsupported-change rate: unavailable.
Classifications: exact_match 0, bounded_disagreement 0, unsupported_change 0, expected_unresolved 2, insufficient_label 7.
Playbook coverage: candidate_substitution, channel_adaptation, duplicate_angle_repair, freshness_renewal, owned_proof_binding, typed_blocker_routing.
Source categories: adjacent_versioned_receipt, campaign_batch, description_review, platform_draft, production_blocker, youtube_packet.

## Cases

- history:jev-duplicate: insufficient_label; missing approved_angle_review_receipt, explicit_human_repair_approval, candidate_version, blocker_version, human_qa_scope, rollback_receipt.
- history:dark-castle-refresh: expected_unresolved.
- history:ai-audit-refresh: expected_unresolved.
- history:youtube-dark-castle: insufficient_label; missing explicit_human_repair_approval, repair_before_after_meaning_and_claim_ids, human_qa_scope, rollback_receipt.
- history:youtube-jev: insufficient_label; missing explicit_human_repair_approval, repair_before_after_meaning_and_claim_ids, human_qa_scope, rollback_receipt.
- history:production-blocker: insufficient_label; missing version_bound_blocker, approved_owner_and_next_gate, explicit_human_repair_approval, rollback_receipt.
- history:description-review: insufficient_label; missing qualified_replacement_candidate, explicit_human_repair_approval, human_qa_scope, rollback_receipt.
- history:platform-draft: insufficient_label; missing version_bound_blocker, approved_owner_and_next_gate, explicit_human_repair_approval, rollback_receipt.
- history:dark-castle-visual: insufficient_label; missing production_bound_asset, explicit_human_repair_approval, human_qa_scope, rollback_receipt.

## Limits

- Historical observations and passing review states do not establish repair approval.
- Precision and unsupported-change rate are null until explicit version-bound approved outcomes are verified.
- Source verification is local and read-only; no provider or production state is queried.
