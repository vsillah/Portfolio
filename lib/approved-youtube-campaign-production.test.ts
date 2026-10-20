import { describe, expect, it } from 'vitest'
import { approvedYouTubeCampaignProductionReview, evaluateApprovedYouTubeCampaign } from './approved-youtube-campaign-production'

const NOW = new Date('2026-10-20T04:30:00.000Z')

function fixture() {
  const review = approvedYouTubeCampaignProductionReview(NOW)
  return { packet: structuredClone(review.packets[0]), cohort: structuredClone(review.packets[0].description_cohort) }
}

describe('approved YouTube campaign production review', () => {
  it('binds two long-form drafts to Candidate A while preserving rejected Candidate B', () => {
    const review = approvedYouTubeCampaignProductionReview(NOW)
    expect(review.packets).toHaveLength(2)
    for (const packet of review.packets) {
      expect(packet.selected_thumbnail_id).not.toBe(packet.rejected_thumbnail_id)
      expect(packet.title).not.toBe(packet.thumbnail_teaser)
      expect(packet.script_word_count).toBeGreaterThan(1000)
      expect(packet.scenes).toHaveLength(8)
      expect(packet.evaluation.blockers).toEqual([expect.stringContaining('Description cohort Unscored')])
    }
    expect(review.packets[0].rejection_reason).toContain('Disfigured rook')
    expect(review.packets[1].rejection_reason).toContain('clearer integrated receipt-pull')
  })

  it('keeps cohorts Unscored when full descriptions or outlier samples are insufficient or stale', () => {
    const { packet, cohort } = fixture()
    expect(cohort.included_sample_size).toBe(8)
    expect(packet.evaluation.qualified_description_count).toBeLessThan(3)
    cohort.sources = []
    expect(evaluateApprovedYouTubeCampaign(packet, cohort, NOW).description_status).toBe('unscored')
    const fresh = fixture()
    expect(evaluateApprovedYouTubeCampaign(fresh.packet, fresh.cohort, new Date('2026-11-02T00:00:00.000Z')).description_status).toBe('unscored')
    const tampered = fixture()
    tampered.cohort.sources[0].performance_components.channel_relative_percentile = 0
    expect(evaluateApprovedYouTubeCampaign(tampered.packet, tampered.cohort, NOW).qualified_description_count).toBe(0)
  })

  it('fails exact content binding and rejected-candidate selection', () => {
    const { packet, cohort } = fixture()
    packet.content_version = 'stale'
    packet.selected_thumbnail_id = packet.rejected_thumbnail_id
    const result = evaluateApprovedYouTubeCampaign(packet, cohort, NOW)
    expect(result.blockers).toContain('Thumbnail selection is not bound to the exact approved content version and decision receipt.')
    expect(result.blockers).toContain('Rejected Candidate B must remain ineligible.')
  })

  it('requires a spoken close and excludes internal copy from narration', () => {
    const { packet, cohort } = fixture()
    packet.scenes[7].narration = 'The sample data fixture is ready (QA note).'
    packet.spoken_cta = ''
    const result = evaluateApprovedYouTubeCampaign(packet, cohort, NOW)
    expect(result.blockers).toContain('Customer-facing narration contains internal production language or a parenthetical aside.')
    expect(result.blockers).toContain('A spoken conclusion and channel CTA are required.')
  })

  it('fails a late opening loop or missing retention beats', () => {
    const { packet, cohort } = fixture()
    packet.retention_plan.open_loop_seconds[1] = 40
    packet.retention_plan.re_hook_seconds = []
    expect(evaluateApprovedYouTubeCampaign(packet, cohort, NOW).blockers).toContain('The first 30 seconds, re-hooks, proof placement, payoff or spoken close are not mapped to the long-form framework.')
  })

  it('requires distinct visual assets and a complete cue sheet', () => {
    const { packet, cohort } = fixture()
    packet.scenes[1].visual_asset = packet.scenes[0].visual_asset
    packet.scenes[2].audio_cue = ''
    const result = evaluateApprovedYouTubeCampaign(packet, cohort, NOW)
    expect(result.blockers).toContain('Adjacent scenes repeat the same lead visual.')
    expect(result.blockers).toContain('The timed cinematography or audio cue sheet is incomplete.')
  })

  it('requires real product proof with privacy, rights and source lineage', () => {
    const { packet, cohort } = fixture()
    packet.scenes[1].proof_href = ''
    packet.scenes[1].rights_receipt_id = 'invented-rights-receipt'
    packet.scenes[2].visual_role = 'internal_storyboard_card'
    const result = evaluateApprovedYouTubeCampaign(packet, cohort, NOW)
    expect(result.blockers).toContain('Every scene must bind first-party proof and privacy and rights receipts.')
    expect(result.blockers).toContain('Scene proof lineage does not match the approved product evidence receipts.')
    expect(result.blockers).toContain('Dark Castle requires three real gameplay captures.')
    const audit = approvedYouTubeCampaignProductionReview(NOW).packets[1]
    const auditPacket = structuredClone(audit)
    auditPacket.scenes[2].visual_asset = '/generic.png'
    expect(evaluateApprovedYouTubeCampaign(auditPacket, audit.description_cohort, NOW).blockers).toContain('AI Audit requires the actual calculator screen.')
  })
})
