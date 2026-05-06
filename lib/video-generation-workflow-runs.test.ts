import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentStep: vi.fn(),
  attachAgentArtifact: vi.fn(),
  endAgentRun: vi.fn(),
  markAgentRunFailed: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentStep: mocks.recordAgentStep,
  attachAgentArtifact: mocks.attachAgentArtifact,
  endAgentRun: mocks.endAgentRun,
  markAgentRunFailed: mocks.markAgentRunFailed,
}))

import { completeVideoGenRun, startVideoGenRun } from './video-generation-workflow-runs'

function makeBuilder(result: {
  single?: { data: unknown; error: { message?: string } | null }
  maybeSingle?: { data: unknown; error: { message?: string } | null }
}) {
  return {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result.single ?? { data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue(result.maybeSingle ?? { data: null, error: null }),
  }
}

describe('video generation workflow runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.startAgentRun.mockResolvedValue({ id: 'agent-run-1' })
    mocks.recordAgentStep.mockResolvedValue({ id: 'step-1' })
    mocks.attachAgentArtifact.mockResolvedValue({ id: 'artifact-1' })
    mocks.endAgentRun.mockResolvedValue(undefined)
    mocks.markAgentRunFailed.mockResolvedValue(undefined)
  })

  it('creates a shared Agent Ops run when starting a video workflow run', async () => {
    const builder = makeBuilder({ single: { data: { id: 'video-run-1' }, error: null } })
    mocks.from.mockReturnValue(builder)

    const run = await startVideoGenRun('vgen_heygen')

    expect(run).toEqual({ id: 'video-run-1', agentRunId: 'agent-run-1' })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'content-repurposing',
      runtime: 'manual',
      kind: 'video_generation_workflow_sync',
      subject: expect.objectContaining({
        type: 'video_generation_workflow',
        id: 'vgen_heygen',
      }),
    }))
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      workflow_id: 'vgen_heygen',
      status: 'running',
      summary: 'HeyGen catalog',
      agent_run_id: 'agent-run-1',
    }))
  })

  it('keeps the legacy workflow run working if Agent Ops run creation fails', async () => {
    const builder = makeBuilder({ single: { data: { id: 'video-run-2' }, error: null } })
    mocks.from.mockReturnValue(builder)
    mocks.startAgentRun.mockRejectedValue(new Error('agent trace unavailable'))

    const run = await startVideoGenRun('vgen_drive')

    expect(run).toEqual({ id: 'video-run-2', agentRunId: null })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      workflow_id: 'vgen_drive',
      summary: 'Drive scripts',
      agent_run_id: null,
    }))
  })

  it('completes the shared Agent Ops run when the video workflow succeeds', async () => {
    const builder = makeBuilder({
      maybeSingle: {
        data: {
          id: 'video-run-1',
          workflow_id: 'vgen_heygen',
          agent_run_id: 'agent-run-1',
          summary: 'HeyGen catalog',
        },
        error: null,
      },
    })
    mocks.from.mockReturnValue(builder)

    await completeVideoGenRun('video-run-1', { success: true, itemsInserted: 3 })

    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      items_inserted: 3,
      error_message: null,
    }))
    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      stepKey: 'video_generation_sync_complete',
      status: 'completed',
      outputSummary: '3 item(s) synced',
    }))
    expect(mocks.attachAgentArtifact).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      artifactType: 'video_generation_workflow_run',
      refId: 'video-run-1',
    }))
    expect(mocks.endAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      status: 'completed',
    }))
  })

  it('marks the shared Agent Ops run failed when the video workflow fails', async () => {
    const builder = makeBuilder({
      maybeSingle: {
        data: {
          id: 'video-run-1',
          workflow_id: 'vgen_drive',
          agent_run_id: 'agent-run-1',
          summary: 'Drive scripts',
        },
        error: null,
      },
    })
    mocks.from.mockReturnValue(builder)

    await completeVideoGenRun('video-run-1', {
      success: false,
      itemsInserted: 0,
      errorMessage: 'Drive sync failed',
    })

    expect(mocks.recordAgentStep).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'agent-run-1',
      status: 'failed',
      outputSummary: 'Drive sync failed',
    }))
    expect(mocks.markAgentRunFailed).toHaveBeenCalledWith(
      'agent-run-1',
      'Drive sync failed',
      expect.objectContaining({
        workflow_id: 'vgen_drive',
        legacy_run_id: 'video-run-1',
      }),
    )
    expect(mocks.endAgentRun).not.toHaveBeenCalled()
  })
})
