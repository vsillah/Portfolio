import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildContentPackage: vi.fn(),
  recordAgentStep: vi.fn(),
  startAgentRun: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/content-packages', () => ({
  CONTENT_PACKAGE_APPROVAL_TYPES: {
    script: 'content_package_script_packet',
    media: 'content_package_media_generation',
    publish: 'content_package_publish',
  },
  buildContentPackage: mocks.buildContentPackage,
}))

vi.mock('@/lib/agent-run', () => ({
  recordAgentStep: mocks.recordAgentStep,
  startAgentRun: mocks.startAgentRun,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const intake = {
  id: 'intake-1',
  title: 'Turn field notes into governed content',
  transcript_text: 'Operators need a source-backed way to turn voice notes into approved campaign assets.',
  topic_hint: 'Voice-note content system',
  target_audience: 'operations leaders',
  target_outputs: ['linkedin_post', 'pptx_deck', 'video_script'],
  framework_ids: ['agent-ops-loop'],
  audio_storage_path: 'voice-notes/intake-1.webm',
  audio_file_name: 'field-note.webm',
}

const generatedPackage = {
  title: 'Turn field notes into governed content',
  sourcePacket: { summary: 'Source packet' },
  researchPacket: { proof: ['Agent Ops'] },
  frameworkIds: ['agent-ops-loop'],
  targetOutputs: ['linkedin_post', 'pptx_deck', 'video_script'],
  presentationPlan: { recommendedTool: 'codex_pptx' },
  outputs: [
    {
      outputType: 'linkedin_post',
      title: 'LinkedIn post',
      body: 'A governed LinkedIn draft.',
      payload: {
        cta_text: 'Where should this remove burden?',
        hashtags: ['#AgentOps'],
      },
      downstreamType: 'social_content_queue',
      requiredApproval: 'script',
    },
    {
      outputType: 'pptx_deck',
      title: 'Executive deck',
      body: 'Deck outline',
      payload: { slides: [{ title: 'The operating loop' }] },
      requiredApproval: 'media',
    },
    {
      outputType: 'video_script',
      title: 'Video script',
      body: 'Video narration',
      payload: { storyboard: { scenes: [{ title: 'Scene 1' }] } },
      downstreamType: 'video_ideas_queue',
      requiredApproval: 'media',
    },
  ],
}

interface SupabaseState {
  existingPackage?: Record<string, unknown> | null
  insertCalls: Record<string, unknown[]>
  updateCalls: Record<string, unknown[]>
}

function request(body: unknown = {}) {
  return new NextRequest('http://localhost/api/admin/social-content/voice-notes/intake-1/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupSupabase(state: SupabaseState) {
  state.insertCalls = {}
  state.updateCalls = {}

  mocks.from.mockImplementation((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => {
        if (table === 'social_idea_intakes') {
          return {
            single: vi.fn().mockResolvedValue({ data: intake, error: null }),
          }
        }
        if (table === 'content_packages') {
          return {
            maybeSingle: vi.fn().mockResolvedValue({
              data: state.existingPackage ?? null,
              error: null,
            }),
          }
        }
        return {}
      }),
    })),
    insert: vi.fn((payload: unknown) => {
      state.insertCalls[table] = [...(state.insertCalls[table] ?? []), payload]

      if (table === 'social_content_queue') {
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'social-draft-1' }, error: null }),
          })),
        }
      }
      if (table === 'video_ideas_queue') {
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'video-idea-1' }, error: null }),
          })),
        }
      }
      if (table === 'agent_approvals') {
        return {
          select: vi.fn().mockResolvedValue({
            data: [
              { id: 'approval-script' },
              { id: 'approval-media' },
              { id: 'approval-publish' },
            ],
            error: null,
          }),
        }
      }
      if (table === 'content_packages') {
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'package-1',
                title: generatedPackage.title,
                status: 'waiting_script_approval',
                social_content_id: 'social-draft-1',
                video_idea_id: 'video-idea-1',
                created_at: '2026-06-05T10:00:00.000Z',
              },
              error: null,
            }),
          })),
        }
      }
      return Promise.resolve({ error: null })
    }),
    update: vi.fn((payload: unknown) => {
      state.updateCalls[table] = [...(state.updateCalls[table] ?? []), payload]
      return {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
    }),
  }))
}

