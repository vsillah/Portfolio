import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ChannelNativeVideoReview, { getChannelVideoPacket } from './ChannelNativeVideoReview'

const shortsItem = {
  id: 'f966123f-05eb-48ec-a7c2-970afce642ef',
  platform: 'youtube',
  post_text: 'The approved Jev spoken script.',
  voiceover_text: 'The approved Jev spoken script.',
  youtube_title: null,
  youtube_description: null,
  rag_context: {
    source_type: 'version_bound_provider_none_mp4',
    workflow_state: 'human_review_required',
    input_version: 'sha256:e6fc9ae4-full-version',
    source_ids: ['docs/jev-shadow/README.md', 'research_packet:jev'],
    channel_packet_ids: ['work-item:jev', 'linkedin-approved:20261014'],
    work_item_id: 'jev-work-item',
    traceability_summary: 'Every claim remains bound to the current receipts.',
    approved_title_options: [{ title: 'Jev: what the artifact makes visible' }],
    approved_description: {
      practical_value: 'The field guide separates scoring, policy, and ownership.',
      why_artifact_matters: 'The visual makes the governance boundary inspectable.',
    },
    approved_video_packet: {
      target: 'youtube_shorts',
      provider: 'none',
      video_path: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-provider-none-review.mp4',
      poster_path: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-customer-facing-poster.png',
      duration_seconds: 22,
      width: 1080,
      height: 1920,
      video_sha256: '191d1d99c00688aba025c13bfbace887c647e36cc67e47dcbaaa0902614ca92e',
    },
    receipts: {
      source: { status: 'passed', receipt_id: 'source:jev:approved' },
      privacy: { status: 'passed', receipt_id: 'privacy:jev:public-safe' },
    },
    claims: [{
      claim_id: 'jev-policy-boundary',
      text: 'A human owner still controls exceptions.',
      privacy_boundary: 'Describe the approved mock-qualified harness only.',
    }],
    evidence_assets: [],
    side_effects: {
      provider_generation: false,
      upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
    },
  },
}

describe('ChannelNativeVideoReview', () => {
  it('projects the version-bound YouTube Shorts packet without LinkedIn preview language', () => {
    render(<ChannelNativeVideoReview item={shortsItem} />)

    const surface = screen.getByLabelText('YouTube Shorts channel-native video review')
    expect(within(surface).getByRole('heading', { name: 'Jev: what the artifact makes visible' })).toBeVisible()
    expect(within(surface).getByText(/field guide separates scoring/i)).toBeVisible()
    expect(within(surface).getByText('The approved Jev spoken script.')).toBeVisible()
    expect(within(surface).getByLabelText('YouTube Shorts review video')).toHaveAttribute(
      'src',
      '/review-assets/social-content/jev-provider-none-review.mp4',
    )
    expect(within(surface).getByLabelText('YouTube Shorts review video')).toHaveClass('aspect-[9/16]')
    expect(within(surface).getByText('Provider: none')).toBeVisible()
    expect(within(surface).getByText('privacy:jev:public-safe')).toBeInTheDocument()
    fireEvent.click(within(surface).getByText('Source lineage and privacy boundaries'))
    expect(within(surface).getByText(/Describe the approved mock-qualified harness only/i)).toBeVisible()
    expect(within(surface).getByRole('button', { name: 'Provider upload: disabled' })).toBeDisabled()
    expect(within(surface).getByRole('button', { name: 'Publishing: disabled' })).toBeDisabled()
    expect(within(surface).getByRole('link', { name: 'Open canonical Decision Queue' })).toHaveAttribute('href', '/admin/agents/coordination?proposal=jev-work-item')
    expect(within(surface).queryByText(/LinkedIn Preview/i)).not.toBeInTheDocument()
  })

  it('labels a long-form packet as YouTube and rejects unapproved asset paths', () => {
    const item = {
      ...shortsItem,
      youtube_title: 'Long-form governed automation walkthrough',
      rag_context: {
        ...shortsItem.rag_context,
        approved_video_packet: {
          ...shortsItem.rag_context.approved_video_packet,
          target: 'youtube_long_form',
          video_path: '../../private.mp4',
          poster_path: 'https://example.com/poster.png',
        },
      },
    }

    render(<ChannelNativeVideoReview item={item} />)

    expect(screen.getByLabelText('YouTube channel-native video review')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Long-form governed automation walkthrough' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('repository review media is not mapped')
    expect(getChannelVideoPacket(item)?.videoUrl).toBeNull()
    expect(getChannelVideoPacket(item)?.posterUrl).toBeNull()
  })

  it('does not project ordinary LinkedIn records', () => {
    expect(getChannelVideoPacket({
      ...shortsItem,
      platform: 'linkedin',
      rag_context: { source_type: 'manual' },
    })).toBeNull()
  })
})
