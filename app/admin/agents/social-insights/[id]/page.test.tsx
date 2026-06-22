import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SocialInsightDetailPage from './page'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'work-social-1' }),
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

describe('SocialInsightDetailPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        work_item: {
          id: 'work-social-1',
          title: 'Approval gates create trust',
          status: 'proposed',
          priority: 'high',
          source_type: 'social_topic_trigger',
          metadata: {
            insight: {
              title: 'Approval gates create trust',
              triggering_event: 'The Social Content review flow made the gate visible.',
              why_vambah_can_speak: 'Vambah is building and reviewing the system directly.',
              evidence_summary: 'Review path and visual gate work shipped locally.',
              brand_goal: 'Show AmaduTown as the operating layer for governed AI.',
              audience: 'Operators adopting AI workflows.',
              content_angle: 'AI should reduce burden, but only when authority and evidence are separated.',
              suggested_hook: 'AI should reduce burden.',
              claim_boundaries: ['Do not imply publishing is automated.'],
            },
            channel_lanes: {
              linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
              youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
              instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
              thumbnail: { status: 'not_started', label: 'Thumbnail', required_inputs: ['short thumbnail text', '2-3 variants'] },
            },
          },
          updated_at: '2026-06-22T12:00:00.000Z',
        },
      }),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows shared evidence and channel-specific production tabs', async () => {
    render(<SocialInsightDetailPage />)

    expect(await screen.findByRole('heading', { name: 'Approval gates create trust' })).toBeInTheDocument()
    expect(screen.getByText('The Social Content review flow made the gate visible.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /LinkedIn/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /YouTube Shorts/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Instagram Reels/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Thumbnail/ })).toBeInTheDocument()
    expect(screen.getByText('post text')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Thumbnail/ }))

    expect(screen.getByText('Thumbnail production inputs')).toBeInTheDocument()
    expect(screen.getByText('short thumbnail text')).toBeInTheDocument()
    expect(screen.getByText('2-3 variants')).toBeInTheDocument()
  })
})
