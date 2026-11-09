import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fixture = vi.hoisted(() => ({ admin: { user: { id: 'admin' } } as Record<string, unknown>, rows: {} as Record<string, Record<string, unknown> | null>, insert: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: vi.fn(async () => fixture.admin), isAuthError: (value: Record<string, unknown>) => 'error' in value }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (table: string) => ({
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fixture.rows[table], error: null }) }), maybeSingle: async () => ({ data: fixture.rows[table], error: null }) }) }),
  insert: fixture.insert,
}) } }))
import { POST } from './route'

const userId = '11111111-1111-4111-8111-111111111111'
const projectId = '22222222-2222-4222-8222-222222222222'
const request = (body: unknown) => new NextRequest('http://localhost/api/admin/accelerated/project-memberships', { method: 'POST', body: JSON.stringify(body) })

describe('paid workshop project conversion', () => {
  beforeEach(() => {
    fixture.admin = { user: { id: 'admin' } }
    fixture.rows = { user_profiles: { id: userId }, client_projects: { id: projectId }, orders: null }
    fixture.insert.mockReset().mockResolvedValue({ error: null })
  })
  it('rejects a conversion without exact paid order lineage', async () => {
    expect((await POST(request({ userId, projectId, source: 'checkout_conversion', orderId: 8 }))).status).toBe(409)
    expect(fixture.insert).not.toHaveBeenCalled()
  })
  it('binds the operator-approved project membership to the paid workshop intake', async () => {
    fixture.rows.orders = { id: 8, user_id: userId, status: 'completed', stripe_payment_intent_id: 'synthetic-payment', workshop_intake_id: 'intake-1' }
    expect((await POST(request({ userId, projectId, source: 'checkout_conversion', orderId: 8 }))).status).toBe(201)
    expect(fixture.insert).toHaveBeenCalledWith(expect.objectContaining({ source_order_id: 8, workshop_intake_id: 'intake-1', verification_source: 'checkout_conversion' }))
  })
  it('keeps existing operator memberships without inventing an order', async () => {
    expect((await POST(request({ userId, projectId, source: 'operator_action' }))).status).toBe(201)
    expect(fixture.insert).toHaveBeenCalledWith(expect.not.objectContaining({ source_order_id: expect.anything() }))
  })
  it('does not call an order collision a successful replay', async () => {
    fixture.rows.orders = { id: 8, user_id: userId, status: 'completed', stripe_payment_intent_id: 'synthetic-payment', workshop_intake_id: 'intake-1' }
    fixture.rows.verified_client_project_memberships = null
    fixture.insert.mockResolvedValue({ error: { code: '23505' } })
    expect((await POST(request({ userId, projectId, source: 'checkout_conversion', orderId: 8 }))).status).toBe(409)
  })
})
