import { describe, expect, it } from 'vitest'
import {
  SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
  SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST,
  campaignPreparationIdempotencyKey,
  evaluateCampaignPreparationCandidate,
  type CampaignPreparationCandidate,
} from './social-campaign-package-preparation'

function candidate(): CampaignPreparationCandidate {
  const receipt = (name: string) => ({ receipt_id: `receipt:${name}`, status: 'passed' as const, observed_at: '2026-10-18T12:00:00.000Z', fresh_until: '2026-10-25T12:00:00.000Z', source_href: `/admin/source-protocol?receipt=${name}`, observed_value: 82, required_value: 75, formula: 'observed / baseline', sample_size: 8 })
  return {
    version: SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
    candidate_id: 'candidate:kicklab:v1', campaign_identity: 'kicklab', product_label: 'KickLab', social_content_id: 'social:kicklab', calendar_item_ids: ['calendar:kicklab:linkedin', 'calendar:kicklab:youtube'], content_version: '2026-10-18T12:00:00.000Z', input_version: 'input:kicklab:v1', status: 'eligible',
    source_trace: [
      { source_id: 'source:1', label: 'Live comparison', href: 'https://example.com/1', decision: 'selected', reason: 'Met the recorded threshold.' },
      { source_id: 'source:2', label: 'Excluded comparison', href: 'https://example.com/2', decision: 'excluded', reason: 'Stale observation.' },
    ],
    receipts: { evidence: receipt('evidence'), outlier: { ...receipt('outlier'), route: 'social-content-outlier-decision/v1', threshold: 75, score: 82 }, product_proof: receipt('product'), originality: receipt('originality'), privacy: receipt('privacy') },
    playlist_calibration: [{ item_id: 'playlist:1', source_href: 'https://youtube.com/watch?v=one', traits: ['high contrast'], performance_weight: 0, evidence_role: 'taste_calibration_only', performance_status: 'unscored' }],
    thumbnail_checklist: Object.fromEntries(SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST.map((label) => [label, true])) as CampaignPreparationCandidate['thumbnail_checklist'],
    deliverables: { linkedin: { copy: 'A receipt-backed KickLab lesson.', visual_href: '/review-assets/kicklab-linkedin.png', visual_alt: 'KickLab product proof.' }, youtube: { title: 'What KickLab Teaches About Learning Through Motion', thumbnail_teaser: 'Math You Can Feel', description: 'Review-only evidence-backed description.', script: 'A complete source-bound script.', storyboard: ['Opening', 'Product proof', 'Close'], thumbnail_href: '/review-assets/kicklab-thumbnail.png' } },
  }
}

describe('social campaign package preparation', () => {
  it('prepares a stable idempotent package with every external gate closed', () => {
    const first = evaluateCampaignPreparationCandidate(candidate(), new Date('2026-10-19T12:00:00.000Z'))
    const second = evaluateCampaignPreparationCandidate(candidate(), new Date('2026-10-19T13:00:00.000Z'))
    expect(first.ready).toBe(true)
    expect(first.package?.package_id).toBe(second.package?.package_id)
    expect(first.package?.idempotency_key).toBe(campaignPreparationIdempotencyKey(candidate()))
    expect(Object.values(first.package?.external_gates ?? {})).toEqual(expect.arrayContaining([false]))
    expect(new Set(Object.values(first.package?.external_gates ?? {}))).toEqual(new Set([false]))
  })

  it('fails closed for stale evidence without returning deliverables', () => {
    const value = candidate()
    value.receipts.evidence.fresh_until = '2026-10-18T13:00:00.000Z'
    const result = evaluateCampaignPreparationCandidate(value, new Date('2026-10-19T12:00:00.000Z'))
    expect(result.ready).toBe(false)
    expect(result.package).toBeNull()
    expect(result.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'evidence_stale' })]))
  })

  it('keeps missing scores Unscored and rejects weighted playlist taste signals', () => {
    const value = candidate()
    value.status = 'unscored'
    value.receipts.outlier.status = 'unscored'
    value.receipts.outlier.score = null
    value.playlist_calibration[0] = { ...value.playlist_calibration[0], performance_weight: 1 as 0 }
    const result = evaluateCampaignPreparationCandidate(value, new Date('2026-10-19T12:00:00.000Z'))
    expect(result.state).toBe('unscored')
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining(['outlier_unscored', 'playlist_weight']))
  })

  it('rejects v6 thumbnail failures and duplicate title/teaser copy', () => {
    const value = candidate()
    value.thumbnail_checklist['Reject split-card or pasted-side-by-side layouts'] = false
    value.deliverables.youtube.thumbnail_teaser = value.deliverables.youtube.title
    const result = evaluateCampaignPreparationCandidate(value, new Date('2026-10-19T12:00:00.000Z'))
    expect(result.ready).toBe(false)
    expect(result.blockers.some((blocker) => blocker.code.startsWith('thumbnail_v6_'))).toBe(true)
    expect(result.blockers.map((blocker) => blocker.code)).toContain('thumbnail_title_duplicate')
  })
})
