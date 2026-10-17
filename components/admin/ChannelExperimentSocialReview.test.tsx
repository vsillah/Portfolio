import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { channelExperimentSocialContentQaFixture } from '@/lib/social-channel-experiment-qa-fixture'
import ChannelExperimentSocialReview, { getChannelExperimentSocialReview } from './ChannelExperimentSocialReview'

describe('ChannelExperimentSocialReview', () => {
  it('shows the channel-native YouTube record and evidence requirements without execution actions', () => {
    const item = channelExperimentSocialContentQaFixture('1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f')
    render(<ChannelExperimentSocialReview item={item} />)

    const review = screen.getByRole('region', { name: `YouTube experiment review: ${item.youtube_title}` })
    expect(within(review).getByText(item.youtube_title!)).toBeVisible()
    expect(within(review).getByText(item.youtube_description!)).toBeVisible()
    expect(within(review).getByText('Opening hook')).toBeVisible()
    expect(within(review).getByText('Episode outline')).toBeVisible()
    expect(within(review).getByText('Thumbnail brief')).toBeVisible()
    expect(within(review).getByText('Evidence lineage')).toBeVisible()
    expect(within(review).getByText('Product-proof requirements')).toBeVisible()
    expect(within(review).getAllByText('Unscored').length).toBeGreaterThan(0)
    expect(within(review).getByText(/cannot call a provider, render or upload media/i)).toBeVisible()
    expect(within(review).queryByRole('button')).not.toBeInTheDocument()
  })

  it('does not reinterpret an ordinary LinkedIn item as a YouTube experiment', () => {
    expect(getChannelExperimentSocialReview({ id: 'social-1', platform: 'linkedin', rag_context: {} })).toBeNull()
  })

  it('shows a JIT YouTube campaign description with its qualified cohort and source links', () => {
    const item = {
      id: 'jev-youtube',
      platform: 'youtube',
      post_text: 'The model kept choosing. The harness had to learn when to slow it down.',
      youtube_title: 'The AI Won After the System Slowed It Down',
      youtube_description: 'The model kept choosing. The harness had to learn when to slow it down.\n\nA practical case study with visible source and policy boundaries.\n\nWhere does your agent need a stronger harness?',
      rag_context: {
        source: 'human_qa_approved_jit_campaign_packet',
        campaign_title: 'Jev: The Model Won After the Harness Changed',
        stable_campaign_identity: 'campaign:jev:harness-owns-the-outcome:v1',
        jit_score: 85,
        jit_refresh_receipt_id: 'jit-refresh:jev',
        claim_boundary: 'Attribute the result and the harness interventions.',
        approval_boundary: 'Internal review only.',
        storyboard: ['Show the loop', 'Reveal the harness'],
        thumbnail_direction: 'Presenter left; game path right.',
        product_sources: ['Approved Jev operator field guide'],
        source_lineage: ['https://jev-plays-pokemon.standardagents.ai/'],
        description_outlier_evidence: {
          status: 'ready',
          release_readiness: 'ready',
          minimum_source_count: 3,
          minimum_outlier_score: 65,
          sources: [
            { source_title: 'Jev source one', source_url: 'https://youtube.com/watch?v=one' },
            { source_title: 'Jev source two', source_url: 'https://youtube.com/watch?v=two' },
            { source_title: 'Jev source three', source_url: 'https://youtube.com/watch?v=three' },
          ],
          blockers: [],
          remediation_receipts: [],
        },
        description_evidence_release_gate: { status: 'ready' },
      },
    }

    render(<ChannelExperimentSocialReview item={item} />)

    const review = screen.getByRole('region', { name: `YouTube campaign review: ${item.youtube_title}` })
    expect(within(review).getByText(/A practical case study with visible source and policy boundaries/)).toBeVisible()
    expect(within(review).getByText('Evidence ready')).toBeVisible()
    expect(within(review).getByText(/3 qualifying sources; minimum 3; outlier threshold 65/)).toBeVisible()
    expect(within(review).getByRole('link', { name: /Jev source one/ })).toHaveAttribute('href', 'https://youtube.com/watch?v=one')
    expect(within(review).queryByText('LinkedIn Preview')).not.toBeInTheDocument()
  })

  it('normalizes an exact persisted review-only YouTube row without fixture metadata', () => {
    const item = channelExperimentSocialContentQaFixture('1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f')
    const packet = (item.rag_context as Record<string, unknown>).channel_experiment_review as Record<string, unknown>
    item.rag_context = {
      source: 'channel_experiment_review',
      research_packet_id: packet.packet_id,
      channel_experiment_variant_id: packet.variant_id,
      review_only: true,
      provider_actions_enabled: false,
      platform_draft_enabled: false,
      external_execution_enabled: false,
      publish_gate: 'draft_only',
    }

    const review = getChannelExperimentSocialReview(item)
    expect(review).toMatchObject({
      packetId: packet.packet_id,
      variantId: packet.variant_id,
      title: item.youtube_title,
      source: 'persisted',
    })
  })

  it('fails closed when a persisted row does not match its authorized variant binding', () => {
    const item = channelExperimentSocialContentQaFixture('1f3cec8c-afcb-4551-90fa-b8d4f9dabe2f')
    item.rag_context = {
      source: 'channel_experiment_review',
      research_packet_id: '407df879-a539-40a1-a20e-75de31b9c494',
      channel_experiment_variant_id: 'harness-yt-b',
      review_only: true,
      provider_actions_enabled: false,
      platform_draft_enabled: false,
      external_execution_enabled: false,
      publish_gate: 'draft_only',
    }

    expect(getChannelExperimentSocialReview(item)).toBeNull()
  })
})
