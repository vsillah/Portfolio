import { describe, expect, it } from 'vitest'
import heroReceipt from '@/artifacts/research/jev-hero-thumbnail-candidates-2026-10-19/receipt.json'
import darkCastleReceipt from '@/artifacts/research/dark-castle-hero-thumbnail-candidates-2026-10-19/receipt.json'
import aiAuditReceipt from '@/artifacts/research/ai-audit-hero-thumbnail-candidates-2026-10-19/receipt.json'
import { validateYouTubeThumbnailHeroEvidence } from '@/lib/youtube-thumbnail-hero-evidence'

const CONTENT_VERSION = 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2'
const AS_OF = '2026-10-20T12:00:00.000Z'
const receipt = () => structuredClone(heroReceipt) as any

describe('YouTube thumbnail hero evidence', () => {
  it('accepts the two authorized campaign-specific integrated generations', () => {
    const result = validateYouTubeThumbnailHeroEvidence(receipt(), CONTENT_VERSION, AS_OF)
    expect(result).toEqual({ ready: true, review_ready: true, fixture_ready: true, blockers: [], recovery_actions: [] })
  })

  it('binds Candidate B as the sole final output and keeps Candidate A fail-closed as rejected anatomy evidence', () => {
    const value = receipt()
    expect(value.selection_decision).toMatchObject({
      receipt_id: 'human-qa:jev:thumbnail-selection:20261019:v1',
      status: 'human_qa_approved',
      content_version: CONTENT_VERSION,
      selected_candidate_id: 'thumbnail:jev:reveal-scene:20261019:v3',
    })
    expect(value.candidates[0]).toMatchObject({ selection_status: 'rejected', final_use_eligible: false, rejection_reason_code: 'anatomy_quality_failure', rejection_reason: 'Pointing-hand treatment reads as if the hand was severed.' })
    expect(value.candidates[1]).toMatchObject({ selection_status: 'selected', final_use_eligible: true })
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).ready).toBe(true)
  })

  it('rejects packaging that makes the rejected Candidate A eligible or selects more than one output', () => {
    const value = receipt()
    value.candidates[0].final_use_eligible = true
    value.candidates[0].selection_status = 'selected'
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Exactly one candidate must be selected and bound as the sole final-use output.',
      'Every non-selected candidate must remain fail-closed rejected evidence.',
    ]))
  })

  it('fails closed when a candidate-specific generated hero is missing', () => {
    const value = receipt(); value.hero_assets.splice(0, 1)
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.fixture_ready).toBe(false)
    expect(result.blockers).toContain('Every candidate needs its own newly generated campaign-specific hero asset.')
  })

  it('rejects exact-photo output reuse', () => {
    const value = receipt(); value.hero_assets[0].output_sha256 = value.generation_request.identity_reference.sha256; value.candidates[0].hero_binding.hero_output_sha256 = value.hero_assets[0].output_sha256
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toContain(`${value.hero_assets[0].asset_id} reuses the exact identity-reference photo as output.`)
  })

  it('fails closed when live outlier evidence or generated heroes are stale', () => {
    const value = receipt(); value.outlier_evidence.fresh_until = '2026-10-19T11:59:59.000Z'; value.hero_assets[0].fresh_until = '2026-10-19T11:59:59.000Z'
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The topic-specific YouTube outlier evidence is missing or stale.', `${value.hero_assets[0].asset_id} is stale or missing generation freshness.`]))
  })

  it('rejects cross-campaign inheritance and missing generator provenance', () => {
    const value = receipt(); value.hero_assets[0].campaign_identity = 'other'; value.hero_assets[0].generator_id = ''
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.fixture_ready).toBe(false)
    expect(result.blockers.join(' ')).toMatch(/version-bound|generator/)
  })

  it('rejects perceptually repeated heroes and full compositions', () => {
    const value = receipt(); value.hero_assets[1].perceptual_hash = value.hero_assets[0].perceptual_hash; value.candidates[1].perceptual_hash = value.candidates[0].perceptual_hash
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The candidate set reuses the same hero output or perceptual likeness.', 'The candidate set does not contain materially distinct integrated scene directions.', 'The candidate compositions are perceptually too similar.']))
  })

  it('rejects generic side-by-side and hard split layouts', () => {
    const value = receipt(); value.candidates[0].layout_family = 'portrait-plus-screenshot-side-by-side'; value.candidates[0].integration.hard_split_panel = true
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining([expect.stringContaining('prohibited generic, split-panel, or side-by-side'), expect.stringContaining('integrated hero-and-product scene')]))
  })

  it('rejects floating assets, mismatched visual treatment, blur reuse, removable story parts, and harmful overlap', () => {
    const value = receipt(); Object.assign(value.candidates[0].integration, { lighting_consistent: false, perspective_consistent: false, color_grade_consistent: false, asset_floats_independently: true, blur_masks_reuse: true, hero_removal_breaks_story: false, asset_removal_breaks_story: false, face_overlap_harm: true })
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toContain(`${value.candidates[0].candidate_id} does not prove an integrated hero-and-product scene.`)
  })

  it('rejects missing generation request or candidate provenance', () => {
    const value = receipt(); delete value.generation_request; delete value.hero_assets[0].likeness_receipt_id
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The campaign-specific generation request is missing or not version-bound.', `${value.hero_assets[0].asset_id} lacks provenance, likeness, rights, or privacy evidence.`]))
  })

  it.each(['REVIEW ONLY', 'draft', 'fixture', 'sample data', 'operator', 'internal', 'prompt', 'QA'])('rejects internal marker %s from exported pixels', (marker) => {
    const value = receipt(); value.candidates[0].customer_facing_copy.push(marker)
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toContain(`${value.candidates[0].candidate_id} contains internal workflow language in customer-facing pixels.`)
  })

  it.each([null, [], { version: 'youtube-thumbnail-hero-evidence/v1' }])('rejects a missing or wrong-version receipt', (value) => {
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)).toEqual({
      ready: false,
      review_ready: false,
      fixture_ready: false,
      blockers: ['The YouTube thumbnail hero evidence receipt is missing or malformed.'],
      recovery_actions: ['Rebuild the campaign-specific generation request and evidence receipt.'],
    })
  })

  it('rejects a receipt whose content version is stale for the current package', () => {
    const value = receipt()
    value.content_version = `sha256:${'ab'.repeat(32)}`
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('The hero evidence receipt is missing its campaign identity or is stale for the current content version.')
  })

  it('treats an unreadable evaluation time as stale outlier evidence', () => {
    const result = validateYouTubeThumbnailHeroEvidence(receipt(), CONTENT_VERSION, 'not-a-time')
    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('The topic-specific YouTube outlier evidence is missing or stale.')
  })

  it('blocks an undersized cohort, a threshold with no included outlier, and a weighted playlist', () => {
    const value = receipt()
    value.outlier_evidence.minimum_sample_size = value.outlier_evidence.included_video_ids.length + 1
    value.outlier_evidence.outlier_threshold = 0
    value.outlier_evidence.qualified_outlier_video_ids = ['not-in-cohort']
    value.outlier_evidence.curated_playlist_performance_weight = 1
    value.outlier_evidence.curated_playlist_role = 'performance'
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toEqual(expect.arrayContaining([
      'The live YouTube cohort does not meet its declared minimum sample size.',
      'The live YouTube cohort has no attributable outlier at the declared threshold.',
      'The curated playlist is not constrained to zero-weight taste calibration.',
    ]))
  })

  it('rejects a reusable likeness reference and an incomplete visual-intent contract', () => {
    const value = receipt()
    value.generation_request.identity_reference.usage = 'final_output'
    value.generation_request.required_prompt_fields = value.generation_request.required_prompt_fields.filter((field: string) => field !== 'gaze')
    value.hero_assets[0].prompt_intent.gaze = ' '
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toEqual(expect.arrayContaining([
      'The likeness reference is missing or can be reused as output.',
      'The generation request does not require the complete campaign-specific visual intent.',
      `${value.hero_assets[0].asset_id} lacks complete visual intent.`,
    ]))
  })

  it('keeps a synthetic fixture out of final use and withholds review readiness until real generation is authorized', () => {
    const synthetic = receipt()
    synthetic.hero_assets[0].generation_status = 'synthetic_fixture'
    synthetic.hero_assets[0].final_use_eligible = true
    const syntheticResult = validateYouTubeThumbnailHeroEvidence(synthetic, CONTENT_VERSION, AS_OF)
    expect(syntheticResult.fixture_ready).toBe(false)
    expect(syntheticResult.review_ready).toBe(false)
    expect(syntheticResult.blockers).toEqual(expect.arrayContaining([
      `${synthetic.hero_assets[0].asset_id} incorrectly marks a synthetic fixture as final-use eligible.`,
      'Real campaign-specific likeness generation remains blocked pending explicit provider authorization; the displayed images are synthetic contract fixtures and are not final-use artwork.',
    ]))

    const unauthorized = receipt()
    unauthorized.generation_request.real_generation_completed = false
    unauthorized.generation_request.authorization_status = 'denied'
    const unauthorizedResult = validateYouTubeThumbnailHeroEvidence(unauthorized, CONTENT_VERSION, AS_OF)
    expect(unauthorizedResult.fixture_ready).toBe(true)
    expect(unauthorizedResult.review_ready).toBe(false)
    expect(unauthorizedResult.ready).toBe(false)
    expect(unauthorizedResult.blockers).toEqual([
      'Real campaign-specific likeness generation remains blocked pending explicit provider authorization; the displayed images are synthetic contract fixtures and are not final-use artwork.',
    ])
  })

  it('rejects missing product proof, a title-length teaser, and a non-1280×720 feed pair', () => {
    const value = receipt()
    delete value.product_proof
    const candidate = value.candidates[0]
    candidate.teaser = candidate.title
    candidate.text_word_count = 6
    candidate.width = 640
    candidate.aspect_ratio = '4:3'
    candidate.feed_preview_width = 160
    candidate.face_text_overlap = true
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'The separate product-proof binding is missing or malformed.',
      `${candidate.candidate_id} does not keep a short teaser distinct from the title.`,
      `${candidate.candidate_id} is not an exact version-bound 1280×720 output.`,
      `${candidate.candidate_id} lacks an exact actual-feed-size preview.`,
      `${candidate.candidate_id} fails focal hierarchy, face clearance, product legibility, or feed-size comprehension.`,
    ]))
  })

  it('rejects a creative decision traced to a video outside the live cohort', () => {
    const value = receipt()
    const trace = value.candidates[0].evidence_trace.find((item: { decision_dimension: string }) => item.decision_dimension === 'teaser')
    trace.live_evidence_video_ids = ['not-in-cohort']
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toContain(`${value.candidates[0].candidate_id} lacks attributable live evidence for teaser.`)
  })

  it('rejects a candidate that is perceptually too close to a recent hero or full composition', () => {
    const value = receipt()
    const candidate = value.candidates[0]
    const hero = value.hero_assets.find((asset: { asset_id: string }) => asset.asset_id === candidate.hero_binding.hero_asset_id)
    value.recent_thumbnail_history[0].composition_perceptual_hash = candidate.perceptual_hash
    value.recent_thumbnail_history[0].hero_perceptual_hash = hero.perceptual_hash
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toEqual(expect.arrayContaining([
      `${candidate.candidate_id} is perceptually too close to a recent full composition.`,
      `${candidate.candidate_id} is perceptually too close to a recent hero treatment.`,
    ]))
  })

  it('keeps a pending Human QA packet review-ready and final-use closed', () => {
    const value = receipt()
    value.selection_decision.status = 'pending_human_qa'
    value.selection_decision.decided_at = null
    value.selection_decision.selected_candidate_id = ''
    value.selection_decision.rejected_candidates = []
    for (const candidate of value.candidates) {
      candidate.selection_status = 'pending_human_qa'
      candidate.final_use_eligible = false
    }
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.ready).toBe(false)
    expect(result.review_ready).toBe(true)
    expect(result.fixture_ready).toBe(false)
    expect(result.blockers).toEqual(['Human QA has not selected the sole final thumbnail output or recorded the rejected alternatives.'])
  })

  it('rejects a pending decision that already names a winner or marks a candidate eligible', () => {
    const value = receipt()
    value.selection_decision.status = 'pending_human_qa'
    value.selection_decision.decided_at = AS_OF
    value.selection_decision.selected_candidate_id = value.candidates[1].candidate_id
    value.selection_decision.rejected_candidates = []
    for (const candidate of value.candidates) {
      candidate.selection_status = 'pending_human_qa'
      candidate.final_use_eligible = false
    }
    value.candidates[1].final_use_eligible = true
    const result = validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF)
    expect(result.review_ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      `${value.candidates[1].candidate_id} is awaiting Human QA but is incorrectly final-use eligible.`,
      'The pending Human QA decision receipt is malformed or exposes an eligible output.',
      'Human QA has not selected the sole final thumbnail output or recorded the rejected alternatives.',
    ]))
  })

  it('rejects a selected candidate that is not the sole final-use output', () => {
    const value = receipt()
    const selected = value.candidates.find((candidate: { selection_status: string }) => candidate.selection_status === 'selected')
    selected.final_use_eligible = false
    expect(validateYouTubeThumbnailHeroEvidence(value, CONTENT_VERSION, AS_OF).blockers).toEqual(expect.arrayContaining([
      `${selected.candidate_id} is selected but not final-use eligible.`,
      'Exactly one candidate must be selected and bound as the sole final-use output.',
    ]))
  })
})

