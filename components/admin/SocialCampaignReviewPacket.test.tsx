import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SocialCampaignReviewPacket from './SocialCampaignReviewPacket'
import { getSocialCampaignReviewPacket, SOCIAL_CAMPAIGN_REVIEW_IDS } from '@/lib/social-campaign-review-assets'

describe('SocialCampaignReviewPacket', () => {
  it('shows a concrete LinkedIn visual with source boundaries and closed external gates', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByRole('img', { name: /approved gameplay captures/i })).toHaveAttribute('src', expect.stringContaining('dark-castle-linkedin-remember-why.png'))
    expect(screen.getByText('Explore the position; inspect the response; explain the next choice.')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('JIT refresh required before a current content decision')
    expect(screen.getByRole('status')).toHaveTextContent('sha256:585addaef15349ec135a57dd67308492110f6e97aecac2585e5936737d21918b')
    expect(screen.getByText(/Provider, upload, platform-draft, scheduling, publishing/)).toBeVisible()
  })

  it('shows a current version-bound LinkedIn receipt without the stale blocker', () => {
    const packet = getSocialCampaignReviewPacket(
      SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn,
      {
        content_version: 'sha256:b4442c963c109c06c2983253917aca64b7e3a9bbbeccb0ffcdbe40c4f449515a',
        jit_observed_at: '2026-10-25T10:22:00.000Z',
        jit_expires_at: '2026-10-27T10:22:00.000Z',
        jit_refresh_receipt_id: 'review-prep:dark-castle-linkedin:b4442c963c109c06',
        human_qa_status: 'pending_current_binding',
        visual_sha256: 'sha256:88f26176acb339f10373dc39637e91ca8235f5cc3075f39ff737b97672a86091',
        image_url: '/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png',
      },
      new Date('2026-10-25T12:00:00.000Z'),
    )!

    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByRole('status')).toHaveTextContent('Current JIT receipt bound')
    expect(screen.getByRole('status')).toHaveTextContent('sha256:b4442c963c109c06c2983253917aca64b7e3a9bbbeccb0ffcdbe40c4f449515a')
    expect(screen.getByRole('status')).toHaveTextContent('review-prep:dark-castle-linkedin:b4442c963c109c06')
    expect(screen.queryByText('JIT refresh required before a current content decision')).not.toBeInTheDocument()
  })

  it('keeps a missing-description YouTube package visibly Unscored and blocked', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    const gate = screen.getByRole('region', { name: 'YouTube description evidence gate' })
    expect(within(gate).getByText('Description evidence: Unscored')).toBeVisible()
    expect(within(gate).getByText('1/3 qualifying descriptions')).toBeVisible()
    expect(within(gate).getByRole('link', { name: /I Built an AI Audit That Replaces a \$50,000 Consultant/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=fSAazWLuDyQ')
    expect(screen.getByText('Final video blocked')).toBeVisible()
    expect(screen.getByText('WHO OWNS THE CLEANUP?')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Evidence-ready thumbnail reading WHO OWNS THE CLEANUP?' })).toHaveAttribute('src', expect.stringContaining('ai-audit-who-owns-the-cleanup-v6.png'))
    expect(screen.getByText(/Canonical thumbnail receipt: thumbnail:ai-audit:youtube-long-form:20261018:v6/)).toBeVisible()
    expect(screen.getByText('Thumbnail evidence: Ready')).toBeVisible()
    expect(screen.getByText(/93.5\/100/)).toBeVisible()
    const diversity = screen.getByRole('region', { name: 'YouTube thumbnail composition diversity' })
    expect(within(diversity).getByText('Batch diversity: Distinct')).toBeVisible()
    expect(within(diversity).getByText('integrated-audit-cleanup-scene')).toBeVisible()
    const decisionRoute = screen.getByRole('region', { name: 'Thumbnail decision route' })
    expect(within(decisionRoute).getByText('Receipt-backed Ready')).toBeVisible()
    expect(within(decisionRoute).getByText('Saved playlist · 14 captured items')).toBeVisible()
    expect(within(decisionRoute).getByText(/Taste calibration only · performance weight 0 · unscored/)).toBeVisible()
    expect(within(decisionRoute).getByText(/decision:ai-audit:20261018:v4/)).toBeVisible()
  })

  it('shows a source-bound Dark Castle thumbnail without clearing the description blocker', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube)!
    render(<SocialCampaignReviewPacket packet={packet} />)

    expect(screen.getByRole('img', { name: 'Evidence-ready thumbnail reading REMEMBER THE WHY' })).toHaveAttribute('src', expect.stringContaining('dark-castle-remember-the-why-v6.png'))
    expect(screen.getByRole('region', { name: 'YouTube thumbnail evidence gate' })).toHaveTextContent('16:9 long-form')
    expect(screen.getByText('Description evidence: Unscored')).toBeVisible()
    expect(screen.getByText('1/3 qualifying descriptions')).toBeVisible()
    expect(screen.getByText('Final video blocked')).toBeVisible()
    expect(screen.getByText(/every external execution gate remain closed/)).toBeVisible()
    expect(screen.getAllByText('integrated-chess-decision-scene').length).toBeGreaterThanOrEqual(1)
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
