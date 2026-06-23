import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContentIntelligencePage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

describe('ContentIntelligencePage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/admin/social-content/intelligence/research-runs') {
        return {
          ok: true,
          json: async () => ({ packets: [{ id: 'packet-new' }], run: { mode: 'recorded_evidence' } }),
        }
      }
      if (url.startsWith('/api/admin/social-content/intelligence/research-packets')) {
        return {
          ok: true,
          json: async () => ({
            packets: [
              {
                id: 'packet-1',
                source_url: 'https://youtube.com/watch?v=abc',
                platform: 'youtube',
                creator_name: 'Creator',
                creator_handle: '@creator',
                title: 'Outlier research process',
                caption: null,
                thumbnail_url: 'https://example.com/thumb.jpg',
                hook_transcript: 'The first 30 seconds make the promise clear.',
                outlier_score: 87,
                pattern_status: 'needs_brand_translation',
                retrieved_at: '2026-06-22T12:00:00.000Z',
                actor_metadata: { actor_id: 'pintostudio/youtube-transcript-scraper' },
                metrics: { views: 120000, likes: 8000, comments: 900 },
              },
            ],
          }),
        }
      }
      if (url.startsWith('/api/admin/agents/work-items')) {
        return {
          ok: true,
          json: async () => ({
            work_items: [
              {
                id: 'work-social-1',
                title: 'Approval gates create trust',
                status: 'proposed',
                priority: 'high',
                source_type: 'social_topic_trigger',
                metadata: {
                  insight: {
                    title: 'Approval gates create trust',
                    triggering_event: 'A shipped review gate changed the work.',
                    why_vambah_can_speak: 'Vambah built the system.',
                  },
                },
                updated_at: '2026-06-22T12:00:00.000Z',
              },
            ],
          }),
        }
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows research packets and central Shaka insights', async () => {
    render(<ContentIntelligencePage />)

    expect(await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Free-first evidence layer' })).toBeInTheDocument()
    expect(screen.getByText('Recorded public evidence from Codex/browser review. Cost: $0.')).toBeInTheDocument()
    expect(screen.getByText('pintostudio/youtube-transcript-scraper only after cost approval')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add recorded public evidence' })).toBeInTheDocument()
    expect(screen.getByText('Outlier research process')).toBeInTheDocument()
    expect(screen.getByText('Approval gates create trust')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Approval gates create trust/ })).toHaveAttribute('href', '/admin/agents/social-insights/work-social-1')
  })

  it('stores recorded evidence without paid scraper fields', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })

    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://youtube.com/watch?v=recorded' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Recorded hook pattern' } })
    fireEvent.change(screen.getByLabelText('Creator'), { target: { value: 'Public Creator' } })
    fireEvent.change(screen.getByLabelText('Hook or first 30 seconds'), { target: { value: 'The hook makes a specific promise first.' } })
    fireEvent.change(screen.getByLabelText('Views'), { target: { value: '24000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Store Evidence Packet' }))

    await screen.findByText('Recorded public evidence stored.')

    const postCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/social-content/intelligence/research-runs')
    expect(postCall).toBeTruthy()

    const [, init] = postCall!
    const body = JSON.parse(String(init?.body))
    expect(body).toMatchObject({
      mode: 'recorded_evidence',
      evidence_items: [
        {
          source_url: 'https://youtube.com/watch?v=recorded',
          platform: 'youtube',
          title: 'Recorded hook pattern',
          creator_name: 'Public Creator',
          hook_transcript: 'The hook makes a specific promise first.',
          retrieval_method: 'codex_browser',
          metrics: {
            views: 24000,
          },
        },
      ],
    })
    expect(body.confirm_apify_cost).toBeUndefined()
    expect(body.sources).toBeUndefined()

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input).startsWith('/api/admin/social-content/intelligence/research-packets'))).toHaveLength(2)
    })
  })
})
