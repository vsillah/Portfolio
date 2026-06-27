import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function socialWorkItem(overrides: Record<string, unknown> = {}) {
  return {
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
        approved_research_patterns: [
          {
            packet_id: 'packet-1',
            source_url: 'https://youtube.com/watch?v=abc',
            platform: 'youtube',
            creator_name: 'Creator',
            title: 'Useful outlier',
            outlier_score: 87,
            pattern_packet: {
              hook_structure: 'Start with the missed approval gate.',
              promise_value: 'Show how review gates build trust.',
              thumbnail_pattern: 'Translate the layout into AmaduTown style.',
            },
          },
        ],
      },
      channel_lanes: {
        linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
        youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
        instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
        thumbnail: { status: 'not_started', label: 'Thumbnail', required_inputs: ['short thumbnail text', '2-3 variants'] },
      },
    },
    updated_at: '2026-06-22T12:00:00.000Z',
    ...overrides,
  }
}

describe('SocialInsightDetailPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/admin/agents/work-items/work-social-1') {
        return {
          ok: true,
          json: async () => ({ work_item: socialWorkItem() }),
        }
      }
      if (url === '/api/admin/agents/work-items/work-social-1/social-channels/prepare-review-drafts') {
        const base = socialWorkItem()
        return {
          ok: true,
          json: async () => ({
            success: true,
            work_item: {
              ...base,
              metadata: {
                ...base.metadata,
                channel_lanes: {
                  ...base.metadata.channel_lanes,
                  linkedin: {
                    ...base.metadata.channel_lanes.linkedin,
                    status: 'in_review',
                    review_requested_at: '2026-06-24T15:00:00.000Z',
                    draft_packet: {
                      channel: 'linkedin',
                      generated_at: '2026-06-24T15:00:00.000Z',
                      source_use_boundary: 'Drafts are generated for human review only.',
                      fields: {
                        post_text: 'The Social Content review flow made the gate visible.\n\nAI should reduce burden.',
                        cta: 'Where have you seen AI create more work because the approval path was never designed?',
                        hashtags: ['#AIProduct', '#AmaduTownAdvisory'],
                      },
                    },
                  },
                  youtube_shorts: {
                    ...base.metadata.channel_lanes.youtube_shorts,
                    status: 'in_review',
                    review_requested_at: '2026-06-24T15:00:00.000Z',
                    draft_packet: {
                      channel: 'youtube_shorts',
                      generated_at: '2026-06-24T15:00:00.000Z',
                      source_use_boundary: 'Drafts are generated for human review only.',
                      fields: {
                        hook: 'AI should reduce burden.',
                        first_30_seconds: 'I noticed this through the social content review flow.',
                        script: ['Opening: AI should reduce burden.', 'Trigger: Social Content review flow.'],
                      },
                    },
                  },
                },
              },
            },
            side_effects: {
              provider_generation: false,
              upload: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        }
      }
      if (url === '/api/admin/agents/work-items/work-social-1/social-channels/linkedin') {
        const body = JSON.parse(String(init?.body ?? '{}'))
        return {
          ok: true,
          json: async () => ({
            success: true,
            work_item: socialWorkItem({
              metadata: {
                ...socialWorkItem().metadata,
                channel_lanes: {
                  ...socialWorkItem().metadata.channel_lanes,
                  linkedin: {
                    ...socialWorkItem().metadata.channel_lanes.linkedin,
                    status: body.status,
                    decision_note: body.decision_note,
                    updated_at: '2026-06-23T10:00:00.000Z',
                  },
                },
              },
            }),
            side_effects: {
              provider_generation: false,
              upload: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }))
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
    expect(screen.getByText('Approved research patterns')).toBeInTheDocument()
    expect(screen.getByText('Useful outlier')).toBeInTheDocument()
    expect(screen.getByText('Hook: Start with the missed approval gate.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Thumbnail/ }))

    expect(screen.getByText('Thumbnail production inputs')).toBeInTheDocument()
    expect(screen.getByText('short thumbnail text')).toBeInTheDocument()
    expect(screen.getByText('2-3 variants')).toBeInTheDocument()
  })

  it('requires a decision note before blocking a channel lane', async () => {
    render(<SocialInsightDetailPage />)

    await screen.findByRole('heading', { name: 'Approval gates create trust' })
    fireEvent.click(screen.getByRole('button', { name: 'Reject Lane' }))

    expect(await screen.findByText('Add a decision note before rejecting a channel lane.')).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/social-channels/linkedin'))).toBe(false)
  })

  it('updates a channel lane decision through the review controls', async () => {
    render(<SocialInsightDetailPage />)

    await screen.findByRole('heading', { name: 'Approval gates create trust' })

    fireEvent.change(screen.getByLabelText('Decision note'), {
      target: { value: 'Approved for LinkedIn planning; no publishing authorized.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Approve Lane' }))

    await screen.findByText('LinkedIn lane marked approved.')

    const patchCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/agents/work-items/work-social-1/social-channels/linkedin')
    expect(patchCall).toBeTruthy()
    expect(patchCall?.[1]).toMatchObject({
      method: 'PATCH',
    })
    expect(Object.fromEntries(new Headers(patchCall?.[1]?.headers))).toMatchObject({
      authorization: 'Bearer admin-token',
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
      status: 'approved',
      decision_note: 'Approved for LinkedIn planning; no publishing authorized.',
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approved' })).toBeInTheDocument()
    })
  })

  it('prepares LinkedIn and YouTube review drafts from the shared insight', async () => {
    render(<SocialInsightDetailPage />)

    await screen.findByRole('heading', { name: 'Approval gates create trust' })
    fireEvent.click(screen.getByRole('button', { name: 'Prepare LinkedIn + YouTube Review Drafts' }))

    expect(await screen.findByText('LinkedIn and YouTube Shorts are ready for human review.')).toBeInTheDocument()
    expect(screen.getByText('Review draft packet')).toBeInTheDocument()
    expect(screen.getAllByText((content) => content.includes('The Social Content review flow made the gate visible.'))).toHaveLength(2)
    expect(screen.getByText('#AmaduTownAdvisory')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /YouTube Shorts/ }))

    expect(screen.getByText('YouTube Shorts production inputs')).toBeInTheDocument()
    expect(screen.getByText('first 30 seconds')).toBeInTheDocument()
    expect(screen.getByText('I noticed this through the social content review flow.')).toBeInTheDocument()
    expect(screen.getByText('Opening: AI should reduce burden.')).toBeInTheDocument()

    const prepareCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/agents/work-items/work-social-1/social-channels/prepare-review-drafts')
    expect(prepareCall).toBeTruthy()
    expect(prepareCall?.[1]).toMatchObject({ method: 'POST' })
  })
})
