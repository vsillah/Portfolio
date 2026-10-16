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
})