describe('POST /api/admin/social-content/voice-notes/[id]/generate', () => {
  let state: SupabaseState

  beforeEach(() => {
    state = { insertCalls: {}, updateCalls: {} }
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.buildContentPackage.mockReturnValue(generatedPackage)
    setupSupabase(state)
  })

  it('returns the existing content package without starting another run or duplicating side effects', async () => {
    state.existingPackage = {
      id: 'package-existing',
      title: 'Existing package',
      status: 'waiting_script_approval',
      social_content_id: 'social-existing',
      video_idea_id: 'video-existing',
      agent_run_id: 'run-existing',
      created_at: '2026-06-05T09:00:00.000Z',
    }

    const response = await POST(request(), { params: { id: 'intake-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      alreadyGenerated: true,
      agentRunId: 'run-existing',
      downstream: {
        socialContentId: 'social-existing',
        videoIdeaId: 'video-existing',
      },
    })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
    expect(mocks.buildContentPackage).not.toHaveBeenCalled()
    expect(state.insertCalls).toEqual({})
    expect(state.updateCalls).toEqual({})
  })

  it('creates approval-gated content package records and downstream drafts by default', async () => {
    const response = await POST(request({ chronicle_notes: ['Use the latest Agent Ops proof packet.'] }), {
      params: { id: 'intake-1' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      agentRunId: 'run-1',
      approvals: ['approval-script', 'approval-media', 'approval-publish'],
      downstream: {
        socialContentId: 'social-draft-1',
        videoIdeaId: 'video-idea-1',
      },
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'voice-note-content-package:intake-1',
      triggeredByUserId: 'admin-1',
    }))
    expect(mocks.buildContentPackage).toHaveBeenCalledWith(expect.objectContaining({
      title: intake.title,
      chronicleNotes: ['Use the latest Agent Ops proof packet.'],
    }))
    expect(state.insertCalls.agent_approvals?.[0]).toHaveLength(3)
    expect(state.insertCalls.content_packages?.[0]).toMatchObject({
      intake_id: 'intake-1',
      agent_run_id: 'run-1',
      status: 'waiting_script_approval',
      approval_ids: ['approval-script', 'approval-media', 'approval-publish'],
      social_content_id: 'social-draft-1',
      video_idea_id: 'video-idea-1',
      metadata: {
        downstream_created: true,
      },
    })
    expect(state.insertCalls.content_package_outputs?.[0]).toEqual([
      expect.objectContaining({
        output_type: 'linkedin_post',
        downstream_type: 'social_content_queue',
        downstream_id: 'social-draft-1',
      }),
      expect.objectContaining({
        output_type: 'pptx_deck',
        downstream_type: null,
        downstream_id: null,
      }),
      expect.objectContaining({
        output_type: 'video_script',
        downstream_type: 'video_ideas_queue',
        downstream_id: 'video-idea-1',
      }),
    ])
    expect(state.updateCalls.social_idea_intakes?.[0]).toMatchObject({ status: 'packet_generated' })
    expect(state.updateCalls.agent_runs?.[0]).toMatchObject({ status: 'waiting_for_approval' })
  })

  it('keeps generated outputs unlinked when downstream draft creation is disabled', async () => {
    const response = await POST(request({ create_downstream_drafts: false }), {
      params: { id: 'intake-1' },
    })

    expect(response.status).toBe(200)
    expect(state.insertCalls.social_content_queue).toBeUndefined()
    expect(state.insertCalls.video_ideas_queue).toBeUndefined()
    expect(state.insertCalls.content_packages?.[0]).toMatchObject({
      social_content_id: null,
      video_idea_id: null,
      metadata: {
        downstream_created: false,
      },
    })
    expect(state.insertCalls.content_package_outputs?.[0]).toEqual([
      expect.objectContaining({ output_type: 'linkedin_post', downstream_id: null }),
      expect.objectContaining({ output_type: 'pptx_deck', downstream_id: null }),
      expect.objectContaining({ output_type: 'video_script', downstream_id: null }),
    ])
  })
})
