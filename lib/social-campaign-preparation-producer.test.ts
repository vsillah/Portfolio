import { beforeEach, describe, expect, it, vi } from 'vitest'

const artifact = vi.hoisted(() => ({
  manifest: { version: 'artifact-evidence-manifest/v2', manifest_id: 'manifest-1', manifest_hash: `sha256:${'a'.repeat(64)}`, content_version: '2026-10-18T12:00:00.000Z', artifact_label: 'Campaign package', preview_url: '/review-assets/linkedin.png', preview_alt: 'Product proof', final_output_hashes: [{ label: 'thumbnail', sha256: 'b'.repeat(64) }], elements: [] } as any,
  packaging: null as any,
}))
const agentRuns = vi.hoisted(() => ({
  start: vi.fn(),
  end: vi.fn(),
}))
const database = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/artifact-evidence-manifest', () => ({
  parseArtifactEvidenceManifest: vi.fn(() => artifact.manifest),
  validateYouTubePackagingEvidence: vi.fn(() => artifact.packaging),
}))
vi.mock('@/lib/agent-run', () => ({ startAgentRun: agentRuns.start, endAgentRun: agentRuns.end }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: database.from } }))

import { evaluateCampaignPreparationCandidate, SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST } from './social-campaign-package-preparation'
import { persistCampaignPreparationProjection, projectCampaignPreparationCandidate, type CampaignPreparationSnapshot } from './social-campaign-preparation-producer'
import { socialCampaignPackageQaCandidates } from './social-campaign-package-qa-fixture'

const VERSION = '2026-10-18T12:00:00.000Z'

