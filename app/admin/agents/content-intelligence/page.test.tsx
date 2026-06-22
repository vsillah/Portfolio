import { render, screen } from '@testing-library/react'
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
    expect(screen.getByText('pintostudio/youtube-transcript-scraper')).toBeInTheDocument()
    expect(screen.getByText('Outlier research process')).toBeInTheDocument()
    expect(screen.getByText('Approval gates create trust')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Approval gates create trust/ })).toHaveAttribute('href', '/admin/agents/social-insights/work-social-1')
  })
})
