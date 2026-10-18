import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SocialCampaignReviewPacket from './SocialCampaignReviewPacket'
import { getSocialCampaignReviewPacket, SOCIAL_CAMPAIGN_REVIEW_IDS } from '@/lib/social-campaign-review-assets'

describe('SocialCampaignReviewPacket', () => {
  it('shows a concrete LinkedIn visual with source boundaries and closed external gates', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByRole('img', { name: /real gameplay board/i })).toHaveAttribute('src', expect.stringContaining('dark-castle-linkedin-remember-why.png'))
    expect(screen.getByText('Position -> choice -> consequence -> retained lesson')).toBeVisible()
    expect(screen.getByText(/Provider, upload, platform-draft, scheduling, publishing/)).toBeVisible()
  })

  it('keeps a missing-description YouTube package visibly Unscored and blocked', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    const gate = screen.getByRole('region', { name: 'YouTube description evidence gate' })
    expect(within(gate).getByText('Description evidence: Unscored')).toBeVisible()
    expect(within(gate).getByText('0/3 qualifying descriptions')).toBeVisible()
    expect(within(gate).getByText(/No qualifying description cohort is attached/)).toBeVisible()
    expect(screen.getByText('Final video blocked')).toBeVisible()
    expect(screen.getByText('WHO OWNS THE CLEANUP?')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Evidence-ready thumbnail reading WHO OWNS THE CLEANUP?' })).toHaveAttribute('src', expect.stringContaining('ai-audit-who-owns-the-cleanup-v4.png'))
    expect(screen.getByText(/Canonical thumbnail receipt: thumbnail:ai-audit:youtube-long-form:20261018:v4/)).toBeVisible()
    expect(screen.getByText('Thumbnail evidence: Ready')).toBeVisible()
    expect(screen.getByText(/93.5\/100/)).toBeVisible()
    const diversity = screen.getByRole('region', { name: 'YouTube thumbnail composition diversity' })
    expect(within(diversity).getByText('Batch diversity: Distinct')).toBeVisible()
    expect(within(diversity).getByText('bright-auditor-score-reaction')).toBeVisible()
    const decisionRoute = screen.getByRole('region', { name: 'Thumbnail decision route' })
    expect(within(decisionRoute).getByText('Receipt-backed Ready')).toBeVisible()
    expect(within(decisionRoute).getByText('Saved playlist · 14 captured items')).toBeVisible()
    expect(within(decisionRoute).getByText(/Taste calibration only · performance weight 0 · unscored/)).toBeVisible()
    expect(within(decisionRoute).getByText(/decision:ai-audit:20261018:v3/)).toBeVisible()
  })

  it('shows a source-bound Dark Castle thumbnail without clearing the description blocker', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByRole('img', { name: 'Evidence-ready thumbnail reading REMEMBER THE WHY' })).toHaveAttribute('src', expect.stringContaining('dark-castle-remember-the-why-v4.png'))
    expect(screen.getByRole('region', { name: 'YouTube thumbnail evidence gate' })).toHaveTextContent('16:9 long-form')
    expect(screen.getByText('Description evidence: Unscored')).toBeVisible()
    expect(screen.getByText('0/3 qualifying descriptions')).toBeVisible()
    expect(screen.getByText('Final video blocked')).toBeVisible()
    expect(screen.getByText(/every external execution gate remain closed/)).toBeVisible()
    expect(screen.getAllByText('bright-teacher-decision-point').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('region', { name: 'Thumbnail decision route' })).toHaveTextContent('Taste calibration only · performance weight 0 · unscored')
  })

  it('renders the approved Jev package as reuse rather than a new generated pair', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByText('Approved pair reused')).toBeVisible()
    expect(screen.getAllByText('AI Scored It. Who Makes the Call?')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Approved thumbnail reading WHEN SHOULD AI STOP?' })).toHaveAttribute('src', expect.stringContaining('jev-youtube-short-thumbnail-v5.png'))
  })
})
