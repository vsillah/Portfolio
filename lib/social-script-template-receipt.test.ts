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
  })
})
