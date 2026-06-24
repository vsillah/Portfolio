import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  const topicBacklogItem = {
    id: 'topic-backlog-1',
    candidate_key: 'approval-gates-review-meeting-1',
    title: 'Approval gates create trust',
    triggering_event: 'A recent Agent Ops review exposed where AI-generated work needed clearer ownership before publishing.',
    source_type: 'meeting',
    source_label: 'Agent Ops review',
    source_ids: ['meeting:meeting-1'],
    why_vambah_can_speak: 'You are building the Portfolio Agent Ops workflow and reviewed the approval path directly.',
    brand_goal: 'Show AmaduTown builds governed AI systems.',
    content_angle: 'AI needs accountable operating gates.',
    suggested_hook: 'AI should reduce burden. That only happens when every risky action has a gate.',
    audience: 'Product leaders adopting AI',
    sensitivity: 'needs_review',
    evidence_summary: 'Sanitized meeting summary.',
    claim_boundaries: ['Do not name private meeting participants.'],
    status: 'available',
    last_seen_at: '2026-06-22T16:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/topic-backlog')) {
        return {
          ok: true,
          json: async () => ({ items: [topicBacklogItem] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          item: baseItem,
        }),
      } as Response
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps approved copy locked while exposing visual production actions', async () => {
    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Visual Production')).toBeInTheDocument()
    expect(await screen.findByText('LinkedIn topics from Agentic Backlog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ask Shaka for Topics/i })).not.toBeInTheDocument()
    expect(screen.getByText('Approval gates create trust')).toBeInTheDocument()
    expect(screen.getByText('Weekday scan')).toBeInTheDocument()
    expect(screen.queryByText('Review gates')).not.toBeInTheDocument()
    expect(screen.queryByText('Every gate uses the same state language; the detail line preserves each system status.')).not.toBeInTheDocument()
    expect(screen.queryByText(/Copy is approved and locked/i)).not.toBeInTheDocument()
    expect(screen.getByText('Review path')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy: Approved' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supporting context: Pending' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Human review: Approved' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Challenger: Pending' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chronicle: Pending' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Visual assets: Pending' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Asset packet: Pending' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Privacy: Pending' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LinkedIn draft: Pending' })).toBeInTheDocument()
    expect(screen.getAllByText('Copy: Approved').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Supporting context: Pending').length).toBeGreaterThan(1)
    expect(screen.getByText('Human review approved · Challenger pending · Chronicle pending')).toBeInTheDocument()
    expect(screen.getAllByText('Visual assets: Pending').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Asset packet: Pending').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Privacy: Pending').length).toBeGreaterThan(1)
    expect(screen.getAllByText('LinkedIn draft: Pending').length).toBeGreaterThan(1)
    expect(screen.getByText('Request copy revision')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Triggering event or recent proof').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Revision feedback for Shaka')).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Reopen for Revision/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject and Generate Revision/i })).toBeDisabled()
    expect(screen.getByText('Choose one visual format')).toBeInTheDocument()
    expect(screen.getByText('Selected format')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate Framework Illustration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch to App Screenshot Carousel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve Visuals/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject Visuals/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Approve Asset Packet/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject Asset Packet/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Approve Privacy Review/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject Privacy Review/i })).toBeDisabled()
    expect(screen.queryByPlaceholderText('What must change before the visual assets are approved?')).not.toBeInTheDocument()
    expect(screen.getByText('LinkedIn Draft Handoff')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve LinkedIn Draft Handoff/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject LinkedIn Draft Handoff/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Create LinkedIn Draft/i })).toBeDisabled()
    expect(screen.queryByText('Publish immediately after approval')).not.toBeInTheDocument()

    expect(screen.getByDisplayValue('The draft copy is approved and should stay locked.')).toBeDisabled()
    expect(screen.getByText('AmaduTown')).toBeInTheDocument()
    expect(screen.queryByText('Amadou Town')).not.toBeInTheDocument()
    const copyGate = screen.getByText('Post Text').closest('#social-copy-gate')
    expect(copyGate).toBeTruthy()
    expect(within(copyGate as HTMLElement).getByText('CTA Text')).toBeInTheDocument()
    expect(within(copyGate as HTMLElement).getByText('CTA URL')).toBeInTheDocument()
    expect(within(copyGate as HTMLElement).getByText('Hashtags (comma-separated)')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Architecture/i)).not.toBeDisabled()
    expect(screen.getByDisplayValue('Create a framework visual about review gates.')).not.toBeDisabled()
  })

  it('lets the operator pull a topic from Shaka backlog into copy review', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/topic-backlog') && init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            item: { ...topicBacklogItem, status: 'selected' },
          }),
        } as Response
      }
      if (String(input).includes('/topic-backlog')) {
        return {
          ok: true,
          json: async () => ({ items: [topicBacklogItem] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: baseItem }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Approval gates create trust')).toBeInTheDocument()
    expect(screen.getByText(/Why you can speak on it:/)).toBeInTheDocument()
    expect(screen.getByText(/Hook: AI should reduce burden/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Use topic/i }))

    expect(screen.getAllByDisplayValue(/recent Agent Ops review exposed/).length).toBeGreaterThan(0)
    expect(screen.getAllByDisplayValue(/Anchor this draft in Shaka's selected topic trigger/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Reject and Generate Revision/i })).not.toBeDisabled()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/social-content/topic-backlog'),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('topic-backlog-1'),
        }),
      )
    })
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
    expect(screen.getAllByText('Asset packet: In review').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Privacy: Blocked').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Approve Asset Packet/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject Asset Packet/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Approve Privacy Review/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject Privacy Review/i })).not.toBeDisabled()
    expect(screen.queryByPlaceholderText('What privacy issue still needs redaction or review?')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reject Privacy Review/i }))
    expect(screen.getByRole('button', { name: /Submit Rejection/i })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('What privacy issue still needs redaction or review?'), {
      target: { value: 'The Chronicle clip still exposes private notes.' },
    })
    expect(screen.getByRole('button', { name: /Submit Rejection/i })).not.toBeDisabled()
    expect(screen.getAllByText('Video privacy review required').length).toBeGreaterThan(0)
    expect(screen.getByText('Approve Blur')).toBeInTheDocument()
    expect(screen.getByText('Reject Clip')).toBeInTheDocument()
    expect(screen.queryByText('Publish immediately after approval')).not.toBeInTheDocument()
  })

  it('stores explicit section gate decisions in rag_context', async () => {
    const itemWithVisual = {
      ...baseItem,
      content_format: 'carousel',
      carousel_slide_urls: ['https://example.com/slide-1.png'],
      carousel_pdf_url: 'https://example.com/carousel.pdf',
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return {
          ok: true,
          json: async () => ({
            item: {
              ...itemWithVisual,
              ...body,
            },
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: itemWithVisual }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Visual Production')).toBeInTheDocument()
    expect(screen.getAllByText('Visual assets: In review').length).toBeGreaterThan(0)
    expect(screen.queryByPlaceholderText('What must change before the visual assets are approved?')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Approve Visuals/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/social-content/social-1'),
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(putCall).toBeTruthy()
    const putBody = JSON.parse(String(putCall?.[1]?.body))
    expect(putBody.rag_context.section_gate_reviews.visual_assets.status).toBe('approved')
    expect(putBody.rag_context.section_gate_reviews.visual_assets.note).toBeNull()
    await waitFor(() => {
      expect(screen.getAllByText('Visual assets: Approved').length).toBeGreaterThan(1)
    })
    expect(screen.getByRole('button', { name: /Retry export/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Re-render/i })).not.toBeInTheDocument()
  })

  it('reveals a rejection note only after reject is selected', async () => {
    const itemWithVisual = {
      ...baseItem,
      image_url: 'https://example.com/framework.png',
    }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return {
          ok: true,
          json: async () => ({
            item: {
              ...itemWithVisual,
              ...body,
            },
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: itemWithVisual }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Visual Production')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('What must change before the visual assets are approved?')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reject Visuals/i }))
    expect(screen.getByPlaceholderText('What must change before the visual assets are approved?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit Rejection/i })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('What must change before the visual assets are approved?'), {
      target: { value: 'Move Proof out of the headline area.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Rejection/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/social-content/social-1'),
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    const putBody = JSON.parse(String(putCall?.[1]?.body))
    expect(putBody.rag_context.section_gate_reviews.visual_assets.status).toBe('rejected')
    expect(putBody.rag_context.section_gate_reviews.visual_assets.note).toBe('Move Proof out of the headline area.')
    expect(putBody.rag_context.section_gate_reviews.visual_assets.repair_status).toBe('requested')
    expect(putBody.rag_context.section_gate_reviews.visual_assets.repair_requested_at).toBeTruthy()
    await waitFor(() => {
      expect(screen.getAllByText('Visual assets: Rejected').length).toBeGreaterThan(1)
    })
    expect(screen.getByText('Visual assets revision in progress')).toBeInTheDocument()
    expect(screen.getByText('Controls are locked until the revised section is returned for review.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Approve Visuals/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Regenerate Framework Illustration/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Switch to App Screenshot Carousel/i })).toBeDisabled()
  })

  it('locks asset packet actions while a rejected section is awaiting repair', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        item: {
          ...baseItem,
          rag_context: {
            ...baseItem.rag_context,
            section_gate_reviews: {
              asset_packet: {
                status: 'rejected',
                decided_at: '2026-06-18T14:00:00.000Z',
                note: 'Add the missing b-roll evidence before review.',
                repair_status: 'requested',
                repair_requested_at: '2026-06-18T14:00:00.000Z',
              },
            },
          },
        },
      }),
    })))

    render(<SocialContentDetailRoute />)

    expect(await screen.findByText('Asset packet revision in progress')).toBeInTheDocument()
    expect(screen.getAllByText('Asset packet: Rejected').length).toBeGreaterThan(1)
    expect(screen.getByText('Controls are locked until the revised section is returned for review.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prepare Asset Packet/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Approve Asset Packet/i })).toBeDisabled()
  })

  it('reverts approval with revision feedback before generating the next draft', async () => {
    const feedback = 'Make the opening less abstract and show a clearer operational example.'
    const triggeringEvent = 'I just finished reviewing the Social Content approval workflow after the carousel handoff broke down.'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return {
          ok: true,
          json: async () => ({
            item: {
              ...baseItem,
              ...body,
              status: 'rejected',
            },
          }),
        } as Response
      }
      if (url.includes('/calibration-revision')) {
        return {
          ok: true,
          json: async () => ({
            item: {
              ...baseItem,
              status: 'draft',
              post_text: 'Revised draft from Shaka.',
              cta_text: 'What would make this clearer?',
              hashtags: ['#AgentOps'],
              image_prompt: 'Updated visual prompt.',
              admin_notes: 'Calibration revision generated.',
            },
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: baseItem }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SocialContentDetailRoute />)

    const triggeringEventInput = (await screen.findAllByLabelText('Triggering event or recent proof'))
      .find((element) => !(element as HTMLTextAreaElement).disabled)
    expect(triggeringEventInput).toBeTruthy()
    fireEvent.change(triggeringEventInput as HTMLTextAreaElement, {
      target: { value: triggeringEvent },
    })
    fireEvent.change(await screen.findByLabelText('Revision feedback for Shaka'), {
      target: { value: feedback },
    })
    fireEvent.click(screen.getByRole('button', { name: /Reject and Generate Revision/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/social-content/social-1/calibration-revision'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(putCall).toBeTruthy()
    const putBody = JSON.parse(String(putCall?.[1]?.body))
    expect(putBody.status).toBe('rejected')
    expect(putBody.rag_context.content_calibration.operator_feedback.triggering_event).toBe(triggeringEvent)
    expect(putBody.rag_context.content_calibration.operator_feedback.revision_request).toBe(feedback)
    expect(putBody.rag_context.content_calibration.approval_reversal.reason).toBe(feedback)

    const revisionCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/calibration-revision'))
    const revisionBody = JSON.parse(String(revisionCall?.[1]?.body))
    expect(revisionBody.operator_feedback.triggering_event).toBe(triggeringEvent)
    expect(revisionBody.operator_feedback.revision_request).toBe(feedback)
    expect(await screen.findByDisplayValue('Revised draft from Shaka.')).toBeInTheDocument()
  })
})
