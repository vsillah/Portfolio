import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
  evaluateShadow: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}))
vi.mock('@/tools/evidence-repair/shadow-workflow-binding.mjs', () => ({
  evaluateShadowWorkflowBinding: mocks.evaluateShadow,
}))

import { POST } from './route'

const CONTENT_ID = '11111111-1111-4111-8111-111111111111'
const APPROVAL_ID = '22222222-2222-4222-8222-222222222222'
const VERSION = '2026-10-12T18:30:00.000Z'

function receipt() {
  return { receipt_id: crypto.randomUUID(), status: 'approved', content_updated_at: VERSION }
}

function reviewItem(version = VERSION) {
  return {
    id: CONTENT_ID,
    status: 'draft',
    updated_at: version,
    rag_context: {
      mobile_decision_review: {
        version: 'social-content-decision-review/v1',
        approval_id: APPROVAL_ID,
        run_id: '33333333-3333-4333-8333-333333333333',
        work_item_id: '44444444-4444-4444-8444-444444444444',
        content_id: CONTENT_ID,
        content_updated_at: VERSION,
        current_gate: 'copy_review',
        next_gate: 'visual_review',
        receipts: {
          source: receipt(),
          voice: receipt(),
          framework: receipt(),
          privacy: receipt(),
          visual: receipt(),
          challenger: receipt(),
        },
        candidate_projection: { headline: 'Read only' },
      },
    },
  }
}

function request(decision: string, shadow?: unknown) {
  return new NextRequest(`http://localhost/api/admin/social-content/${CONTENT_ID}/decision`, {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
    body: JSON.stringify({ decision, work_item_id: '44444444-4444-4444-8444-444444444444', ...(shadow ? { evidence_repair_shadow: shadow } : {}) }),
  })
}

