import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  maybeSingleQueue: [] as Array<{ data: unknown; error: unknown }>,
  singleQueue: [] as Array<{ data: unknown; error: unknown }>,
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.fromMock,
  },
}))

import {
  attachAgentArtifact,
  endAgentRun,
  markAgentRunFailed,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from './agent-run'

function chain() {
  const api = {
    select: vi.fn(() => api),
    eq: mocks.eqMock.mockImplementation(() => api),
    maybeSingle: vi.fn(() => Promise.resolve(mocks.maybeSingleQueue.shift() ?? { data: null, error: null })),
    single: vi.fn(() => Promise.resolve(mocks.singleQueue.shift() ?? { data: { id: 'new-id' }, error: null })),
    insert: mocks.insertMock.mockImplementation(() => api),
    update: mocks.updateMock.mockImplementation(() => api),
  }
  return api
}

describe('agent-run helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.maybeSingleQueue = []
    mocks.singleQueue = []
    mocks.fromMock.mockImplementation(() => chain())
  })

  it('starts a run and writes a start event', async () => {
    mocks.maybeSingleQueue.push(
      { data: null, error: null },
      { data: { id: 'registry-1' }, error: null },
    )
    mocks.singleQueue.push(
      { data: { id: 'run-1' }, error: null },
      { data: { id: 'event-1' }, error: null },
    )

    const result = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'outreach_generation',
      title: 'Generate outreach draft',
      subject: { type: 'contact_submission', id: 42, label: 'Ada' },
      idempotencyKey: 'idem-1',
    })

    expect(result).toEqual({ id: 'run-1' })
    expect(mocks.fromMock).toHaveBeenCalledWith('agent_runs')
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({
      runtime: 'manual',
      subject_id: '42',
      idempotency_key: 'idem-1',
    }))
    expect(mocks.fromMock).toHaveBeenCalledWith('agent_run_events')
  })

  it('returns an existing run for an idempotency key', async () => {
    mocks.maybeSingleQueue.push({ data: { id: 'existing-run' }, error: null })

    const result = await startAgentRun({
      runtime: 'manual',
      kind: 'outreach_generation',
      title: 'Generate outreach draft',
      idempotencyKey: 'idem-existing',
    })

    expect(result).toEqual({ id: 'existing-run' })
    expect(mocks.insertMock).not.toHaveBeenCalled()
  })

  it('records a completed step and keeps the run running', async () => {
    mocks.singleQueue.push({ data: { id: 'step-1' }, error: null })

    const result = await recordAgentStep({
      runId: 'run-1',
      name: 'LLM draft generated',
      status: 'completed',
      idempotencyKey: 'step-idem',
    })

    expect(result).toEqual({ id: 'step-1' })
    expect(mocks.fromMock).toHaveBeenCalledWith('agent_run_steps')
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      current_step: 'LLM draft generated',
      status: 'running',
    }))
  })

  it('records events and artifacts', async () => {
    mocks.singleQueue.push(
      { data: { id: 'event-1' }, error: null },
      { data: { id: 'artifact-1' }, error: null },
    )

    await expect(recordAgentEvent({ runId: 'run-1', eventType: 'note' })).resolves.toEqual({ id: 'event-1' })
    await expect(attachAgentArtifact({
      runId: 'run-1',
      artifactType: 'outreach_draft',
      refType: 'outreach_queue',
      refId: 'queue-1',
    })).resolves.toEqual({ id: 'artifact-1' })
  })

  it('ends and fails runs', async () => {
    mocks.singleQueue.push({ data: { id: 'event-1' }, error: null })
    await expect(endAgentRun({ runId: 'run-1', status: 'completed' })).resolves.toBeUndefined()
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      current_step: 'completed',
    }))

    mocks.singleQueue.push({ data: { id: 'event-2' }, error: null })
    await expect(markAgentRunFailed('run-2', 'failed')).resolves.toBeUndefined()
    expect(mocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      error_message: 'failed',
    }))
  })
})