const approvedCampaigns = [
  {
    label: 'Dark Castle Chess',
    receipt: darkCastleReceipt,
    contentVersion: 'sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e',
    selectedId: 'thumbnail:dark-castle-chess:decision-table:20261019:v1',
    rejectedId: 'thumbnail:dark-castle-chess:rook-reveal:20261019:v1',
    rejectionCode: 'artifact_quality_failure',
    rejectionReason: 'The rook piece is visibly disfigured.',
  },
  {
    label: 'AI Audit Calculator',
    receipt: aiAuditReceipt,
    contentVersion: '2026-10-18T00:00:00.000Z',
    selectedId: 'thumbnail:ai-audit-calculator:receipt-pull:20261019:v1',
    rejectedId: 'thumbnail:ai-audit-calculator:ledger-lift:20261019:v1',
    rejectionCode: 'concept_clarity_preference',
    rejectionReason: 'Candidate A presents the clearer integrated receipt-pull concept.',
  },
] as const

describe.each(approvedCampaigns)('$label approved Human QA evidence', ({ receipt: campaignReceipt, contentVersion, selectedId, rejectedId, rejectionCode, rejectionReason }) => {
  const value = () => structuredClone(campaignReceipt) as any

  it('binds Candidate A as the sole final output and preserves Candidate B as rejected evidence', () => {
    const candidate = value()
    const result = validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF)
    expect(result.ready).toBe(true)
    expect(result.review_ready).toBe(true)
    expect(result.blockers).toEqual([])
    expect(candidate.candidates).toHaveLength(2)
    expect(candidate.selection_decision).toMatchObject({ status: 'human_qa_approved', selected_candidate_id: selectedId })
    expect(candidate.candidates[0]).toMatchObject({ candidate_id: selectedId, selection_status: 'selected', final_use_eligible: true })
    expect(candidate.candidates[1]).toMatchObject({ candidate_id: rejectedId, selection_status: 'rejected', final_use_eligible: false, rejection_reason_code: rejectionCode, rejection_reason: rejectionReason })
  })

  it('rejects cross-campaign hero inheritance', () => {
    const candidate = value()
    candidate.hero_assets[0].campaign_identity = 'jev'
    expect(validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF).blockers.join(' ')).toMatch(/version-bound/)
  })

  it('rejects exact identity-photo reuse', () => {
    const candidate = value()
    candidate.hero_assets[0].output_sha256 = candidate.generation_request.identity_reference.sha256
    candidate.candidates[0].hero_binding.hero_output_sha256 = candidate.hero_assets[0].output_sha256
    expect(validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF).blockers).toContain(`${candidate.hero_assets[0].asset_id} reuses the exact identity-reference photo as output.`)
  })

  it('fails closed on recorded anatomy defects', () => {
    const candidate = value()
    candidate.hero_assets[0].anatomy_quality.status = 'failed'
    candidate.hero_assets[0].anatomy_quality.visible_fingers_consistent = false
    expect(validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF).blockers).toContain(`${candidate.hero_assets[0].asset_id} failed the recorded anatomy-quality inspection.`)
  })

  it('rejects repetitive layouts and perceptually duplicated outputs', () => {
    const candidate = value()
    candidate.candidates[1].layout_family = candidate.candidates[0].layout_family
    candidate.candidates[1].composition_signature = candidate.candidates[0].composition_signature
    candidate.candidates[1].perceptual_hash = candidate.candidates[0].perceptual_hash
    const result = validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The candidate set does not contain materially distinct integrated scene directions.', 'The candidate compositions are perceptually too similar.']))
  })

  it('rejects missing provenance receipts', () => {
    const candidate = value()
    candidate.hero_assets[0].rights_receipt_ids = []
    expect(validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF).blockers).toContain(`${candidate.hero_assets[0].asset_id} lacks provenance, likeness, rights, or privacy evidence.`)
  })

  it('rejects stale outlier and generation evidence', () => {
    const candidate = value()
    candidate.outlier_evidence.fresh_until = '2026-10-20T11:59:59.000Z'
    candidate.hero_assets[0].fresh_until = '2026-10-20T11:59:59.000Z'
    const result = validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF)
    expect(result.blockers).toEqual(expect.arrayContaining(['The topic-specific YouTube outlier evidence is missing or stale.', `${candidate.hero_assets[0].asset_id} is stale or missing generation freshness.`]))
  })

  it('rejects output eligibility for the preserved non-selected candidate', () => {
    const candidate = value()
    candidate.candidates[1].final_use_eligible = true
    expect(validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF).blockers).toContain(`${candidate.candidates[1].candidate_id} does not preserve a fail-closed rejection state.`)
  })

  it('keeps internal workflow labels out of customer-facing pixels', () => {
    const candidate = value()
    candidate.candidates[0].customer_facing_copy.push('REVIEW ONLY')
    expect(validateYouTubeThumbnailHeroEvidence(candidate, contentVersion, AS_OF).blockers).toContain(`${candidate.candidates[0].candidate_id} contains internal workflow language in customer-facing pixels.`)
  })
})
