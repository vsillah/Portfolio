import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SocialContentQueuePage from './page'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/AgenticContentReviewPacketPager', () => ({
  default: () => null,
}))

vi.mock('@/components/admin/ExtractionStatusChip', () => ({
  ExtractionStatusChip: () => null,
}))

vi.mock('@/lib/hooks/useExtractionStatus', () => ({
  useExtractionStatus: () => ({
    running: false,
    activeRunId: null,
    lastCompletedAt: null,
    lastError: null,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

vi.mock('@/lib/agentic-content-review-packets', () => ({
  getAgenticContentReviewPacketsForSurface: () => [],
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}))

describe('SocialContentQueuePage Instagram provider setup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/social-content/config')) {
        return {
          ok: true,
          json: async () => ({
            configs: [{
              id: 'config-instagram',
              platform: 'instagram',
              settings: {},
              is_active: true,
              credentials_configured: true,
              provider_setup: {
                provider: 'meta_instagram_graph',
                ready: false,
                requirements: {
                  professional_account: true,
                  meta_page_linked: false,
                  access_token: true,
                  ig_user_business_id: true,
                  app_review_permissions: false,
                },
                human_gate: 'Store credentials through the approved secret/config path only. Final Instagram publish remains separately human-submitted.',
              },
              created_at: '2026-08-05T10:00:00.000Z',
              updated_at: '2026-08-05T10:00:00.000Z',
            }],
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          items: [],
          stats: { draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 },
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      } as Response
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Instagram requirements without exposing credential values or setup actions', async () => {
    render(<SocialContentQueuePage />)

    expect(await screen.findByText('Meta Instagram/Facebook readiness')).toBeInTheDocument()
    expect(screen.getByText(/Connect Meta before Instagram or Facebook companion posts can be submitted/i)).toBeInTheDocument()
    expect(screen.getByText('Professional Instagram account')).toBeInTheDocument()
    expect(screen.getByText('Meta Page linkage')).toBeInTheDocument()
    expect(screen.getByText('Access token stored')).toBeInTheDocument()
    expect(screen.getByText('IG user/business account ID')).toBeInTheDocument()
    expect(screen.getByText('App review/permissions')).toBeInTheDocument()
    expect(screen.getByText('Facebook Page token')).toBeInTheDocument()
    expect(screen.getByText('Facebook Page ID')).toBeInTheDocument()
    expect(screen.getByText('Secrets are not displayed or seeded here. Provider configuration does not create drafts, schedule, or publish.')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect Meta/i })).toBeInTheDocument()
    expect(screen.queryByText('secret-instagram-token')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect Instagram/i })).not.toBeInTheDocument()
  })

  it('warns when scheduled content has a stale unreleased date', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/social-content/config')) {
        return { ok: true, json: async () => ({ configs: [] }) } as Response
      }
      if (url.includes('/api/admin/social-content/voice-notes')) {
        return { ok: true, json: async () => ({ intakes: [] }) } as Response
      }
      return {
        ok: true,
        json: async () => ({
          items: [{
            id: 'social-stale',
            meeting_record_id: null,
            platform: 'x',
            status: 'scheduled',
            post_text: 'Approved X copy whose scheduled time elapsed before publication.',
            cta_text: null,
            cta_url: null,
            hashtags: ['#AgentOps'],
            image_url: null,
            image_prompt: null,
            framework_visual_type: null,
            voiceover_url: null,
            voiceover_text: null,
            video_url: null,
            topic_extracted: { topic: 'Stale approved X post' },
            hormozi_framework: null,
            rag_context: {},
            scheduled_for: '2026-08-14T12:00:00.000Z',
            published_at: null,
            platform_post_id: null,
            admin_notes: null,
            reviewed_by: null,
            target_platforms: ['x'],
            video_generation_method: 'none',
            youtube_title: null,
            youtube_description: null,
            created_at: '2026-08-10T12:00:00.000Z',
            updated_at: '2026-08-15T12:00:00.000Z',
          }],
          stats: { draft: 0, approved: 0, scheduled: 1, published: 0, rejected: 0, total: 1 },
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      } as Response
    }))

    render(<SocialContentQueuePage />)

    expect(await screen.findByText('Stale schedule')).toBeInTheDocument()
    expect(screen.getByText('Scheduled time has elapsed. Review status recovery before treating this as launch-ready.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Approved X copy whose scheduled time elapsed before publication/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/admin/social-content/social-stale?step=status'),
    )
  })

  it('hydrates status and platform filters from drilldown query links', async () => {
    const requests: string[] = []
    window.history.replaceState({}, '', '/admin/social-content?status=published&platform=linkedin')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requests.push(url)

      if (url.includes('/api/admin/social-content/config')) {
        return { ok: true, json: async () => ({ configs: [] }) } as Response
      }

      return {
        ok: true,
        json: async () => ({
          items: [{
            id: 'social-published',
            meeting_record_id: null,
            platform: 'linkedin',
            status: 'published',
            post_text: 'published LinkedIn social copy',
            cta_text: null,
            cta_url: null,
            hashtags: ['#AgentOps'],
            image_url: null,
            image_prompt: null,
            framework_visual_type: null,
            voiceover_url: null,
            voiceover_text: null,
            video_url: null,
            topic_extracted: { topic: 'published topic' },
            hormozi_framework: null,
            rag_context: {},
            scheduled_for: null,
            published_at: '2026-09-16T12:00:00.000Z',
            platform_post_id: null,
            admin_notes: null,
            reviewed_by: null,
            target_platforms: ['linkedin'],
            video_generation_method: 'none',
            youtube_title: null,
            youtube_description: null,
            created_at: '2026-09-01T12:00:00.000Z',
            updated_at: '2026-09-01T12:00:00.000Z',
          }],
          stats: { draft: 0, approved: 0, scheduled: 0, published: 1, rejected: 0, total: 1 },
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      } as Response
    }))

    render(<SocialContentQueuePage />)

    expect(await screen.findByText('published LinkedIn social copy')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter social content by status' })).toHaveValue('published')
    expect(screen.getByRole('combobox', { name: 'Filter social content by platform' })).toHaveValue('linkedin')
    expect(screen.getByRole('button', { name: 'Filter social content to published (1)' })).toHaveAttribute('aria-pressed', 'true')
    expect(requests.some((url) => (
      url.includes('/api/admin/social-content?') &&
      url.includes('status=published') &&
      url.includes('platform=linkedin')
    ))).toBe(true)
  })

  it('keeps status metric filters and the status dropdown in sync', async () => {
    const requests: string[] = []
    window.history.replaceState({}, '', '/admin/social-content')
    const itemForStatus = (status: 'draft' | 'approved' | 'scheduled' | 'published' | 'rejected') => ({
      id: `social-${status}`,
      meeting_record_id: null,
      platform: 'linkedin',
      status,
      post_text: `${status} social copy`,
      cta_text: null,
      cta_url: null,
      hashtags: ['#AgentOps'],
      image_url: null,
      image_prompt: null,
      framework_visual_type: null,
      voiceover_url: null,
      voiceover_text: null,
      video_url: null,
      topic_extracted: { topic: `${status} topic` },
      hormozi_framework: null,
      rag_context: {},
      scheduled_for: status === 'scheduled' ? '2026-09-15T12:00:00.000Z' : null,
      published_at: status === 'published' ? '2026-09-16T12:00:00.000Z' : null,
      platform_post_id: null,
      admin_notes: null,
      reviewed_by: null,
      target_platforms: ['linkedin'],
      video_generation_method: 'none',
      youtube_title: null,
      youtube_description: null,
      created_at: '2026-09-01T12:00:00.000Z',
      updated_at: '2026-09-01T12:00:00.000Z',
    })
    const allItems = [
      itemForStatus('draft'),
      itemForStatus('approved'),
      itemForStatus('scheduled'),
      itemForStatus('published'),
      itemForStatus('rejected'),
    ]

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requests.push(url)

      if (url.includes('/api/admin/social-content/config')) {
        return { ok: true, json: async () => ({ configs: [] }) } as Response
      }

      const parsedUrl = new URL(url, 'http://localhost')
      const requestedStatus = parsedUrl.searchParams.get('status')
      const items = requestedStatus && requestedStatus !== 'all'
        ? allItems.filter((item) => item.status === requestedStatus)
        : allItems

      return {
        ok: true,
        json: async () => ({
          items,
          stats: { draft: 1, approved: 1, scheduled: 1, published: 1, rejected: 1, total: 5 },
          pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 },
        }),
      } as Response
    }))

    render(<SocialContentQueuePage />)

    expect(await screen.findByText('draft social copy')).toBeInTheDocument()
    const statusSelect = screen.getByRole('combobox', { name: 'Filter social content by status' }) as HTMLSelectElement
    const draftMetric = screen.getByRole('button', { name: 'Filter social content to drafts (1)' })

    fireEvent.click(draftMetric)

    await waitFor(() => expect(statusSelect.value).toBe('draft'))
    await waitFor(() => {
      expect(requests.some((url) => url.includes('/api/admin/social-content?') && url.includes('status=draft'))).toBe(true)
    })
    expect(draftMetric).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('draft social copy')).toBeInTheDocument()
    expect(screen.queryByText('approved social copy')).not.toBeInTheDocument()

    fireEvent.change(statusSelect, { target: { value: 'rejected' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filter social content to rejected (1)' })).toHaveAttribute('aria-pressed', 'true')
    })
    await waitFor(() => {
      expect(requests.some((url) => url.includes('/api/admin/social-content?') && url.includes('status=rejected'))).toBe(true)
    })
    expect(screen.getByText('rejected social copy')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show all social content (5 total)' }))

    await waitFor(() => expect(statusSelect.value).toBe('all'))
    expect(screen.getByRole('button', { name: 'Show all social content (5 total)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('approved social copy')).toBeInTheDocument()
  })

  it('explains an empty status-filtered queue', async () => {
    render(<SocialContentQueuePage />)

    const rejectedMetric = await screen.findByRole('button', { name: 'Filter social content to rejected (0)' })
    fireEvent.click(rejectedMetric)

    expect(await screen.findByText('No rejected social content found.')).toBeInTheDocument()
    expect(screen.getByText('Adjust or clear filters to return to the full review queue.')).toBeInTheDocument()
    expect(rejectedMetric).toHaveAttribute('aria-pressed', 'true')
  })
})
