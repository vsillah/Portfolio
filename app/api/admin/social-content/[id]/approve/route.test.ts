import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  from: vi.fn(),
  item: {
    id: 'social-1',
    status: 'draft',
    target_platforms: ['linkedin'],
    scheduled_for: '2026-06-12T14:00:00.000Z',
    rag_context: null as Record<string, unknown> | null,
  },
  updated: null as Record<string, unknown> | null,
  upsert: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: authMocks.verifyAdmin,
  isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: dbMocks.from },
}))

import { POST } from './route'

function request() {
  return new Request('http://localhost/api/admin/social-content/social-1/approve', {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
  })
}

describe('POST /api/admin/social-content/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.item = {
      id: 'social-1',
      status: 'draft',
      target_platforms: ['linkedin'],
      scheduled_for: '2026-06-12T14:00:00.000Z',
      rag_context: null,
    }
    dbMocks.updated = null
    authMocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' }, isAdmin: true })
    dbMocks.from.mockImplementation((table: string) => {
      if (table === 'social_content_queue') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: dbMocks.item, error: null })),
            })),
          })),
          update: vi.fn((payload) => {
            dbMocks.updated = { ...dbMocks.item, ...payload }
            return {
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: dbMocks.updated, error: null })),
                })),
              })),
            }
          }),
        }
      }
      if (table === 'social_content_publishes') {
        return {
          upsert: dbMocks.upsert,
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          })),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('blocks Agent Ops draft-only content before challenger clearance', async () => {
    dbMocks.item.rag_context = {
      source: 'agent_ops_social_outreach_goal',
      publish_gate: 'draft_only',
      current_gate: 'research_context_evidence',
      challenger_status: 'pending',
      pass_to_human: false,
    }

    const response = await POST(request() as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      error: 'Agent Ops content has not cleared challenger QA for human approval',
      current_gate: 'research_context_evidence',
      challenger_status: 'pending',
    })
    expect(dbMocks.upsert).not.toHaveBeenCalled()
  })

  it('allows challenger-cleared Agent Ops content to use the existing approval flow', async () => {
    dbMocks.item.rag_context = {
      source: 'agent_ops_social_outreach_goal',
      publish_gate: 'draft_only',
      current_gate: 'human_review',
      challenger_status: 'passed',
      pass_to_human: true,
    }

    const response = await POST(request() as never, { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.item).toMatchObject({ status: 'approved', reviewed_by: 'admin-user' })
    expect(dbMocks.upsert).toHaveBeenCalledWith([
      { content_id: 'social-1', platform: 'linkedin', status: 'pending' },
    ], { onConflict: 'content_id,platform' })
  })
})
