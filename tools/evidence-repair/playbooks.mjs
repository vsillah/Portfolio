// Shadow-only repair contracts. No provider, database, or publication imports belong here.
const DEFINITIONS = {
  freshness_renewal: {
    qualifies: 'An exact bound evidence item expired and a newer observation of the same source and claim exists.',
    allowed_evidence: ['same-source observation', 'current source receipt'],
    permitted_change: 'Replace the expired evidence binding; preserve the claim and candidate.',
    meaning_invariant: 'same meaning_id, claim_ids, source identity, and audience promise',
    required_receipts: ['source', 'freshness'],
    stop: 'Missing expiry, changed source/claim, or no later observation.',
    human_qa: 'Required before any client-facing candidate advances.'
  },
  authoritative_source_replacement: {
    qualifies: 'A cited source is unavailable or weak and a primary source supports the identical claim.',
    allowed_evidence: ['primary source', 'source equivalence receipt'],
    permitted_change: 'Replace only the source binding.',
    meaning_invariant: 'same meaning_id and claim_ids; no broader assertion',
    required_receipts: ['source', 'equivalence'],
    stop: 'No primary source, unresolved attribution, or claim expansion.',
    human_qa: 'Required for changed public citation or copy.'
  },
  claim_narrowing: {
    qualifies: 'A claim exceeds a current source boundary and an approved narrower wording is supplied.',
    allowed_evidence: ['source boundary', 'approved wording receipt'],
    permitted_change: 'Use only the supplied narrower wording.',
    meaning_invariant: 'same meaning_id and product; narrower claim_ids must be a subset',
    required_receipts: ['source', 'wording'],
    stop: 'No approved wording, new claims, or changed core meaning.',
    human_qa: 'Required for public wording.'
  },
  duplicate_angle_repair: {
    qualifies: 'A recorded near-duplicate blocks release and a distinct sourced angle is supplied.',
    allowed_evidence: ['duplicate comparison', 'new angle source', 'angle review receipt'],
    permitted_change: 'Propose a distinct angle for review; never auto-approve it.',
    meaning_invariant: 'same product and factual boundaries; new angle is explicitly reviewed',
    required_receipts: ['duplicate', 'angle'],
    stop: 'Angle is cosmetic, unsourced, or changes product facts.',
    human_qa: 'Always required for new angle.'
  },
  owned_proof_binding: {
    qualifies: 'A product claim lacks a direct visual binding and an owned, cleared asset supports it.',
    allowed_evidence: ['owned asset', 'privacy and rights receipts', 'claim-to-asset map'],
    permitted_change: 'Bind the cleared asset to the exact claim and scene.',
    meaning_invariant: 'same meaning_id, claim_ids, and depicted product version',
    required_receipts: ['ownership', 'rights', 'privacy', 'proof'],
    stop: 'Ownership, rights, privacy, version, or scene support is unknown.',
    human_qa: 'Required for visible proof.'
  },
  evidence_region_mapping: {
    qualifies: 'A supported claim lacks an inspectable region in an approved asset.',
    allowed_evidence: ['asset geometry', 'claim-to-region receipt'],
    permitted_change: 'Add an exact region binding without cropping away required context.',
    meaning_invariant: 'same meaning_id, claim_ids, asset hash, and full context',
    required_receipts: ['proof', 'region'],
    stop: 'Region cannot be verified or obscures critical context.',
    human_qa: 'Required for visual framing.'
  },
  channel_adaptation: {
    qualifies: 'A reviewed source packet is being adapted to a named channel with an approved channel brief.',
    allowed_evidence: ['approved source packet', 'channel brief', 'scene map'],
    permitted_change: 'Change format and pacing within the approved claim set.',
    meaning_invariant: 'same meaning_id, product, claim_ids, and source boundaries',
    required_receipts: ['source', 'channel', 'scene'],
    stop: 'New claim, unbound scene, or audience-facing internal language.',
    human_qa: 'Required for every client-facing adaptation.'
  },
  candidate_substitution: {
    qualifies: 'A blocked candidate has a separately qualified replacement for the same slot.',
    allowed_evidence: ['blocker receipt', 'replacement qualification', 'slot binding'],
    permitted_change: 'Propose the replacement candidate, preserving the blocked original.',
    meaning_invariant: 'same campaign slot and approved goal; replacement has its own claim boundaries',
    required_receipts: ['blocker', 'qualification', 'substitution'],
    stop: 'Replacement is unscored, stale, or lacks independent proof.',
    human_qa: 'Always required for candidate choice.'
  },
  typed_blocker_routing: {
    qualifies: 'A blocker has a known type, exact owner, and next review gate.',
    allowed_evidence: ['versioned blocker receipt', 'owner routing receipt'],
    permitted_change: 'Create a review-only routing proposal, never mutate the blocked candidate.',
    meaning_invariant: 'candidate, claims, and release state unchanged',
    required_receipts: ['blocker', 'routing'],
    stop: 'Unknown type, owner, version, or recovery gate.',
    human_qa: 'Only if routing results in changed client-facing material.'
  }
}

export const PLAYBOOKS = Object.freeze(Object.fromEntries(Object.entries(DEFINITIONS).map(([id, value]) => [id, Object.freeze({
  ...value,
  provenance_and_hashes: 'Every receipt carries source_path, version, candidate_version, observation and expiry, SHA-256 of its bytes, privacy and rights clearance.',
  rollback: 'Retain candidate id, version, meaning id, claim ids, and previous state SHA-256. A proposal does not mutate the candidate.',
  release_state: 'shadow_review_only; external_actions_allowed=false'
})])))

export const PLAYBOOK_IDS = Object.freeze(Object.keys(PLAYBOOKS))
