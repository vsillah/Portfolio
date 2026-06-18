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
  const baseItem = {
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
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        item: baseItem,
      }),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps approved copy locked while exposing visual production actions', async () => {
    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Visual Production')).toBeInTheDocument()
    expect(screen.getByText('Choose one visual format')).toBeInTheDocument()
    expect(screen.getByText('Selected format')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate Framework Illustration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch to App Screenshot Carousel/i })).toBeInTheDocument()
    expect(screen.getByText('LinkedIn Draft Handoff')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create LinkedIn Draft/i })).toBeDisabled()
    expect(screen.queryByText('Publish immediately after approval')).not.toBeInTheDocument()

    expect(screen.getByDisplayValue('The draft copy is approved and should stay locked.')).toBeDisabled()
    expect(screen.getByDisplayValue(/Architecture/i)).not.toBeDisabled()
    expect(screen.getByDisplayValue('Create a framework visual about review gates.')).not.toBeDisabled()
  })

  it('shows production assets and blocks publish readiness while redaction is unresolved', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        item: {
          ...baseItem,
          rag_context: {
            ...baseItem.rag_context,
            production_assets: {
              version: 'social_production_assets_v2',
              status: 'review_ready',
              references: { open_brain: ['memory-1'], public_sources: [], placement_guidance: [] },
              chronicle_evidence: {
                ingestion_mode: 'direct_scoped_review',
                scope: { approved: true, source: 'social_content_detail', window_label: 'current review' },
                proposals: [{ id: 'note-1', note: 'Raw Chronicle note.', sensitivity: 'needs_redaction_review' }],
                boundary: 'Review only.',
              },
              illustration: { status: 'prompt_ready', image_prompt: 'Prompt', framework_visual_type: 'architecture' },
              app_screenshot_carousel: { status: 'recommended', routes: [{ route: '/admin/social-content/social-1', label: 'Review' }], existing_asset_count: 0 },
              broll: { status: 'matched', hints: ['admin'], assets: [{ id: 'asset-1' }] },
              video_script: { status: 'draft_ready', title: 'Video', script_text: 'Script', broll_hints: ['admin'] },
              video_redaction_manifest: {
                policy: 'hard_gate_auto_blur_first',
                status: 'requires_review',
                unresolved_count: 1,
                publish_blocker: 'Video privacy review required: 1 redaction item unresolved.',
                items: [{
                  id: 'item-1',
                  issue_type: 'email',
                  source: 'chronicle',
                  original_asset: { label: 'Chronicle evidence', url_or_path: null },
                  redacted_asset: null,
                  timestamp_ranges: [{ start_ms: 0, end_ms: 4000 }],
                  bounding_boxes: [{ x: 0, y: 0, width: 1, height: 1, label: 'full frame' }],
                  proposed_action: 'auto_blur',
                  confidence: 0.98,
                  reviewer_decision: null,
                  status: 'pending',
                  evidence: 'vambah@example.com',
                }],
              },
              visual_qa: { status: 'required', checklist: ['Review privacy.'] },
            },
          },
        },
      }),
    })))

    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Asset packet')).toBeInTheDocument()
    expect(screen.getAllByText('Video privacy review required').length).toBeGreaterThan(0)
    expect(screen.getByText('Approve Blur')).toBeInTheDocument()
    expect(screen.getByText('Reject Clip')).toBeInTheDocument()
    expect(screen.queryByText('Publish immediately after approval')).not.toBeInTheDocument()
  })
})
