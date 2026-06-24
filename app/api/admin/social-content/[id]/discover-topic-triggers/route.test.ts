import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  generateJsonCompletion: vi.fn(),
  createAgentWorkItem: vi.fn(),
  from: vi.fn(),
  currentSingle: vi.fn(),
  updateSingle: vi.fn(),
  recentSocialLimit: vi.fn(),
  meetingsLimit: vi.fn(),
  projectsLimit: vi.fn(),
  runsLimit: vi.fn(),
  update: vi.fn(),
  backlogUpsert: vi.fn(),
  backlogSelect: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/llm-dispatch', () => ({
  generateJsonCompletion: mocks.generateJsonCompletion,
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: unknown = {}) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/discover-topic-triggers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const agentOpsRagContext = {
  source: 'agent_ops_social_outreach_goal',
  goal_id: 'goal-1',
  content_packet_id: 'packet-1',
  open_brain_references: ['memory-1'],
  chronicle_packet_status: 'manual_packet_summarized',
  content_calibration: {
    status: 'ready_for_draft_review',
  },
}

function agentWorkItemFromInput(input: Record<string, unknown>) {
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
    ? input.metadata as Record<string, unknown>
    : {}
  const source = input.source && typeof input.source === 'object' && !Array.isArray(input.source)
    ? input.source as Record<string, unknown>
    : {}
  return {
    id: 'work-topic-1',
    title: String(input.title ?? 'Approval gates create trust'),
    objective: String(input.objective ?? 'AI needs accountable operating gates.'),
    status: String(input.status ?? 'proposed'),
    priority: String(input.priority ?? 'high'),
    owner_agent_key: String(input.ownerAgentKey ?? 'chief-of-staff'),
    owner_runtime: String(input.ownerRuntime ?? 'codex'),
    source_type: typeof source.type === 'string' ? source.type : null,
    source_id: typeof source.id === 'string' ? source.id : null,
    source_label: typeof source.label === 'string' ? source.label : null,
    source_run_id: null,
    active_run_id: null,
    parent_work_item_id: null,
    branch_name: null,
    worktree_path: null,
    pr_number: null,
    pr_url: null,
    expected_files: [],
    touched_files: [],
    overlap_group: typeof input.overlapGroup === 'string' ? input.overlapGroup : null,
    dependency_ids: [],
    blocker_summary: null,
    validation_summary: null,
    approval_id: null,
    metadata,
    idempotency_key: typeof input.idempotencyKey === 'string' ? input.idempotencyKey : null,
    created_at: '2026-06-24T10:00:00.000Z',
    updated_at: '2026-06-24T10:00:00.000Z',
    completed_at: null,
  }
}

function socialContentTable() {
  return {
    select: vi.fn((columns: string) => {
      if (columns.includes('cta_text')) {
        return {
          eq: vi.fn(() => ({
            single: mocks.currentSingle,
          })),
        }
      }
      return {
        in: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: mocks.recentSocialLimit,
          })),
        })),
      }
    }),
    update: mocks.update,
  }
}

function limitTable(limitMock: ReturnType<typeof vi.fn>) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: limitMock,
      })),
    })),
  }
}

function socialTopicBacklogTable() {
  return {
    upsert: mocks.backlogUpsert,
  }
}

