import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), load: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: m.auth, isAuthError: (a: { error?: string }) => !!a.error }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: m.from } }))
vi.mock('@/lib/proposal-staged-server', () => ({ loadStagedPackage: m.load, requireStagedFlow: vi.fn(), requirePrivateProposalBucket: vi.fn() }))
vi.mock('@/lib/proposal-pdf', () => ({ generateProposalPDF: vi.fn() }))
vi.mock('@/lib/contract-pdf', () => ({ generateContractPDF: vi.fn() }))
import { GET } from '@/app/api/admin/proposals/[id]/staged/route'
import { GET as list } from '@/app/api/admin/proposals/prepare-staged/route'
const request = () => new NextRequest('http://localhost/api/admin/proposals/p/staged')
const params = { params: Promise.resolve({ id: 'p' }) }
function chain(data: unknown) {
 const q: any = { then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) }
 for (const key of ['select','eq','order','limit']) q[key] = vi.fn(() => q)
 q.single = async () => ({ data, error: null })
 return q
}
beforeEach(() => {
 vi.resetAllMocks(); vi.stubEnv('PROPOSAL_STAGED_PAYMENTS_ENABLED','false')
 m.auth.mockResolvedValue({ user: { id: 'admin' } })
 m.load.mockResolvedValue({ ready:true, client_project_id:'project', content_digest:'digest', agreement_text:'Exact agreement', policy:{totalCents:99700}, released_at:'now', proposal_signed_at:'now', agreement_signed_at:'now', delivered_at:'now', delivery_note:'Review work' })
 m.from.mockImplementation((table: string) => chain(table === 'proposals' ? { client_name:'Synthetic', valid_until:null } : table === 'proposal_payment_stages' ? [{stage:'deposit',paid_at:'now'}] : {access_token:'private',is_active:true}))
})
it('denies both admin recovery reads before accessing records', async () => {
 m.auth.mockResolvedValue({error:'Unauthorized',status:401})
 expect((await GET(request(),params)).status).toBe(401)
 expect((await list(request())).status).toBe(401)
 expect(m.from).not.toHaveBeenCalled(); expect(m.load).not.toHaveBeenCalled()
})
it('restores release, signatures, money and delivery with initiation disabled', async () => {
 const response = await GET(request(),params); const data = await response.json()
 expect(response.headers.get('cache-control')).toBe('no-store')
 expect(data).toMatchObject({ready:true,released:true,proposalSigned:true,agreementSigned:true,depositPaid:true,delivered:true,agreement:'Exact agreement',policy:{totalCents:99700},actionsEnabled:false,links:{proposalPath:'/proposal/private'}})
 expect(data.retryPayload).toBeNull()
})
it('restores unfinished exact payload and omits links for revoked access', async () => {
 m.load.mockResolvedValue({ready:false,preparation_payload:{terms_text:'Exact'},preparation_key:'key',released_at:'now'})
 m.from.mockImplementation((table: string) => chain(table === 'proposals' ? {id:'p'} : table === 'proposal_payment_stages' ? [] : {is_active:false,access_token:'secret'}))
 const data=await (await GET(request(),params)).json()
 expect(data.retryPayload).toEqual({terms_text:'Exact',preparation_key:'key'}); expect(data.links).toBeNull()
})
it('looks up an interrupted preparation key without creating a record', async () => {
 const q=chain([{proposal_id:'p'}]);m.from.mockReturnValue(q)
 const response=await list(new NextRequest('http://localhost/api/admin/proposals/prepare-staged?preparationKey=saved-key'))
 expect(q.eq).toHaveBeenCalledWith('preparation_key','saved-key')
 expect(await response.json()).toEqual({packages:[{proposal_id:'p'}]})
})
