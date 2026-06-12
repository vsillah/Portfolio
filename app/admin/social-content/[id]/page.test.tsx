import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SocialContentDetailRoute from './page'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'social-1' }),
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
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

describe('SocialContentDetailRoute visual production review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        item: {
          id: 'social-1',
          meeting_record_id: null,
          platform: 'linkedin',
          status: 'approved',
          post_text: 'The draft copy is approved and should stay locked.',
          cta_text: 'Build with receipts.',
          cta_url: null,
          hashtags: ['AgentOps', 'AI'],
          image_url: null,
          image_prompt: 'Create a framework visual about review gates.',
          framework_visual_type: 'architecture',
          voiceover_url: null,
          voiceover_text: null,
          video_url: null,
          topic_extracted: null,
          hormozi_framework: null,
          rag_context: {
            source: 'agent_ops_social_outreach_goal',
            publish_gate: 'draft_only',
            goal_id: 'goal-123',
            pass_to_human: true,
            visual_brief: 'Show the review gates.',
          },
          scheduled_for: null,
          published_at: null,
          platform_post_id: null,
          admin_notes: null,
          reviewed_by: 'admin-user',
          target_platforms: ['linkedin'],
          video_generation_method: 'none',
          youtube_title: null,
          youtube_description: null,
          content_format: 'single_image',
          content_pillar: null,
          companion_post_text: null,
          carousel_slides: null,
          carousel_pdf_url: null,
          carousel_slide_urls: null,
          created_at: '2026-06-12T10:00:00.000Z',
          updated_at: '2026-06-12T10:05:00.000Z',
          publishes: [],
        },
      }),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps approved copy locked while exposing visual production actions', async () => {
    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Visual Production')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate Framework Illustration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Build Carousel from App Screenshots/i })).toBeInTheDocument()
    expect(screen.getByText('Publishing locked')).toBeInTheDocument()
    expect(screen.queryByText('Publish immediately after approval')).not.toBeInTheDocument()

    expect(screen.getByDisplayValue('The draft copy is approved and should stay locked.')).toBeDisabled()
    expect(screen.getByDisplayValue(/Architecture/i)).not.toBeDisabled()
    expect(screen.getByDisplayValue('Create a framework visual about review gates.')).not.toBeDisabled()
  })
})
