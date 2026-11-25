import { createHash } from 'node:crypto'
import { PLAYBOOKS } from './playbooks.mjs'

export const digest = (value) => createHash('sha256').update(value).digest('hex')
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const validHash = (value) => /^sha256:[a-f0-9]{64}$/.test(value || '')
const finiteTime = (value) => nonempty(value) && Number.isFinite(Date.parse(value))
const blocked = (caseId, reason) => ({ case_id: caseId, status: 'unresolved', reason, proposal: null })

/** A pure, review-only proposal. Evidence bytes are verified before any rule is considered. */
export function proposeRepair(input) {
  const { case_id: id, playbook, blocker, candidate, evidence, change, now } = input || {}
  if (!nonempty(id) || !PLAYBOOKS[playbook]) return blocked(id ?? null, 'unknown_case_or_playbook')
  if (!finiteTime(now) || !nonempty(blocker?.type) || blocker.type !== playbook || !nonempty(blocker?.version)) return blocked(id, 'untyped_or_unversioned_blocker')
  if (!nonempty(candidate?.id) || !nonempty(candidate?.meaning_id) || !Array.isArray(candidate?.claim_ids) || !candidate.claim_ids.length || !nonempty(candidate?.version)) return blocked(id, 'incomplete_candidate')
  if (!Array.isArray(evidence) || !evidence.length) return blocked(id, 'missing_evidence')
  const required = PLAYBOOKS[playbook].required_receipts
  for (const kind of required) if (!evidence.some((item) => item.kind === kind)) return blocked(id, `missing_${kind}_receipt`)
  for (const item of evidence) {
    if (!nonempty(item.id) || !nonempty(item.kind) || !nonempty(item.source_path) || !nonempty(item.version) || !nonempty(item.content) || !validHash(item.sha256) || `sha256:${digest(item.content)}` !== item.sha256) return blocked(id, 'invalid_provenance_or_hash')
    let bound
    try { bound = JSON.parse(item.content) } catch { return blocked(id, 'invalid_receipt_content') }
    for (const field of ['id', 'kind', 'source_path', 'version', 'candidate_version', 'observed_at', 'expires_at', 'status', 'privacy', 'rights']) {
      if (bound[field] !== item[field]) return blocked(id, 'unbound_receipt_metadata')
    }
    if (!bound.facts || typeof bound.facts !== 'object' || Array.isArray(bound.facts)) return blocked(id, 'missing_receipt_facts')
    if (!finiteTime(item.observed_at) || !finiteTime(item.expires_at) || Date.parse(item.expires_at) <= Date.parse(now)) return blocked(id, 'missing_or_expired_evidence')
    if (item.status !== 'passed' || item.privacy !== 'cleared' || item.rights !== 'cleared') return blocked(id, 'uncleared_evidence')
    if (item.candidate_version !== candidate.version) return blocked(id, 'stale_candidate_binding')
  }
  if (!change || change.meaning_id !== candidate.meaning_id || !Array.isArray(change.claim_ids) || !change.claim_ids.length) return blocked(id, 'meaning_invariant_failed')
  const attestedFacts = evidence.map((item) => JSON.parse(item.content).facts)
  for (const [key, value] of Object.entries(change)) {
    if (['meaning_id', 'product_id', 'claim_ids'].includes(key)) continue
    if (!attestedFacts.some((facts) => JSON.stringify(facts[key]) === JSON.stringify(value))) return blocked(id, 'unattested_change')
  }
  const current = new Set(candidate.claim_ids)
  if (change.claim_ids.some((claim) => !current.has(claim))) return blocked(id, 'unsupported_claim')
  if (playbook !== 'claim_narrowing' && playbook !== 'candidate_substitution' && (change.claim_ids.length !== current.size || change.claim_ids.some((claim) => !current.has(claim)))) return blocked(id, 'claim_set_changed')
  if (playbook === 'claim_narrowing' && change.claim_ids.length >= current.size) return blocked(id, 'claim_not_narrowed')
  if (change.product_id !== candidate.product_id && playbook !== 'candidate_substitution') return blocked(id, 'product_changed')
  if (playbook === 'freshness_renewal' && (!change.same_source || !finiteTime(change.new_observed_at) || Date.parse(change.new_observed_at) <= Date.parse(blocker.observed_at || 0))) return blocked(id, 'freshness_not_proven')
  if (playbook === 'authoritative_source_replacement' && (!change.primary_source || !change.equivalent_claim)) return blocked(id, 'source_equivalence_unproven')
  if (playbook === 'claim_narrowing' && !change.approved_wording) return blocked(id, 'wording_not_approved')
  if (playbook === 'duplicate_angle_repair' && (!change.distinct_angle || !change.sourced_angle || !change.angle_reviewed)) return blocked(id, 'angle_not_qualified')
  if (playbook === 'owned_proof_binding' && (!change.asset_hash || !validHash(change.asset_hash) || !change.scene_id || !change.claim_id || !current.has(change.claim_id))) return blocked(id, 'owned_proof_not_bound')
  if (playbook === 'evidence_region_mapping' && (!change.asset_hash || !validHash(change.asset_hash) || !change.region_id || !change.context_preserved)) return blocked(id, 'region_not_verified')
  if (playbook === 'channel_adaptation' && (!change.channel || !change.scene_map_complete || !change.public_copy_clean)) return blocked(id, 'channel_map_incomplete')
  if (playbook === 'candidate_substitution' && (!change.replacement_id || !change.replacement_qualified || !change.same_slot || !change.replacement_claim_boundary)) return blocked(id, 'replacement_not_qualified')
  if (playbook === 'typed_blocker_routing' && (!change.owner || !change.next_gate || change.mutates_candidate)) return blocked(id, 'routing_incomplete')
  const proof = evidence.map(({ id, kind, source_path, version, sha256 }) => ({ id, kind, source_path, version, sha256 }))
  const proposal = {
    mode: 'shadow_review_only', playbook, candidate_id: candidate.id,
    candidate_version: candidate.version, blocker_version: blocker.version,
    proposed_change: change, evidence: proof,
    rollback: { candidate_id: candidate.id, candidate_version: candidate.version, meaning_id: candidate.meaning_id, claim_ids: [...candidate.claim_ids], previous_state_hash: `sha256:${digest(JSON.stringify(candidate))}` },
    human_qa: playbook === 'typed_blocker_routing' ? 'conditional_on_client_facing_change' : 'required_before_advancement',
    external_actions_allowed: false
  }
  return { case_id: id, status: 'proposed', reason: null, proposal }
}
