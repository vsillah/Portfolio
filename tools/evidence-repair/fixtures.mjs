import { digest } from './engine.mjs'
import { PLAYBOOKS } from './playbooks.mjs'

const NOW = '2026-10-17T16:00:00Z'
const candidate = { id: 'synthetic:one', version: 'v1', meaning_id: 'teach-decision-feedback', product_id: 'synthetic-product', claim_ids: ['visible-feedback', 'bounded-outcome'] }
const extras = {
  freshness_renewal: { same_source: true, new_observed_at: '2026-10-17T15:00:00Z' },
  authoritative_source_replacement: { primary_source: true, equivalent_claim: true },
  claim_narrowing: { approved_wording: 'The interface shows feedback after a decision.', claim_ids: ['visible-feedback'] },
  duplicate_angle_repair: { distinct_angle: true, sourced_angle: true, angle_reviewed: true },
  owned_proof_binding: { asset_hash: `sha256:${digest('synthetic owned asset')}`, scene_id: 'scene-1', claim_id: 'visible-feedback' },
  evidence_region_mapping: { asset_hash: `sha256:${digest('synthetic owned asset')}`, region_id: 'feedback-panel', context_preserved: true },
  channel_adaptation: { channel: 'youtube', scene_map_complete: true, public_copy_clean: true },
  candidate_substitution: { replacement_id: 'synthetic:two', replacement_qualified: true, same_slot: true, replacement_claim_boundary: true },
  typed_blocker_routing: { owner: 'editor', next_gate: 'source-review', mutates_candidate: false }
}

export function syntheticCase(playbook, variant = 'qualifying') {
  const change = { meaning_id: candidate.meaning_id, product_id: candidate.product_id, claim_ids: [...candidate.claim_ids], ...structuredClone(extras[playbook]) }
  const evidence = PLAYBOOKS[playbook].required_receipts.map((kind) => {
    const fields = { id: `${playbook}:${kind}`, kind, source_path: `synthetic/${playbook}/${kind}.json`, version: 'v1', candidate_version: 'v1', observed_at: '2026-10-17T15:00:00Z', expires_at: '2026-10-20T15:00:00Z', status: 'passed', privacy: 'cleared', rights: 'cleared', facts: structuredClone(change) }
    const content = JSON.stringify(fields)
    return { ...fields, content, sha256: `sha256:${digest(content)}` }
  })
  const value = { case_id: `${playbook}:${variant}`, playbook, now: NOW, blocker: { type: playbook, version: 'v1', observed_at: '2026-10-16T15:00:00Z' }, candidate: structuredClone(candidate), evidence, change }
  if (variant === 'missing_receipt') value.evidence.pop()
  if (variant === 'meaning_change') value.change.meaning_id = 'new-unsupported-meaning'
  if (variant === 'hash_tamper') value.evidence[0].content = 'tampered'
  if (variant === 'rights_unknown') value.evidence[0].rights = 'unknown'
  if (variant === 'expired') value.evidence[0].expires_at = '2026-10-17T14:00:00Z'
  if (variant === 'unsupported_claim') value.change.claim_ids.push('invented-result')
  return value
}

// The historical labels below are observations, not approval or training instructions.
// Their source file SHA-256 values are in source-manifest.json.
export const HISTORICAL_CASES = [
  { case_id: 'history:jev-duplicate', recorded_state: 'revision_required', observed_source: 'jit-refresh-receipts.json', expected: 'unresolved', reason: 'A distinct angle was recommended, but no angle review receipt establishes an approved repair.', playbook: 'duplicate_angle_repair' },
  { case_id: 'history:dark-castle-refresh', recorded_state: 'refresh_passed', observed_source: 'jit-refresh-receipts.json', expected: 'unresolved', reason: 'Refresh passed; there is no expired evidence blocker to repair.', playbook: 'freshness_renewal' },
  { case_id: 'history:ai-audit-refresh', recorded_state: 'refresh_passed', observed_source: 'jit-refresh-receipts.json', expected: 'unresolved', reason: 'Refresh passed; there is no expired evidence blocker to repair.', playbook: 'freshness_renewal' },
  { case_id: 'history:youtube-packets', recorded_state: 'ready_for_render_approval', observed_source: 'youtube packet JSON', expected: 'unresolved', reason: 'The packet requests render approval; no evidence repair approval is recorded.', playbook: 'channel_adaptation' },
  { case_id: 'history:description-cohort', recorded_state: 'unscored', observed_source: 'description cohort receipt', expected: 'unresolved', reason: 'One qualified description is below the required three; substitution cannot be inferred.', playbook: 'candidate_substitution' },
  { case_id: 'history:video-only-routes', recorded_state: 'observed_recording', observed_source: 'production, description, and platform-draft MP4s', expected: 'unresolved', reason: 'Visual route states lack a versioned approved repair decision in the retained adjacent files.', playbook: 'typed_blocker_routing' }
]
