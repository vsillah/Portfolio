import { describe, expect, it } from 'vitest'
import { inspectSocialScriptTemplateReceipt } from '@/lib/social-script-template-receipt'
import { socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import { projectCampaignLongFormDraft } from '@/lib/social-campaign-long-form-batch'
import { getSocialCampaignReviewPacket, SOCIAL_CAMPAIGN_REVIEW_IDS } from '@/lib/social-campaign-review-assets'

const now = new Date('2026-10-19T12:00:00.000Z')

describe('canonical script template receipts', () => {
  it('keeps the current Dark Castle description distinct from a script template', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube, null, now)
    expect(packet?.kind).toBe('youtube_packaging')
    if (packet?.kind !== 'youtube_packaging') return
    expect(packet.descriptionEvidence.attribution).toHaveLength(1)
    expect(packet.scriptTemplate).toMatchObject({ ready: false, receipt: null, blockers: ['No script template recorded'] })
  })

  it('fails closed for missing, stale, mismatched, and ambiguous template bindings', () => {
    const candidate = socialCampaignPackageQaCandidates()[0]
    const receipt = candidate.long_form_script_input!.script_template_receipt!
    const input = { contentId: candidate.social_content_id, candidateId: candidate.candidate_id, contentVersion: candidate.content_version, now }
    for (const changed of [null, { ...receipt, fresh_until: '2026-10-18T00:00:00.000Z' }, { ...receipt, candidate_id: 'another-candidate' }, { ...receipt, applied_beat_ids: [receipt.applied_beat_ids[0], receipt.applied_beat_ids[0]] }, { ...receipt, evaluation: { ...receipt.evaluation, approval_ready: false } }]) {
      expect(inspectSocialScriptTemplateReceipt({ ...input, receipt: changed }).ready).toBe(false)
      const blocked = structuredClone(candidate)
      blocked.long_form_script_input!.script_template_receipt = changed
      expect(projectCampaignLongFormDraft(blocked, now)).toMatchObject({ ready: false, packet: null })
    }
  })

  it('persists every bound field in an approval-ready prepared packet', () => {
    const candidate = socialCampaignPackageQaCandidates()[0]
    const receipt = candidate.long_form_script_input!.script_template_receipt!
    expect(inspectSocialScriptTemplateReceipt({ receipt, contentId: candidate.social_content_id, candidateId: candidate.candidate_id, contentVersion: candidate.content_version, now }).ready).toBe(true)
    const projection = projectCampaignLongFormDraft(candidate, now)
    expect(projection.ready).toBe(true)
    expect(projection.packet?.script_template_receipt).toEqual(receipt)
    expect(projection.packet?.script_template_receipt.applied_beat_ids).toEqual(projection.packet?.beats.map((beat) => beat.id))
    const runtime = structuredClone(receipt)
    runtime.content_id = SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube
    runtime.candidate_id = 'candidate:dark-castle:review'
    runtime.content_version = '2026-10-18T00:00:00.000Z'
    const review = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube, {
      long_form_script_framework_receipt: { candidate_id: runtime.candidate_id, script_template_receipt: runtime },
      script_template_content_version: runtime.content_version,
    }, now)
    expect(review?.kind === 'youtube_packaging' && review.scriptTemplate?.ready).toBe(true)
  })

  it('rejects a score below 75 and a non-finite score, and accepts the exact threshold', () => {
    const below = approvalReadyReceipt()
    below.receipt.evaluation.score = 74.999
    expect(inspectSocialScriptTemplateReceipt(below)).toEqual({
      ready: false,
      blockers: ['Script template evaluation is not approval-ready.'],
    })

    const exact = approvalReadyReceipt()
    exact.receipt.evaluation.score = 75
    expect(inspectSocialScriptTemplateReceipt(exact)).toEqual({ ready: true, blockers: [] })

    const infinite = approvalReadyReceipt()
    infinite.receipt.evaluation.score = Number.POSITIVE_INFINITY
    expect(inspectSocialScriptTemplateReceipt(infinite)).toEqual({
      ready: false,
      blockers: ['Script template evaluation is not approval-ready.'],
    })
  })

  it('rejects whitespace-only source and originality boundaries', () => {
    for (const field of ['source_boundary', 'originality_boundary'] as const) {
      const input = approvalReadyReceipt()
      input.receipt[field] = ' \n\t '
      expect(inspectSocialScriptTemplateReceipt(input)).toEqual({
        ready: false,
        blockers: ['Script template source and originality boundaries are incomplete.'],
      })
    }
  })

  it('treats a freshness instant equal to the evaluation time as stale', () => {
    const stale = approvalReadyReceipt()
    stale.receipt.fresh_until = now.toISOString()
    expect(inspectSocialScriptTemplateReceipt(stale)).toEqual({
      ready: false,
      blockers: ['Script template receipt is stale or has no valid freshness window.'],
    })

    const fresh = approvalReadyReceipt()
    fresh.receipt.fresh_until = new Date(now.getTime() + 1).toISOString()
    expect(inspectSocialScriptTemplateReceipt(fresh)).toEqual({ ready: true, blockers: [] })
  })

  it('blocks a script template that does not cite the supplied framework source receipt', () => {
    const missing = approvalReadyReceipt()
    expect(inspectSocialScriptTemplateReceipt({ ...missing, sourceReceiptId: 'receipt:not-cited' })).toEqual({
      ready: false,
      blockers: ['Script template does not cite the current framework source receipt.'],
    })

    const cited = approvalReadyReceipt()
    expect(inspectSocialScriptTemplateReceipt({
      ...cited,
      sourceReceiptId: cited.receipt.source_receipt_ids[0],
    })).toEqual({ ready: true, blockers: [] })
  })
})

function approvalReadyReceipt() {
  const candidate = socialCampaignPackageQaCandidates()[0]
  const receipt = structuredClone(candidate.long_form_script_input!.script_template_receipt!)
  return {
    receipt,
    contentId: candidate.social_content_id,
    candidateId: candidate.candidate_id,
    contentVersion: candidate.content_version,
    now,
  }
}
