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
})
