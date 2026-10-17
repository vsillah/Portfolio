import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import YouTubeDescriptionLibrary from './YouTubeDescriptionLibrary'

function packet(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    source_url: `https://youtube.com/watch?v=${id}`,
    platform: 'youtube',
    creator_name: `Creator ${id}`,
    title: `AI license audit ${id}`,
    caption: 'Stop counting seats.\n\nSee the calculator product walkthrough.\n\nSubscribe for more operating breakdowns.',
    outlier_score: 80,
    pattern_status: 'usable_framework',
    retrieved_at: '2026-10-10T12:00:00.000Z',
    metrics: { published_at: '2026-10-09T12:00:00.000Z', follower_count: 40_000 },
    actor_metadata: { topics: ['ai licenses', 'audit calculator'] },
    ...overrides,
  }
}

describe('YouTubeDescriptionLibrary', () => {
  it('shows qualifying sources, applied structure, and exact source links', () => {
    render(<YouTubeDescriptionLibrary
      researchPackets={[packet('a'), packet('b', { outlier_score: 91 }), packet('c', { outlier_score: 87 })]}
      initialTopic="AI licenses"
      generatedAt="2026-10-17T12:00:00.000Z"
    />)

    expect(screen.getByRole('heading', { name: 'YouTube description patterns' })).toBeVisible()
    expect(screen.getByText('Ready')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Approved descriptions: 3. Show sources.' })).toBeVisible()
    expect(screen.getAllByRole('link', { name: 'Open source' })).toHaveLength(3)

    fireEvent.click(screen.getByRole('tab', { name: 'Structure' }))
    expect(screen.getByText(/first-party product example or screenshot/)).toBeVisible()
    expect(screen.getByText(/Reuse aggregate description structure only/)).toBeVisible()
  })

  it('explains exclusions and fails closed without enough evidence', () => {
    render(<YouTubeDescriptionLibrary
      researchPackets={[
        packet('approved'),
        packet('low-score', { outlier_score: 42 }),
        packet('missing-description', { caption: '' }),
      ]}
      initialTopic="AI licenses"
      generatedAt="2026-10-17T12:00:00.000Z"
    />)

    expect(screen.getByText('Unscored')).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: /Excluded/ }))
    expect(screen.getByText('Outlier score 42 is below the 65 threshold.')).toBeVisible()
    expect(screen.getByText('No customer-facing YouTube description was captured.')).toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: 'Structure' }))
    expect(screen.getByText(/Only 1 fresh, attributable same-topic outlier description/)).toBeVisible()
    expect(screen.getByText('No description structure will be applied until the cohort is ready.')).toBeVisible()
  })
})
