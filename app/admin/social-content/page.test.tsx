import { render, screen } from '@testing-library/react'
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
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
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
})
