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
      if (url === '/api/admin/agents/work-items/work-social-1/research-packets') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            linked_packet_ids: ['packet-1'],
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
      if (url === '/api/admin/social-content/intelligence/daily-digest/activation-request') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            work_item: {
              id: 'work-digest-activation',
              title: 'Approve daily Social Content Intelligence digest activation',
            },
            activation_requested: true,
            activation_executed: false,
            side_effects: {
              cron_activated: false,
              apify_run: false,
              provider_generation: false,
              upload: false,
              schedule: false,
              publish: false,
              external_post: false,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/calendar/calendar-1/authorize') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: { id: 'calendar-1', authorization_status: 'authorized', social_content_id: 'social-1' },
            handoff: {
              kind: 'linkedin_social_content_draft',
              work_item_id: 'work-handoff-1',
              social_content_id: 'social-1',
            },
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
              internal_draft_handoff_created: true,
              social_content_draft_created: true,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/calendar/calendar-1/reject') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: { id: 'calendar-1', authorization_status: 'rejected' },
            revision_work_item_id: 'work-revision-1',
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
              revision_work_item_created: true,
            },
          }),
        }
      }
      if (url === '/api/admin/social-content/calendar') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: { id: 'calendar-new', title: 'Manual calendar item' },
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
            },
          }),
        }
      }
      if (url.startsWith('/api/admin/social-content/calendar')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'calendar-1',
                campaign_id: 'campaign-1',
                agent_work_item_id: 'work-social-1',
                social_content_id: null,
                channel: 'linkedin',
                campaign_phase: 'tease',
                title: 'Tease: Approval gates',
                planned_angle: 'Open with the moment an approval path created extra work.',
                scheduled_for: '2026-06-24T14:00:00.000Z',
                due_status: 'planned',
                authorization_status: 'pending',
                authorization_due_at: '2026-06-23T14:00:00.000Z',
                autonomy_eligible: false,
                attraction_campaigns: { id: 'campaign-1', name: 'Agent Ops Campaign', slug: 'agent-ops' },
                agent_work_items: { id: 'work-social-1', title: 'Approval gates create trust', status: 'proposed' },
                social_content_queue: null,
              },
            ],
          }),
        }
      }
      if (url.startsWith('/api/admin/campaigns')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'campaign-1',
                name: 'Agent Ops Campaign',
                status: 'draft',
                starts_at: '2026-06-24T00:00:00.000Z',
                ends_at: '2026-07-01T00:00:00.000Z',
              },
            ],
          }),
        }
      }
      if (url.startsWith('/api/admin/social-content/intelligence/daily-digest')) {
        return {
          ok: true,
          json: async () => ({
            digest: {
              generated_at: '2026-06-23T12:00:00.000Z',
              lookback_days: 5,
              summary: {
                new_research_packets: 1,
                usable_patterns: 1,
                shaka_insights: 1,
                blocked_or_sensitive_items: 1,
              },
              strongest_patterns: [
                {
                  packet_id: 'packet-1',
                  title: 'Outlier research process',
                  source_url: 'https://youtube.com/watch?v=abc',
                  platform: 'youtube',
                  creator: 'Creator',
                  outlier_score: 87,
                  pattern_status: 'needs_brand_translation',
                  hook_structure: 'The first 30 seconds make the promise clear.',
                  promise_value: 'Clear public research process',
                  thumbnail_pattern: 'High contrast proof frame.',
                },
              ],
              recommended_insights: [
                {
                  work_item_id: 'work-social-1',
                  title: 'Approval gates create trust',
                  status: 'proposed',
                  priority: 'high',
                  triggering_event: 'A shipped review gate changed the work.',
                  why_vambah_can_speak: 'Vambah built the system.',
                  sensitivity: 'needs_review',
                },
              ],
              suggested_channel_lanes: [
                {
                  work_item_id: 'work-social-1',
                  insight_title: 'Approval gates create trust',
                  channel: 'youtube_shorts',
                  label: 'YouTube Shorts',
                  status: 'not_started',
                  required_inputs: ['hook', 'script'],
                },
              ],
              thumbnail_opportunities: [
                {
                  packet_id: 'packet-1',
                  title: 'Outlier research process',
                  thumbnail_pattern: 'High contrast proof frame.',
                },
              ],
              blocked_or_sensitive_items: [
                {
                  type: 'shaka_insight',
                  id: 'work-social-1',
                  title: 'Approval gates create trust',
                  reason: 'needs_review',
                },
              ],
              governance: {
                schedule_activation: 'approval_required',
                apify_collection: 'approval_required',
                publishing: 'approval_required',
              },
              side_effects: {
                provider_generation: false,
                upload: false,
                publish: false,
                schedule: false,
                external_post: false,
                apify_run: false,
              },
            },
          }),
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
    expect(screen.getByRole('heading', { name: 'What Shaka should review next' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Campaign arc and due gates' })).toBeInTheDocument()
    expect(screen.getByText('Tease: Approval gates')).toBeInTheDocument()
    expect(screen.getAllByText('Agent Ops Campaign').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Plan calendar item' })).toBeInTheDocument()
    expect(screen.getByText('Schedule: approval required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request Daily Activation Review' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Strongest patterns' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Channel lanes' })).toBeInTheDocument()
    expect(screen.getByText('YouTube Shorts: Approval gates create trust')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add recorded public evidence' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Link pattern to Shaka insight' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Outlier research process' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Approval gates create trust/ }).map((link) => link.getAttribute('href'))).toContain('/admin/agents/social-insights/work-social-1')
  })

  it('stores recorded evidence without paid scraper fields', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Research and Shaka insight queue' })

    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://youtube.com/watch?v=recorded' } })
    fireEvent.change(screen.getAllByLabelText('Title')[1], { target: { value: 'Recorded hook pattern' } })
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

  it('links a research pattern to a central Shaka insight without production side effects', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Link pattern to Shaka insight' })

    fireEvent.change(screen.getByLabelText('Decision note'), {
      target: { value: 'Use the structure, not the source wording.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Link Pattern' }))

    await screen.findByText('Research pattern linked to Shaka insight.')

    const linkCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/agents/work-items/work-social-1/research-packets')
    expect(linkCall).toBeTruthy()
    expect(linkCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(linkCall?.[1]?.body))).toEqual({
      packet_ids: ['packet-1'],
      decision_note: 'Use the structure, not the source wording.',
    })
  })

  it('requests daily digest activation review without enabling the schedule', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'What Shaka should review next' })

    fireEvent.change(screen.getByLabelText('Activation review note'), {
      target: { value: 'Start with free public research and Shaka internal triggers.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request Daily Activation Review' }))

    await screen.findByText('Daily activation review added to Agentic Dashboard backlog.')

    const activationCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input) === '/api/admin/social-content/intelligence/daily-digest/activation-request')
    expect(activationCall).toBeTruthy()
    expect(activationCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(activationCall?.[1]?.body))).toEqual({
      cadence: 'daily',
      lookback_days: 5,
      scope_note: 'Start with free public research and Shaka internal triggers.',
    })
  })

  it('creates a pending calendar item without publishing side effects', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByRole('heading', { name: 'Plan calendar item' })

    fireEvent.change(screen.getAllByLabelText('Title')[0], {
      target: { value: 'Teach: Campaign operating lesson' },
    })
    fireEvent.change(screen.getByLabelText('Scheduled for'), {
      target: { value: '2026-06-25T10:00' },
    })
    fireEvent.change(screen.getAllByLabelText('Campaign')[1], {
      target: { value: 'campaign-1' },
    })
    fireEvent.change(screen.getByLabelText('Planned angle'), {
      target: { value: 'Teach the operating framework behind the campaign.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Plan Item' }))

    await screen.findByText('Calendar item planned. Human authorization remains pending.')

    const calendarCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
      String(input) === '/api/admin/social-content/calendar' && init?.method === 'POST'
    ))
    expect(calendarCall).toBeTruthy()
    expect(JSON.parse(String(calendarCall?.[1]?.body))).toMatchObject({
      title: 'Teach: Campaign operating lesson',
      campaign_id: 'campaign-1',
      channel: 'linkedin',
      campaign_phase: 'tease',
      planned_angle: 'Teach the operating framework behind the campaign.',
    })
  })

  it('authorizes a calendar item as an internal draft handoff', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByText('Tease: Approval gates')

    fireEvent.click(screen.getByRole('button', { name: 'Authorize Draft Handoff' }))

    await screen.findByText('Draft handoff authorized and Social Content draft created.')

    const authorizeCall = vi.mocked(fetch).mock.calls.find(([input]) => (
      String(input) === '/api/admin/social-content/calendar/calendar-1/authorize'
    ))
    expect(authorizeCall).toBeTruthy()
    expect(authorizeCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(authorizeCall?.[1]?.body))).toEqual({})
  })

  it('requires a decision note before rejecting a calendar item', async () => {
    render(<ContentIntelligencePage />)

    await screen.findByText('Tease: Approval gates')

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    fireEvent.change(screen.getAllByLabelText('Decision note')[0], {
      target: { value: 'Needs stronger proof before this is due.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rejection' }))

    await screen.findByText('Calendar item rejected and returned to Shaka for revision.')

    const rejectCall = vi.mocked(fetch).mock.calls.find(([input]) => (
      String(input) === '/api/admin/social-content/calendar/calendar-1/reject'
    ))
    expect(rejectCall).toBeTruthy()
    expect(rejectCall?.[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(rejectCall?.[1]?.body))).toEqual({
      decision_note: 'Needs stronger proof before this is due.',
    })
  })
})