function snapshot(): CampaignPreparationSnapshot {
  const proofReceiptId = 'proof:kicklab:v1'
  const comparison = (id: string, decision: 'included' | 'excluded', score: number | null) => ({
    video_id: id,
    source_url: `https://www.youtube.com/watch?v=${id}`,
    decision,
    decision_reason: decision === 'included' ? 'Same-topic current comparison.' : 'Outside the current topic cohort.',
    view_count: 1_000,
    subscriber_count: 100,
    published_at: '2026-10-10T12:00:00.000Z',
    observed_at: VERSION,
    channel_baseline_size: 100,
    normalized_performance_score: score,
    outlier_qualified: decision === 'included' && score === 84,
  })
  const decisionReceipt = {
    version: 'youtube-thumbnail-decision-receipt/v1',
    receipt_id: 'outlier:kicklab:v1',
    route: 'social-content-outlier-decision/v1',
    content_version: VERSION,
    input_version: `sha256:${'c'.repeat(64)}`,
    output_version: 'decision:kicklab:v1',
    candidate_identity: { content_id: 'youtube-1', title: 'KickLab makes motion measurable', thumbnail_hook: 'MATH YOU CAN FEEL', product_proof_receipt_id: proofReceiptId, composition_signature: 'kicklab-motion-proof' },
    live_evidence: { cohort_id: 'cohort:kicklab', observed_at: VERSION, fresh_until: '2026-10-25T12:00:00.000Z', minimum_sample_size: 5, normalization_formula: ['views / channel baseline'], outlier_threshold: 75, comparisons: [comparison('one', 'included', 84), comparison('two', 'included', 80), comparison('three', 'included', 79), comparison('four', 'included', 78), comparison('five', 'included', 77), comparison('six', 'excluded', null)] },
    candidate_copy_pair: { title: 'KickLab makes motion measurable', thumbnail_hook: 'MATH YOU CAN FEEL', relationship: 'complementary_teaser', exact_strings_are_distinct: true, strategy_status: 'supported', support_scope: 'performance_supported', performance_claim: 'supported', rationale: 'Distinct copy passed.', source_example_video_ids: ['one'] },
    adopted_traits: ['one dominant human or product focal object'],
    rejected_traits: ['split card'],
    user_preference_signals: [{ version: 'youtube-thumbnail-user-preference/v1', signal_type: 'user_curated_saved_playlist', source_url: 'https://www.youtube.com/watch?v=playlist', captured_at: VERSION, item_identities: [{ video_id: 'playlist', source_url: 'https://www.youtube.com/watch?v=playlist' }], extracted_visual_traits: ['high contrast'], extracted_copy_traits: ['short teaser'], applied_traits: ['high contrast'], performance_weight: 0, evidence_role: 'taste_calibration_only', performance_status: 'unscored' }],
    selection: { status: 'ready', selected_composition: 'motion proof', title_thumbnail_relationship: 'complementary_teaser', product_proof_binding: proofReceiptId, rationale: 'Ready.' },
  }
  artifact.packaging = {
    ready: true,
    pairBound: true,
    target: 'youtube',
    blockers: [],
    recoveryActions: [],
    title: { input_excerpt: decisionReceipt.candidate_identity.title },
    thumbnail: { input_excerpt: decisionReceipt.candidate_identity.thumbnail_hook, artifact_url: '/review-assets/kicklab-thumbnail.png', research_cohort: { decision_receipt: decisionReceipt } },
  }
  const checklist = Object.fromEntries(SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST.map((label) => [label, true]))
  const sideEffects = { provider_generation: false, upload: false, platform_draft: false, schedule: false, publish: false, external_send: false }
  const longFormInput = structuredClone(socialCampaignPackageQaCandidates()[0].long_form_script_input!)
  longFormInput.campaign_identity = 'campaign-kicklab'
  longFormInput.candidate_id = 'campaign-preparation:campaign-kicklab'
  const packet = (channel: 'linkedin' | 'youtube', contentId: string) => ({
    channel,
    approval_status: 'in_review',
    shared_source: { social_content_id: contentId },
    side_effects: sideEffects,
    fields: channel === 'linkedin'
      ? { post_text: 'KickLab turns motion into a reviewable math lesson.' }
      : { title_variants: [decisionReceipt.candidate_identity.title], description: 'A receipt-backed product walkthrough.', full_video_script: ['Open with the learning problem.', 'Show the product proof.', 'Close with the boundary.'], storyboard_beats: ['Problem', 'Proof', 'Boundary'] },
  })
  const receipt = (id: string, group: string) => ({ receipt_id: id, source_group: group, source_kind: group === 'public_momentum' ? 'social_trend' : 'approved_repository_implementation', source_id: id, product_identity: 'kicklab', label: group === 'public_momentum' ? 'KickLab public trend' : 'KickLab product work', approval_status: 'approved', privacy_classification: 'public_safe', provenance: `fixture:${id}`, evidence_url: 'https://example.com/evidence', observed_at: VERSION, raw_content_included: false })
  return {
    campaign: { id: 'campaign-kicklab', name: 'KickLab', status: 'active', metadata: { product_identity: 'kicklab' }, updated_at: VERSION },
    calendar: [
      { id: 'calendar-linkedin', campaign_id: 'campaign-kicklab', channel: 'linkedin', social_content_id: 'linkedin-1', agent_work_item_id: 'work-1', updated_at: VERSION },
      { id: 'calendar-youtube', campaign_id: 'campaign-kicklab', channel: 'youtube', social_content_id: 'youtube-1', agent_work_item_id: 'work-1', updated_at: VERSION },
    ],
    socialContent: [
      { id: 'linkedin-1', status: 'draft', post_text: 'LinkedIn draft', image_url: '/review-assets/linkedin.png', updated_at: VERSION, rag_context: {} },
      { id: 'youtube-1', status: 'draft', youtube_title: decisionReceipt.candidate_identity.title, youtube_description: 'Description', updated_at: VERSION, rag_context: {
        artifact_evidence_manifest: artifact.manifest,
        youtube_thumbnail_v6_receipt: { version: 'youtube-thumbnail-selection/v6', product_proof_receipt_id: proofReceiptId, final_quality_gate: { status: 'passed' }, checks: checklist },
        mobile_decision_review: { receipts: { challenger: { receipt_id: 'originality:kicklab:v1', status: 'passed', content_updated_at: VERSION }, privacy: { receipt_id: 'privacy:kicklab:v1', status: 'passed', content_updated_at: VERSION } } },
        long_form_script_framework_receipt: longFormInput,
      } },
    ],
    workItems: [{ id: 'work-1', updated_at: VERSION, metadata: {
      receipt_lineage: [receipt('trend:kicklab:20261018', 'public_momentum'), receipt('work:kicklab:20261018', 'github_development')],
      public_signal: { product_identity: 'kicklab', observed_at: VERSION, expires_at: '2026-10-25T12:00:00.000Z', relevance_score: 0.9 },
      channel_lanes: { linkedin: { draft_packet: packet('linkedin', 'linkedin-1') }, youtube: { draft_packet: packet('youtube', 'youtube-1') } },
    } }],
  }
}