describe('POST /api/admin/social-content/[id]/decision', () => {
  afterEach(() => vi.unstubAllEnvs())
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ single: mocks.single })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.single
      .mockResolvedValueOnce({ data: reviewItem(), error: null })
      .mockResolvedValueOnce({ data: { ...reviewItem(), status: 'approved' }, error: null })
    mocks.rpc.mockResolvedValue({
      data: {
        id: '55555555-5555-4555-8555-555555555555',
        decision: 'approve',
        next_internal_gate: 'visual_review',
        external_execution: false,
      },
      error: null,
    })
  })

  it('records a receipt-complete decision through the transactional command only', async () => {
    const response = await POST(request('approve'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: true,
      decision: 'approve',
      next_internal_gate: 'visual_review',
      external_execution: false,
    }))
    expect(mocks.rpc).toHaveBeenCalledWith('record_social_content_stage_decision', expect.objectContaining({
      p_social_content_id: CONTENT_ID,
      p_approval_id: APPROVAL_ID,
      p_content_updated_at: VERSION,
      p_decision: 'approve',
      p_decided_by_user_id: 'admin-1',
      p_command_name: 'approve_copy',
      p_idempotency_key: expect.stringContaining(`${APPROVAL_ID}:`),
    }))
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('lets the transactional command distinguish an idempotent replay from a stale first attempt', async () => {
    mocks.single.mockReset()
    mocks.single.mockResolvedValueOnce({
      data: reviewItem('2026-10-12T18:31:00.000Z'),
      error: null,
    })
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Social Content review packet is stale' },
    })

    const response = await POST(request('hold'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Social Content review packet is stale' })
    expect(mocks.rpc).toHaveBeenCalledWith('record_social_content_stage_decision', expect.objectContaining({
      p_decision: 'hold',
      p_content_updated_at: VERSION,
    }))
  })

  it('returns the existing immutable receipt on a retry after the item version advanced', async () => {
    const advancedItem = reviewItem('2026-10-12T18:31:00.000Z')
    Object.assign(advancedItem.rag_context, {
      current_gate: 'visual_review',
      latest_internal_decision_receipt_id: '55555555-5555-4555-8555-555555555555',
      latest_internal_decision: 'approve',
    })
    mocks.single.mockReset()
    mocks.single
      .mockResolvedValueOnce({ data: advancedItem, error: null })
      .mockResolvedValueOnce({ data: { ...advancedItem, status: 'approved' }, error: null })
    mocks.rpc.mockResolvedValueOnce({
      data: {
        id: '55555555-5555-4555-8555-555555555555',
        decision: 'approve',
        next_internal_gate: 'visual_review',
        idempotent_replay: true,
        external_execution: false,
      },
      error: null,
    })

    const response = await POST(request('approve'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      ok: true,
      receipt: expect.objectContaining({ idempotent_replay: true }),
      external_execution: false,
    }))
  })

  it('fails closed before the RPC when a required receipt is missing', async () => {
    const incomplete = reviewItem()
    delete (incomplete.rag_context.mobile_decision_review.receipts as Record<string, unknown>).visual
    mocks.single.mockReset()
    mocks.single.mockResolvedValueOnce({ data: incomplete, error: null })

    const response = await POST(request('request_revision'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({
      code: 'SOCIAL_DECISION_RECEIPTS_REQUIRED',
    }))
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rejects unknown actions without reading or mutating data', async () => {
    const response = await POST(request('publish'), { params: { id: CONTENT_ID } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid decision' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  function shadowInput() {
    return {
      mode: 'synthetic_local', data_class: 'synthetic',
      fixture: { synthetic: true, case_id: 'synthetic:repair', candidate_version: VERSION, blocker_version: 'blocker-v1', input: { candidate: { id: CONTENT_ID } } },
      binding: { artifact: { version: VERSION }, authority: { reviewer_id: 'admin-1', approved_at: '2026-10-12T18:32:00Z', source: { path: 'artifacts/synthetic/decision.json', sha256: 'sha256:synthetic' } } },
      human_qa: { decision: 'passed', case_id: 'synthetic:repair', candidate_version: VERSION, blocker_version: 'blocker-v1', work_item_id: '44444444-4444-4444-8444-444444444444', stage_receipt_id: '55555555-5555-4555-8555-555555555555', reviewer_id: 'admin-1', approved_at: '2026-10-12T18:32:00Z', approval_source_path: 'artifacts/synthetic/decision.json', approval_source_sha256: 'sha256:synthetic' },
      source_bytes: [{ path: 'artifacts/synthetic/decision.json', base64: Buffer.from('synthetic approval').toString('base64') }],
    }
  }

  function syntheticDecision() {
    const item = reviewItem()
    Object.assign(item.rag_context, { qa_fixture: { kind: 'evidence_repair_shadow', synthetic: true } })
    const updatedItem = { ...item, rag_context: { ...item.rag_context, latest_internal_decision_receipt_id: '55555555-5555-4555-8555-555555555555' } }
    mocks.single.mockReset()
    mocks.single.mockResolvedValueOnce({ data: item, error: null }).mockResolvedValueOnce({ data: updatedItem, error: null })
    mocks.rpc.mockResolvedValueOnce({ data: { id: '55555555-5555-4555-8555-555555555555', decision: 'approve', external_execution: false }, error: null })
    return { item, updatedItem }
  }

  it('invokes the Phase 5D shadow adapter after a synthetic case-specific decision', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('APP_ENV', 'local')
    syntheticDecision()
    mocks.evaluateShadow.mockReturnValue({ status: 'captured', receipt_sha256: 'sha256:review', label_promoted: false, workflow_mutated: false, external_actions_enabled: false })
    const response = await POST(request('approve', shadowInput()), { params: { id: CONTENT_ID } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(mocks.evaluateShadow).toHaveBeenCalledOnce()
    expect(mocks.evaluateShadow.mock.calls[0][0]).toMatchObject({ workflow: { packet: { content_id: CONTENT_ID, content_updated_at: VERSION }, result: { receipt: { decision: 'approve', external_execution: false }, item: { id: CONTENT_ID } } } })
    expect(body.evidence_repair_shadow_review).toEqual(expect.objectContaining({ status: 'captured', label_promoted: false, external_actions_enabled: false }))
    expect(JSON.stringify(body)).not.toContain('synthetic approval')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('allows synthetic staging shadow in a preview deployment', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('APP_ENV', 'staging')
    syntheticDecision()
    mocks.evaluateShadow.mockReturnValue({ status: 'captured', label_promoted: false, workflow_mutated: false, external_actions_enabled: false })
    const shadow = shadowInput()
    shadow.mode = 'staging_shadow'
    const body = await (await POST(request('approve', shadow), { params: { id: CONTENT_ID } })).json()
    expect(mocks.evaluateShadow).toHaveBeenCalledOnce()
    expect(body.evidence_repair_shadow_review.status).toBe('captured')
  })

  it('does not invoke the adapter for an ordinary workflow row', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('APP_ENV', 'local')
    const { item } = syntheticDecision()
    Object.assign(item.rag_context, { qa_fixture: null })
    const body = await (await POST(request('approve', shadowInput()), { params: { id: CONTENT_ID } })).json()
    expect(mocks.evaluateShadow).not.toHaveBeenCalled()
    expect(body).not.toHaveProperty('evidence_repair_shadow_review')
  })

  it.each([
    ['production', (shadow: ReturnType<typeof shadowInput>) => { vi.stubEnv('VERCEL_ENV', 'production'); return shadow }],
    ['non-synthetic input', (shadow: ReturnType<typeof shadowInput>) => { shadow.fixture.synthetic = false; return shadow }],
    ['missing Human QA', (shadow: ReturnType<typeof shadowInput>) => { shadow.human_qa.decision = ''; return shadow }],
    ['general approval', (shadow: ReturnType<typeof shadowInput>) => { shadow.human_qa.decision = 'general_approval'; return shadow }],
    ['stale binding', (shadow: ReturnType<typeof shadowInput>) => { shadow.fixture.candidate_version = 'stale'; return shadow }],
    ['external execution', (shadow: ReturnType<typeof shadowInput>) => { mocks.rpc.mockReset().mockResolvedValue({ data: { id: '55555555-5555-4555-8555-555555555555', decision: 'approve', external_execution: true }, error: null }); return shadow }],
  ])('does not invoke the adapter for %s', async (_name, edit) => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('APP_ENV', 'local')
    syntheticDecision()
    const shadow = edit(shadowInput())
    const body = await (await POST(request('approve', shadow), { params: { id: CONTENT_ID } })).json()
    expect(mocks.evaluateShadow).not.toHaveBeenCalled()
    expect(body).not.toHaveProperty('evidence_repair_shadow_review')
  })
})
