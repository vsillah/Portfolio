import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildKnowledgeIngestionPlan: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  endAgentRun: vi.fn(),
  fingerprintOpenBrainRecord: vi.fn((parts: unknown[]) => `fingerprint:${parts.join(':')}`),
  recordOpenBrainSource: vi.fn(),
  recordOpenBrainEvent: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/knowledge-ingestion', () => ({
  buildKnowledgeIngestionPlan: mocks.buildKnowledgeIngestionPlan,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentEvent: mocks.recordAgentEvent,
  endAgentRun: mocks.endAgentRun,
}))

vi.mock('@/lib/open-brain', () => ({
  fingerprintOpenBrainRecord: mocks.fingerprintOpenBrainRecord,
  recordOpenBrainSource: mocks.recordOpenBrainSource,
  recordOpenBrainEvent: mocks.recordOpenBrainEvent,
}))

import { POST } from './route'

const plan = {
  ok: true,
  mode: 'shadow_plan',
  ingestRunId: 'ingest-1',
  targetIndex: 'amadutown-knowledge-v1',
  legacyIndex: 'portfolio-legacy',
  chunks: [{
    id: 'chunk-1',
    text: 'Public-safe derived summary only.',
    metadata: {
      title: 'Public source',
      sourceId: 'source-1',
      namespace: 'public_chatbot',
      privacyTier: 'public_safe',
      contentFingerprint: 'hash-1',
    },
  }],
  skippedSources: [],
  errors: [],
  privacyViolations: [],
  duplicateChunkCount: 0,
  sourceCount: 1,
  approvedSourceCount: 1,
  chunkCount: 1,
  namespaceCounts: {
    public_chatbot: 1,
    voice_story: 0,
    sales_context: 0,
    internal_ops: 0,
    legacy_quarantine: 0,
  },
  metadataCompleteness: {
    completeChunkCount: 1,
    incompleteChunkCount: 0,
  },
}

function request(body: Record<string, unknown>, token = 'admin-token') {
  return new Request('http://localhost/api/admin/rag-ingest', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/rag-ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.N8N_INGEST_SECRET
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildKnowledgeIngestionPlan.mockResolvedValue(plan)
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    mocks.endAgentRun.mockResolvedValue({ id: 'run-1', status: 'completed' })
    mocks.recordOpenBrainSource.mockResolvedValue({ id: 'rag-projection:shadow-plan:ingest-1' })
    mocks.recordOpenBrainEvent.mockResolvedValue({ id: 'event:rag-projection-staged:ingest-1' })
  })

  it('records an Open Brain source and event for shadow RAG plans', async () => {
    const response = await POST(request({ ingest_run_id: 'ingest-1' }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      write_status: 'shadow_plan_only',
      approval_required: false,
      ingest_run_id: 'ingest-1',
    })
    expect(mocks.recordOpenBrainSource).toHaveBeenCalledWith(expect.objectContaining({
      id: 'rag-projection:shadow-plan:ingest-1',
      kind: 'rag_projection',
      privacyTier: 'internal_ops',
    }))
    expect(mocks.recordOpenBrainEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: 'event:rag-projection-staged:ingest-1',
      kind: 'rag_projection_staged',
      sourceIds: ['rag-projection:shadow-plan:ingest-1'],
      metadata: expect.objectContaining({
        requestedWrite: false,
        writeStatus: 'shadow_plan_only',
        chunkCount: 1,
      }),
    }))
  })

  it('keeps requested Pinecone writes blocked and records approval-gated trace metadata', async () => {
    const response = await POST(request({ ingest_run_id: 'ingest-1', write: true }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      write_status: 'blocked_pending_pinecone_cutover_approval',
      approval_required: true,
    })
    expect(mocks.recordOpenBrainSource).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'pinecone_projection',
      summary: 'Pinecone write was requested but blocked pending explicit cutover approval.',
    }))
    expect(mocks.recordOpenBrainEvent).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        requestedWrite: true,
        writeStatus: 'blocked_pending_pinecone_cutover_approval',
      }),
    }))
  })

  it('does not build a plan when admin auth fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ ingest_run_id: 'ingest-1' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildKnowledgeIngestionPlan).not.toHaveBeenCalled()
    expect(mocks.recordOpenBrainSource).not.toHaveBeenCalled()
  })
})
