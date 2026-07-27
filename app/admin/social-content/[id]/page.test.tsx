import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SocialContentDetailRoute from './page'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: '',
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'social-1' }),
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
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
    mocks.search = ''
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

  const renderAtStep = (step: string) => {
    mocks.search = `step=${step}`
    return render(<SocialContentDetailRoute />)
  }

  it('keeps approved copy locked while exposing visual production actions', async () => {
    const view = renderAtStep('copy')

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
    expect(screen.getAllByText('Supporting context: Pending').length).toBeGreaterThan(0)
    expect(screen.queryByText('Request copy revision')).not.toBeInTheDocument()
    expect(screen.queryByText(/Mark this draft rejected/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Triggering event or recent proof')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Revision feedback for Shaka')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reopen for Revision/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject and Generate Revision/i })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Reopen for Revision/i }))
    expect(screen.getByLabelText('Triggering event or recent proof')).not.toBeDisabled()
    expect(screen.getByLabelText('Revision feedback for Shaka')).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Add Feedback to Continue/i })).toBeDisabled()
    expect(screen.getByDisplayValue('The draft copy is approved and should stay locked.')).toBeDisabled()
    expect(screen.getByText('AmaduTown')).toBeInTheDocument()
    expect(screen.queryByText('Amadou Town')).not.toBeInTheDocument()
    const copyGate = screen.getByText('Post Text').closest('#social-copy-gate')
    expect(copyGate).toBeTruthy()
    expect(within(copyGate as HTMLElement).getByText('CTA Text')).toBeInTheDocument()
    expect(within(copyGate as HTMLElement).getByText('CTA URL')).toBeInTheDocument()
    expect(within(copyGate as HTMLElement).getByText('Hashtags (comma-separated)')).toBeInTheDocument()

    mocks.search = 'step=visuals'
    view.rerender(<SocialContentDetailRoute />)

    expect(await screen.findByText('Visual Production')).toBeInTheDocument()
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
    expect(screen.getAllByText('Visual assets: Pending').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Asset packet: Pending').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Privacy: Pending').length).toBeGreaterThan(1)
    expect(screen.queryByPlaceholderText('What must change before the visual assets are approved?')).not.toBeInTheDocument()

    mocks.search = 'step=draft'
    view.rerender(<SocialContentDetailRoute />)

    expect(screen.getByText('LinkedIn Draft Handoff')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve LinkedIn Draft Handoff/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reject LinkedIn Draft Handoff/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Create LinkedIn Draft/i })).toBeDisabled()
    expect(screen.getAllByText('LinkedIn draft: Pending').length).toBeGreaterThan(1)
    expect(screen.queryByText('Publish immediately after approval')).not.toBeInTheDocument()
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

    renderAtStep('copy')

    expect(await screen.findByText('Approval gates create trust')).toBeInTheDocument()
    expect(screen.getByText(/Why you can speak on it:/)).toBeInTheDocument()
    expect(screen.getByText(/Hook: AI should reduce burden/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Use topic/i }))

    expect(screen.getByRole('button', { name: /Reject and Generate Revision/i })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Reject and Generate Revision/i }))
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

  it('shows a campaign copy queue and advances after draft-only approval', async () => {
    const calendarItem = {
      ...baseItem,
      status: 'draft',
      reviewed_by: null,
      post_text: 'A stronger first Agentified draft.',
      cta_text: 'Read Agentified.',
      rag_context: {
        source: 'social_content_calendar_authorization',
        source_type: 'social_content_calendar_item',
        calendar_item_id: 'calendar-1',
        campaign_id: 'campaign-1',
        campaign_name: 'Agentified launch',
        planned_angle: 'Trust turns agent speed into capacity',
        publish_gate: 'draft_only',
        external_execution_enabled: false,
      },
    }
    const secondDraft = {
      ...calendarItem,
      id: 'social-2',
      post_text: 'The second Agentified draft.',
      rag_context: {
        ...calendarItem.rag_context,
        calendar_item_id: 'calendar-2',
        planned_angle: 'Memory is only useful when teams trust it',
      },
      created_at: '2026-06-12T11:00:00.000Z',
    }
    const approvedDraft = {
      ...calendarItem,
      id: 'social-3',
      status: 'approved',
      post_text: 'An approved Agentified draft.',
      rag_context: {
        ...calendarItem.rag_context,
        calendar_item_id: 'calendar-3',
        planned_angle: 'Approvals make AI operational',
      },
      created_at: '2026-06-12T12:00:00.000Z',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/admin/social-content?status=all')) {
        return {
          ok: true,
          json: async () => ({ items: [approvedDraft, secondDraft, calendarItem] }),
        } as Response
      }
      if (url.endsWith('/approve')) {
        return {
          ok: true,
          json: async () => ({
            item: { ...calendarItem, status: 'approved' },
            publish_triggered: false,
            publishes: [],
            reference_work_item: { id: 'work-references-1' },
          }),
        } as Response
      }
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return {
          ok: true,
          json: async () => ({ item: { ...calendarItem, ...body } }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: calendarItem }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAtStep('copy')

    expect(await screen.findByText('Campaign Copy Review')).toBeInTheDocument()
    const reviewHeader = screen.getByText('Campaign Copy Review').closest('section')
    expect(reviewHeader).not.toBeNull()
    expect(within(reviewHeader as HTMLElement).getByText('Draft 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('Trust turns agent speed into capacity')).toBeInTheDocument()
    expect(screen.getByText('Agentified launch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Previous/i })).toBeDisabled()
    expect(within(reviewHeader as HTMLElement).queryByRole('button', { name: /Approve Draft/i })).not.toBeInTheDocument()
    expect(within(reviewHeader as HTMLElement).queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument()

    const preview = screen.getByLabelText('LinkedIn post preview')
    expect(preview.className).toContain('bg-gray-950/85')
    expect(preview.className).toContain('text-gray-100')

    const decisionGate = screen.getByText('Copy Review Decision').closest('section')
    expect(decisionGate).not.toBeNull()
    expect(within(decisionGate as HTMLElement).getByRole('button', { name: /Approve Draft & Next/i })).not.toBeDisabled()
    expect(within(decisionGate as HTMLElement).getByRole('button', { name: /Reject with Feedback/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Approve Draft & Next/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/social-content/social-1/approve'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith('/admin/social-content/social-2?step=copy')
    })
  })

  it('writes out campaign acronyms before approval and captures reject feedback for iteration', async () => {
    const calendarItem = {
      ...baseItem,
      status: 'draft',
      reviewed_by: null,
      post_text: 'S.A.M. moves the work. AMINA governs the work.',
      cta_text: 'Read Agentified.',
      rag_context: {
        source: 'social_content_calendar_authorization',
        source_type: 'social_content_calendar_item',
        calendar_item_id: 'calendar-1',
        campaign_id: 'campaign-1',
        campaign_name: 'Agentified launch',
        planned_angle: 'From SAM to AMINA',
        publish_gate: 'draft_only',
        external_execution_enabled: false,
      },
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/admin/social-content?status=all')) {
        return {
          ok: true,
          json: async () => ({ items: [calendarItem] }),
        } as Response
      }
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return {
          ok: true,
          json: async () => ({ item: { ...calendarItem, ...body } }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: calendarItem }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAtStep('copy')

    expect(await screen.findByText('Copy readiness')).toBeInTheDocument()
    expect(screen.getByText('Signals, Alignment, Momentum (SAM) · Accelerated product discipline')).toBeInTheDocument()
    expect(screen.getByText('Align, Map, Instrument, Negotiate, and Audit (AMINA) · Agentified trust loop')).toBeInTheDocument()
    expect(screen.getAllByText('Needs expansion').length).toBe(2)
    expect(screen.getByRole('button', { name: /Approve Draft/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Write out known acronyms/i }))

    expect(screen.getByDisplayValue('Signals, Alignment, Momentum (SAM) moves the work. Align, Map, Instrument, Negotiate, and Audit (AMINA) governs the work.')).toBeInTheDocument()
    expect(screen.queryByText('Copy readiness')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve Draft/i })).not.toBeDisabled()

    expect(screen.queryByLabelText('Revision feedback for Shaka')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reject with Feedback/i }))
    expect(screen.getByRole('button', { name: /Cancel feedback/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancel feedback/i }))
    expect(screen.queryByLabelText('Revision feedback for Shaka')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reject with Feedback/i }))
    fireEvent.change(screen.getByLabelText('Revision feedback for Shaka'), {
      target: { value: 'The framework reference is clear now, but the opening still needs a more concrete scene.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Reject with Feedback/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/social-content/social-1'),
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    const rejectCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    const body = JSON.parse(String(rejectCall?.[1]?.body))
    expect(body.status).toBe('rejected')
    expect(body.rag_context.content_calibration.status).toBe('revision_requested')
    expect(body.rag_context.content_calibration.operator_feedback.revision_request).toContain('concrete scene')
    expect(body.rag_context.content_calibration.revision_requests[0]).toMatchObject({
      previous_status: 'draft',
      action: 'reject_with_feedback',
    })
    expect(body.admin_notes).toContain('Copy revision requested')
  })

  it('lets the operator add a reusable calibration reference to the feedback packet', async () => {
    const draftItem = {
      ...baseItem,
      status: 'draft',
      reviewed_by: null,
    }
    const calibrationReference = {
      id: 'linkedin-builder-insight-production-readiness',
      platform: 'linkedin',
      label: 'Builder insight: production readiness',
      source_type: 'voice_guide_reference',
      content_pillar: 'AI and product management',
      post_excerpt: 'Anyone can build an app right now.\n\nThat speed does not give you production readiness.',
      engagement_signal: 'Approved voice-guide reference. Measured LinkedIn engagement has not been imported yet.',
      why_it_worked: 'It starts with a concrete builder reality, names the tools, then moves into operational risk.',
      claim_boundaries: ['Do not overstate production readiness.'],
      provenance: 'docs/linkedin-voice.md',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/calibration-library')) {
        return {
          ok: true,
          json: async () => ({
            references: [calibrationReference],
            source: 'approved_calibration_library',
            side_effects: {
              provider_generation: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        } as Response
      }
      if (url.includes('/topic-backlog')) {
        return {
          ok: true,
          json: async () => ({ items: [topicBacklogItem] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: draftItem }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAtStep('context')

    fireEvent.click(await screen.findByText('Content calibration'))
    expect(await screen.findByText('Reusable calibration library')).toBeInTheDocument()
    const referenceCard = screen.getByText('Builder insight: production readiness').closest('.rounded-lg')
    expect(referenceCard).toBeTruthy()
    fireEvent.click(within(referenceCard as HTMLElement).getByRole('button', { name: 'Add fields' }))

    expect(screen.getByDisplayValue('Builder insight: production readiness (docs/linkedin-voice.md)')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Anyone can build an app right now/)).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Approved voice-guide reference/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Do not overstate production readiness.')).toBeInTheDocument()
    expect(within(referenceCard as HTMLElement).getByRole('button', { name: 'Added fields' })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/social-content/calibration-library?platform=linkedin'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer admin-token' },
      }),
    )
  })

  it('lets the operator select a gold reference for Shaka comparison before revision', async () => {
    const draftItem = {
      ...baseItem,
      status: 'draft',
      reviewed_by: null,
      post_text: 'This draft starts too generic and needs a stronger point of view.',
    }
    const goldReference = {
      id: 'portfolio-social-gold-1',
      platform: 'linkedin',
      label: 'Gold standard · Founder operating lesson',
      source_type: 'portfolio_content_history',
      curation_status: 'gold_standard',
      content_pillar: 'AI and product management',
      post_excerpt: 'I learned the hard way that software only matters when it lowers the load.',
      engagement_signal: 'Operator marked as a reusable gold-standard post. Strong comments from builders.',
      why_it_worked: 'It opened from lived operational pressure before naming the framework.',
      claim_boundaries: ['Keep the story source-safe.'],
      provenance: 'Portfolio Social Content history',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/calibration-library')) {
        return {
          ok: true,
          json: async () => ({
            references: [goldReference],
            source: 'approved_calibration_library',
            side_effects: {
              provider_generation: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        } as Response
      }
      if (url.includes('/topic-backlog')) {
        return {
          ok: true,
          json: async () => ({ items: [topicBacklogItem] }),
        } as Response
      }
      if (url.includes('/calibration-revision')) {
        return {
          ok: true,
          json: async () => ({
            item: {
              ...draftItem,
              post_text: 'Revised draft shaped by the selected benchmark.',
              rag_context: {
                ...draftItem.rag_context,
                content_calibration: {
                  status: 'revision_generated',
                },
              },
            },
          }),
        } as Response
      }
      if (init?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ item: draftItem }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ item: draftItem }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    renderAtStep('context')

    fireEvent.click(await screen.findByText('Content calibration'))
    const referenceCard = await screen.findByText('Gold standard · Founder operating lesson')
    fireEvent.click(within(referenceCard.closest('.rounded-lg') as HTMLElement).getByRole('button', { name: 'Compare' }))

    expect(await screen.findByText('Side-by-side comparison packet')).toBeInTheDocument()
    expect(screen.getByText(/including 1 gold-standard reference/)).toBeInTheDocument()
    expect(screen.getAllByText(/This draft starts too generic/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Revise with feedback/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/social-content/social-1/calibration-revision'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
    const revisionCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/calibration-revision'))
    const revisionBody = JSON.parse(String(revisionCall?.[1]?.body))
    expect(revisionBody.operator_feedback.comparison_reference_ids).toEqual(['portfolio-social-gold-1'])
    expect(revisionBody.operator_feedback.comparison_brief).toContain('Gold standard · Founder operating lesson')
    expect(revisionBody.operator_feedback.success_examples[0]).toMatchObject({
      reference_id: 'portfolio-social-gold-1',
      curation_status: 'gold_standard',
    })
  })

  it('lets the operator mark an approved post as a gold-standard calibration reference', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/calibration-library')) {
        return {
          ok: true,
          json: async () => ({
            references: [],
            source: 'approved_calibration_library',
            side_effects: {
              provider_generation: false,
              publish: false,
              schedule: false,
              external_post: false,
            },
          }),
        } as Response
      }
      if (url.includes('/topic-backlog')) {
        return {
          ok: true,
          json: async () => ({ items: [topicBacklogItem] }),
        } as Response
      }
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return {
          ok: true,
          json: async () => ({
            item: {
              ...baseItem,
              rag_context: body.rag_context,
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

    renderAtStep('context')

    fireEvent.click(await screen.findByText('Content calibration'))
    const markButton = await screen.findByRole('button', { name: /Mark gold standard/i })
    fireEvent.click(markButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Gold standard/i })).toBeDisabled()
    })
    const putCall = fetchMock.mock.calls.find(([url, init]) => (
      String(url).includes('/api/admin/social-content/social-1') && init?.method === 'PUT'
    ))
    expect(putCall).toBeTruthy()
    const putBody = JSON.parse(String(putCall?.[1]?.body))
    expect(putBody.rag_context.content_calibration.reference_curation).toMatchObject({
      gold_standard: true,
      reason: 'Operator marked this approved Social Content item as a reusable calibration reference.',
    })
    expect(putBody.rag_context.content_calibration.reference_curation.marked_at).toBeTruthy()
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

    renderAtStep('visuals')

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

    renderAtStep('visuals')

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

    renderAtStep('visuals')

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

    renderAtStep('visuals')

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

    renderAtStep('copy')

    expect(await screen.findByText('Post Text')).toBeInTheDocument()
    expect(screen.queryByText('Request copy revision')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Triggering event or recent proof')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reject and Generate Revision/i }))
    const triggeringEventInput = screen.getByLabelText('Triggering event or recent proof')
    expect(triggeringEventInput).toBeTruthy()
    fireEvent.change(triggeringEventInput as HTMLTextAreaElement, {
      target: { value: triggeringEvent },
    })
    fireEvent.change(screen.getByLabelText('Revision feedback for Shaka'), {
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
