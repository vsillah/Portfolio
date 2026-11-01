import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-server', () => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn() } }))
import { verifyAdmin } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { GET } from './route'

const contentId = 'c12378f2-36de-4bf7-8c5d-0ce754e727eb'

describe('Dark Castle receipt review route', () => {
  it('returns six read-only packets from exact local evidence in the development fixture', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const response = await GET(new NextRequest(`http://localhost/api/admin/social-content/${contentId}/dark-castle-receipt-review?qa_fixture=dark_castle_receipt_packets_v1`), { params: { id: contentId } })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.fixture).toBe(true)
    expect(body.external_execution).toBe(false)
    expect(body.packets).toHaveLength(6)
    expect(body.packets.every((packet: { receipt_id: unknown; decision_recorded: boolean; blockers: string[] }) => packet.receipt_id === null && !packet.decision_recorded && packet.blockers.length > 0)).toBe(true)
    expect(verifyAdmin).not.toHaveBeenCalled()
    expect(supabaseAdmin.from).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('rejects another record before any database access', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/other/dark-castle-receipt-review'), { params: { id: 'other' } })
    expect(response.status).toBe(404)
    expect(supabaseAdmin.from).not.toHaveBeenCalled()
  })
})