describe('campaign preparation candidate producer', () => {
  beforeEach(() => {
    artifact.manifest.content_version = VERSION
    agentRuns.start.mockReset()
    agentRuns.end.mockReset()
    database.from.mockReset()
    agentRuns.start.mockResolvedValue({ id: 'run-1' })
    agentRuns.end.mockResolvedValue({ id: 'run-1' })
  })

  it('projects a sealed-output blocked candidate when approved identity-bound evidence is absent', () => {
    const value = snapshot()
    value.workItems[0].metadata.receipt_lineage = []
    const projection = projectCampaignPreparationCandidate(value, new Date('2026-10-19T12:00:00.000Z'))
    expect(projection.candidate).not.toBeNull()
    expect(projection.candidate?.status).toBe('blocked')
    expect(projection.candidate?.deliverables).toEqual({
      linkedin: { copy: '', visual_href: '', visual_alt: '' },
      youtube: { title: '', thumbnail_teaser: '', description: '', script: '', storyboard: [], thumbnail_href: '' },
    })
    const result = evaluateCampaignPreparationCandidate(projection.candidate!, new Date('2026-10-19T12:00:00.000Z'))
    expect(result.package).toBeNull()
    expect(result.blockers).toContainEqual(expect.objectContaining({
      code: 'evidence_missing',
      recovery_href: '/admin/agents/content-intelligence?section=research&candidate=kicklab',
    }))
    expect(JSON.stringify(projection.candidate)).not.toContain('KickLab turns motion')
  })

  it('fails closed when campaign, receipt, and public-signal product identities do not agree', () => {
    const value = snapshot()
    value.workItems[0].metadata.public_signal.product_identity = 'kinflo'
    const projection = projectCampaignPreparationCandidate(value)
    expect(projection.candidate?.status).toBe('blocked')
    expect(projection.blockers.join(' ')).toMatch(/ambiguous|conflicting product identities/i)
    expect(projection.candidate?.deliverables.youtube.title).toBe('')
  })

  it('rejects generic non-public receipts that are not attributable product or delivery evidence', () => {
    const value = snapshot()
    value.workItems[0].metadata.receipt_lineage[1].source_group = 'generic_notes'
    value.workItems[0].metadata.receipt_lineage[1].source_kind = 'meeting_summary'
    const projection = projectCampaignPreparationCandidate(value)
    expect(projection.candidate?.status).toBe('blocked')
    expect(projection.blockers.join(' ')).toMatch(/attributable product\/development\/deployment\/prototype/i)
  })

  it('retains a stale source receipt as a blocked candidate with the exact refresh action', () => {
    const value = snapshot()
    value.workItems[0].metadata.public_signal.expires_at = '2026-10-18T13:00:00.000Z'
    const projection = projectCampaignPreparationCandidate(value, new Date('2026-10-19T12:00:00.000Z'))
    expect(projection.candidate).not.toBeNull()
    const result = evaluateCampaignPreparationCandidate(projection.candidate!, new Date('2026-10-19T12:00:00.000Z'))
    expect(result.ready).toBe(false)
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'evidence_stale', recovery_label: 'Refresh evidence', recovery_href: '/admin/agents/content-intelligence?section=research&candidate=kicklab' }))
  })

  it('is idempotent for duplicate retries and changes the input version only when source versions change', () => {
    const value = snapshot()
    const first = projectCampaignPreparationCandidate(value, new Date('2026-10-19T12:00:00.000Z'))
    const retry = projectCampaignPreparationCandidate(structuredClone(value), new Date('2026-10-19T12:00:01.000Z'))
    expect(evaluateCampaignPreparationCandidate(first.candidate!, new Date('2026-10-19T12:00:00.000Z')).ready).toBe(true)
    expect(first.candidate?.candidate_id).toBe('campaign-preparation:campaign-kicklab')
    expect(retry.candidate?.candidate_id).toBe(first.candidate?.candidate_id)
    expect(retry.inputVersion).toBe(first.inputVersion)

    const revised = structuredClone(value)
    revised.workItems[0].metadata.receipt_lineage[0].receipt_id = 'trend:kicklab:20261019'
    expect(projectCampaignPreparationCandidate(revised).inputVersion).not.toBe(first.inputVersion)
  })

  it('changes the deterministic input version when same-id receipt or signal material changes', () => {
    const value = snapshot()
    const first = projectCampaignPreparationCandidate(value)
    const revisedExpiry = structuredClone(value)
    revisedExpiry.workItems[0].metadata.public_signal.expires_at = '2026-10-26T12:00:00.000Z'
    const revisedStatus = structuredClone(value)
    revisedStatus.workItems[0].metadata.receipt_lineage[0].approval_status = 'rejected'
    expect(projectCampaignPreparationCandidate(revisedExpiry).inputVersion).not.toBe(first.inputVersion)
    expect(projectCampaignPreparationCandidate(revisedStatus).inputVersion).not.toBe(first.inputVersion)
  })

  it('projects the version-bound canonical long-form framework receipt and fingerprints its material', () => {
    const value = snapshot()
    const first = projectCampaignPreparationCandidate(value)
    expect(first.candidate?.long_form_script_input).toMatchObject({
      receipt_id: 'receipt:kicklab:long-form-framework:20261018',
      campaign_identity: 'campaign-kicklab',
      candidate_id: 'campaign-preparation:campaign-kicklab',
    })
    const revised = structuredClone(value)
    revised.socialContent[1].rag_context.long_form_script_framework_receipt.fresh_until = '2026-10-26T12:00:00.000Z'
    expect(projectCampaignPreparationCandidate(revised).inputVersion).not.toBe(first.inputVersion)
  })

  it('creates the durable run receipt before updating a changed same-id projection', async () => {
    const first = projectCampaignPreparationCandidate(snapshot())
    const revised = snapshot()
    revised.workItems[0].metadata.public_signal.expires_at = '2026-10-26T12:00:00.000Z'
    const next = projectCampaignPreparationCandidate(revised)
    const order: string[] = []
    agentRuns.start.mockImplementation(async () => { order.push('start'); return { id: 'run-1' } })
    const query: any = {
      eq: vi.fn(() => query),
      select: vi.fn(async () => { order.push('update'); return { data: [{ id: 'youtube-1' }], error: null } }),
    }
    database.from.mockReturnValue({ update: vi.fn(() => query) })
    const outcome = await persistCampaignPreparationProjection({
      projection: next,
      target: { id: 'youtube-1', updated_at: VERSION, rag_context: { campaign_preparation_candidate: first.candidate } },
      triggerSource: 'test',
    })
    expect(outcome).toBe('projected')
    expect(order).toEqual(['start', 'update'])
    expect(agentRuns.end).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
  })

  it('does not write when durable run creation fails', async () => {
    const projection = projectCampaignPreparationCandidate(snapshot())
    agentRuns.start.mockRejectedValue(new Error('receipt unavailable'))
    const update = vi.fn()
    database.from.mockReturnValue({ update })
    await expect(persistCampaignPreparationProjection({ projection, target: { id: 'youtube-1', updated_at: VERSION, rag_context: {} }, triggerSource: 'test' })).rejects.toThrow('receipt unavailable')
    expect(update).not.toHaveBeenCalled()
  })

  it('marks the durable run failed when the compare-and-swap write conflicts', async () => {
    const projection = projectCampaignPreparationCandidate(snapshot())
    const query: any = { eq: vi.fn(() => query), select: vi.fn(async () => ({ data: [], error: null })) }
    database.from.mockReturnValue({ update: vi.fn(() => query) })
    await expect(persistCampaignPreparationProjection({ projection, target: { id: 'youtube-1', updated_at: VERSION, rag_context: {} }, triggerSource: 'test' })).resolves.toBe('conflicted')
    expect(agentRuns.end).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', outcome: expect.objectContaining({ conflict: true }) }))
  })

  it('leaves sealed deliverables untouched after scheduling or release evidence exists', () => {
    const value = snapshot()
    value.socialContent[1].status = 'published'
    value.socialContent[1].platform_post_id = 'youtube-provider-id'
    const projection = projectCampaignPreparationCandidate(value)
    expect(projection.sealed).toBe(true)
    expect(projection.candidate).toBeNull()
    expect(projection.blockers.join(' ')).toMatch(/sealed/i)
  })
})