describe('POST /api/admin/social-content/[id]/discover-topic-triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.currentSingle.mockResolvedValue({
      data: {
        id: 'social-1',
        status: 'approved',
        post_text: 'Current draft about Agent Ops.',
        cta_text: 'Where is AI adding work?',
        hashtags: ['#AIProduct'],
        image_prompt: null,
        topic_extracted: { topic: 'Agent Ops approval gates' },
        hormozi_framework: { framework_type: 'proof_stacking' },
        rag_context: agentOpsRagContext,
      },
      error: null,
    })
    mocks.meetingsLimit.mockResolvedValue({
      data: [
        {
          id: 'meeting-1',
          meeting_type: 'Product review',
          meeting_date: '2026-06-18',
          created_at: '2026-06-18T10:00:00.000Z',
          raw_notes: null,
          structured_notes: {
            title: 'Agent Ops review',
            summary: 'The review exposed that approval gates need clearer ownership. Contact vambah@example.com for details.',
          },
        },
      ],
      error: null,
    })
    mocks.projectsLimit.mockResolvedValue({
      data: [
        {
          id: 'project-1',
          project_name: 'Client-safe automation readiness build',
          product_purchased: 'AI Ops sprint',
          project_status: 'active',
          current_phase: 'Evidence review',
          created_at: '2026-06-15T10:00:00.000Z',
          updated_at: '2026-06-19T10:00:00.000Z',
        },
      ],
      error: null,
    })
    mocks.runsLimit.mockResolvedValue({
      data: [
        {
          id: 'run-1',
          agent_key: 'chief-of-staff',
          kind: 'social_content_generation',
          title: 'Generate social content draft',
          status: 'completed',
          current_step: 'Draft returned for review',
          subject_label: 'Agent Ops LinkedIn pilot',
          metadata: { operation: 'social_content_calibration_revision' },
          created_at: '2026-06-20T10:00:00.000Z',
        },
      ],
      error: null,
    })
    mocks.recentSocialLimit.mockResolvedValue({
      data: [
        {
          id: 'social-2',
          status: 'published',
          topic_extracted: {
            topic: 'AI should reduce burden',
            angle: 'Governance makes automation accountable',
            personal_tie_in: 'Built in Portfolio Agent Ops.',
          },
          post_text: 'AI should reduce burden.',
          rag_context: { open_brain_references: ['memory-2'] },
          created_at: '2026-06-17T10:00:00.000Z',
        },
      ],
      error: null,
    })
    mocks.generateJsonCompletion.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o-mini',
      content: JSON.stringify({
        candidates: [
          {
            id: 'approval-gates-review',
            title: 'Approval gates create trust',
            triggering_event: 'A recent Agent Ops review exposed where AI-generated work needed clearer ownership before publishing.',
            source_type: 'meeting',
            source_label: 'Agent Ops review',
            source_ids: ['meeting:meeting-1'],
            why_vambah_can_speak: 'Vambah is building the Portfolio Agent Ops workflow and personally reviewed the approval path.',
            brand_goal: 'Show AmaduTown builds governed AI systems, not loose demos.',
            content_angle: 'AI needs accountable operating gates.',
            suggested_hook: 'AI should reduce burden. That only happens when every risky action has a gate.',
            audience: 'Product leaders and operators adopting AI',
            sensitivity: 'needs_review',
            evidence_summary: 'Sanitized meeting summary about approval gate ownership.',
            claim_boundaries: ['Do not name private meeting participants.'],
          },
        ],
        notes: ['Review-only candidates.'],
      }),
    })
    mocks.createAgentWorkItem.mockImplementation(async (input: Record<string, unknown>) => (
      agentWorkItemFromInput(input)
    ))
    mocks.updateSingle.mockResolvedValue({
      data: {
        id: 'social-1',
        rag_context: {
          ...agentOpsRagContext,
          content_calibration: {
            status: 'topic_triggers_ready',
          },
        },
      },
      error: null,
    })
    mocks.update.mockReturnValue({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: mocks.updateSingle,
        })),
      })),
    })
    mocks.backlogSelect.mockResolvedValue({
      data: [
        {
          id: 'topic-1',
          candidate_key: 'approval-gates-review-meeting-meeting-1',
          title: 'Approval gates create trust',
        },
      ],
      error: null,
    })
    mocks.backlogUpsert.mockReturnValue({
      select: mocks.backlogSelect,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') return socialContentTable()
      if (table === 'social_topic_backlog') return socialTopicBacklogTable()
      if (table === 'meeting_records') return limitTable(mocks.meetingsLimit)
      if (table === 'client_projects') return limitTable(mocks.projectsLimit)
      if (table === 'agent_runs') return limitTable(mocks.runsLimit)
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('requires admin auth before reading source signals', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.generateJsonCompletion).not.toHaveBeenCalled()
  })

  it('discovers sanitized topic triggers and saves a review-only packet', async () => {
    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.topic_trigger_packet).toMatchObject({
      version: 'social_topic_trigger_discovery_v1',
      status: 'review_ready',
      source_policy: 'sanitized_summaries_only',
      privacy_boundary: expect.stringContaining('Review-only topic scouting'),
      candidates: [
        expect.objectContaining({
          id: 'approval-gates-review',
          title: 'Approval gates create trust',
          source_ids: ['meeting:meeting-1'],
          sensitivity: 'needs_review',
        }),
      ],
    })
    expect(mocks.generateJsonCompletion).toHaveBeenCalledWith(expect.objectContaining({
      costContext: expect.objectContaining({
        metadata: expect.objectContaining({
          operation: 'social_content_topic_trigger_discovery',
        }),
      }),
      userPrompt: expect.not.stringContaining('vambah@example.com'),
    }))
    expect(mocks.update).toHaveBeenCalledWith({
      rag_context: expect.objectContaining({
        content_calibration: expect.objectContaining({
          status: 'topic_triggers_ready',
          topic_trigger_packet: expect.objectContaining({
            candidates: expect.any(Array),
          }),
        }),
      }),
    })
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Approval gates create trust',
      status: 'proposed',
      ownerAgentKey: 'chief-of-staff',
      source: expect.objectContaining({
        type: 'social_topic_trigger',
      }),
      idempotencyKey: expect.stringContaining('social-topic-trigger:approval-gates-review'),
    }))
    expect(mocks.backlogUpsert).toHaveBeenCalledWith([
      expect.objectContaining({
        agent_work_item_id: 'work-topic-1',
        candidate_key: expect.stringContaining('approval-gates-review'),
        title: 'Approval gates create trust',
        status: 'available',
        source_policy: 'sanitized_summaries_only',
      }),
    ], { onConflict: 'candidate_key' })
    expect(body.backlog_items).toHaveLength(1)
  })

  it('still saves the draft-local topic packet when the backlog projection table is unavailable', async () => {
    mocks.backlogSelect.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Could not find the table 'public.social_topic_backlog' in the schema cache",
      },
    })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.topic_trigger_packet).toMatchObject({
      version: 'social_topic_trigger_discovery_v1',
      status: 'review_ready',
    })
    expect(body.backlog_items).toEqual([
      expect.objectContaining({
        id: 'work-topic-1',
        agent_work_item_id: 'work-topic-1',
        candidate_key: expect.stringContaining('approval-gates-review'),
        title: 'Approval gates create trust',
        status: 'available',
      }),
    ])
    expect(body.backlog_warning).toBeNull()
    expect(mocks.update).toHaveBeenCalledWith({
      rag_context: expect.objectContaining({
        content_calibration: expect.objectContaining({
          status: 'topic_triggers_ready',
          topic_trigger_packet: expect.any(Object),
        }),
      }),
    })
  })

  it('rejects non-Agent-Ops social drafts', async () => {
    mocks.currentSingle.mockResolvedValueOnce({
      data: {
        id: 'social-1',
        status: 'draft',
        post_text: 'Draft',
        cta_text: null,
        hashtags: [],
        image_prompt: null,
        topic_extracted: {},
        hormozi_framework: {},
        rag_context: { source: 'manual_social_post' },
      },
      error: null,
    })

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Topic discovery is only available for Agent Ops social pilot drafts',
    })
    expect(mocks.generateJsonCompletion).not.toHaveBeenCalled()
  })
})
