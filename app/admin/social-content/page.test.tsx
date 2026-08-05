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

    expect(await screen.findByText('Instagram Graph readiness')).toBeInTheDocument()
    expect(screen.getByText(/Prepare Instagram before posts, Reels, or carousels are submitted/i)).toBeInTheDocument()
    expect(screen.getByText('Professional Instagram account')).toBeInTheDocument()
    expect(screen.getByText('Meta Page linkage')).toBeInTheDocument()
    expect(screen.getByText('Access token stored')).toBeInTheDocument()
    expect(screen.getByText('IG user/business account ID')).toBeInTheDocument()
    expect(screen.getByText('App review/permissions')).toBeInTheDocument()
    expect(screen.getByText('Secrets are not displayed or seeded here. Provider configuration does not create drafts, schedule, or publish.')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.queryByText('secret-instagram-token')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Connect Instagram/i })).not.toBeInTheDocument()
  })
})
