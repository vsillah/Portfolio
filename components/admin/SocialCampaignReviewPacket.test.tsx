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
    expect(screen.getByRole('img', { name: 'Review thumbnail reading WHO OWNS THE CLEANUP?' })).toHaveAttribute('src', expect.stringContaining('ai-audit-youtube-who-owns-the-cleanup.png'))
    expect(screen.getByText(/Thumbnail source receipt: sha256:/)).toBeVisible()
  })

  it('shows a source-bound Dark Castle thumbnail without clearing the description blocker', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByRole('img', { name: 'Review thumbnail reading REMEMBER THE WHY' })).toHaveAttribute('src', expect.stringContaining('dark-castle-youtube-remember-the-why.png'))
    expect(screen.getByText('Description evidence: Unscored')).toBeVisible()
    expect(screen.getByText('0/3 qualifying descriptions')).toBeVisible()
    expect(screen.getByText('Final video blocked')).toBeVisible()
    expect(screen.getByText(/every external execution gate remain closed/)).toBeVisible()
  })

  it('renders the approved Jev package as reuse rather than a new generated pair', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByText('Approved pair reused')).toBeVisible()
    expect(screen.getAllByText('AI Scored It. Who Makes the Call?')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Approved thumbnail reading WHEN SHOULD AI STOP?' })).toHaveAttribute('src', expect.stringContaining('jev-youtube-short-thumbnail-v5.png'))
  })
})
