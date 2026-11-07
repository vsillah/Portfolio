import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const { repository, deliver, revoke } = vi.hoisted(() => ({ repository: { operator: vi.fn(), revokeUndeliveredInvitation: vi.fn() }, deliver: vi.fn(), revoke: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: async () => ({ user: { id: '00000000-0000-4000-8000-000000000001' }, isAdmin: true }), isAuthError: () => false }))
vi.mock('@/lib/app-activation-operator.server', () => ({ getOperatorSnapshot: () => ({ mode: 'provider' }), applySyntheticOperatorAction: vi.fn(), OperatorActionError: class extends Error {} }))
vi.mock('@/lib/app-activation-repository.server', () => ({ getActivationRepository: () => repository, ActivationError: class extends Error {} }))
vi.mock('@/lib/app-activation-delivery.server', () => ({ getInvitationDeliveryAdapter: () => ({ deliver }), ProviderDisabledDelivery: class {} }))
import { POST } from './route'
const token = 't'.repeat(43)
const request = () => new NextRequest('https://portfolio.example.test/api/admin/app-activation', { method: 'POST', headers: { origin: 'https://portfolio.example.test', 'content-type': 'application/json' }, body: JSON.stringify({ appKey: 'trumpet-trainer', recordId: 'record-1', action: 'prepare_invitation', reason: 'Approved synthetic fixture delivery.' }) })
beforeEach(() => { deliver.mockReset().mockResolvedValue({ mode: 'synthetic', receipt: 'synthetic:receipt-1' }); revoke.mockReset(); repository.revokeUndeliveredInvitation = revoke; repository.operator.mockReset().mockResolvedValue({ deliveryToken: token, record: { id: 'record-1', appKey: 'trumpet-trainer', adultEmail: 'adult@example.test', invitation: { id: 'invite-1', expiresAt: '2026-12-01T00:00:00Z' }, events: [] } }) })
describe('operator invitation delivery', () => {
  it('passes token to server adapter and never returns it to the browser', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ rawToken: token }))
    expect(JSON.stringify(await response.json())).not.toContain(token)
  })
  it('revokes failed delivery and returns no token or email', async () => {
    deliver.mockRejectedValueOnce(new Error(`provider rejected ${token}`))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(revoke).toHaveBeenCalledWith('trumpet-trainer', 'record-1', 'invite-1', '00000000-0000-4000-8000-000000000001')
    expect(JSON.stringify(await response.json())).not.toContain(token)
  })
})
