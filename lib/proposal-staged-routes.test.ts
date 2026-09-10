import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), authorize: vi.fn(), view: vi.fn(), enabled: vi.fn(), privateBucket: vi.fn(), create: vi.fn(), retrieve: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc, storage: { from: vi.fn() } } }))
vi.mock('@/lib/stripe', () => ({ stripe: { checkout: { sessions: { create: mocks.create, retrieve: mocks.retrieve } } } }))
vi.mock('@/lib/proposal-staged-server', () => ({ authorizeStagedClient: mocks.authorize, stagedView: mocks.view, requireStagedFlow: mocks.enabled, requirePrivateProposalBucket: mocks.privateBucket }))
import { POST } from '@/app/api/proposals/[id]/staged/route'
const policy = { version:1,currency:'usd',totalCents:99700,depositCents:49850,balanceCents:49850,acceptanceCriteria:['Fictional review'] }
let updates: unknown[]
const evidence = { proposalSigned:true,agreementSigned:true,depositPaid:false,balancePaid:false,delivered:false,deliveryAccepted:false }
function chain(data: unknown) {
 const c: Record<string, unknown> = {}
 for (const n of ['select','eq','is']) c[n] = vi.fn(() => c)
 c.update = vi.fn((v:unknown) => { updates.push(v); return c })
 c.single = vi.fn(async () => ({ data,error:null }))
 c.then = (resolve:(v:unknown)=>unknown) => Promise.resolve({ data,error:null }).then(resolve)
 return c
}
const request = (body:unknown) => new NextRequest('http://localhost/api/proposals/p/staged', { method:'POST',headers:{'Content-Type':'application/json','x-proposal-access':'A'.repeat(64)},body:JSON.stringify(body) })
const call=(body:unknown)=>POST(request(body),{params:Promise.resolve({id:'p'})})
beforeEach(()=>{
 vi.resetAllMocks(); updates=[]
 mocks.authorize.mockResolvedValue({policy,content_digest:'digest',proposal_signed_at:null,agreement_signed_at:null})
 mocks.view.mockResolvedValue({evidence:{...evidence}})
 mocks.from.mockImplementation(()=>chain({valid_until:null,bundle_name:'Synthetic',client_email:'fixture@example.invalid'}))
 mocks.rpc.mockResolvedValue({data:{attempt_id:'attempt',reserved_at:new Date().toISOString()},error:null})
 mocks.create.mockResolvedValue({id:'cs_fixture',url:'https://checkout.stripe.invalid/fixture'})
})
describe('native staged action boundaries',()=>{
 it('denies missing client proof before database/payment writes',async()=>{
  mocks.authorize.mockRejectedValue(new Error('Client access required'))
  expect((await call({action:'checkout',stage:'deposit'})).status).toBe(400)
  expect(mocks.from).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled()
 })
 it('requires exact digest and affirmative signature',async()=>{
  expect((await call({action:'sign',document:'proposal',name:'Reviewer',confirm:true,digest:'wrong'})).status).toBe(400)
  expect(updates).toEqual([])
 })
 it('records distinct proposal signer evidence',async()=>{
  expect((await call({action:'sign',document:'proposal',name:'Reviewer',confirm:true,digest:'digest'})).status).toBe(200)
  expect(updates[0]).toMatchObject({proposal_signed_by:'Reviewer'})
 })
 it('prices the deposit on the server regardless of body amount',async()=>{
  expect((await call({action:'checkout',stage:'deposit',amount:1})).status).toBe(200)
  expect(mocks.create.mock.calls[0][0]).toMatchObject({mode:'payment',payment_method_types:['card'],line_items:[{quantity:1,price_data:{unit_amount:49850,currency:'usd'}}]})
  expect(mocks.create.mock.calls[0][1]).toEqual({idempotencyKey:'staged:attempt'})
 })
 it('locks balance before delivery acceptance without calling Stripe',async()=>{
  expect((await call({action:'checkout',stage:'balance'})).status).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
 })
 it('reuses an open checkout after cancellation',async()=>{
  mocks.rpc.mockResolvedValue({data:{checkout_session_id:'cs_existing'},error:null})
  mocks.retrieve.mockResolvedValue({status:'open',url:'https://checkout.stripe.invalid/existing'})
  expect((await call({action:'checkout',stage:'deposit'})).status).toBe(200)
  expect(mocks.create).not.toHaveBeenCalled()
 })
 it('rotates only an explicitly expired session',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{checkout_session_id:'cs_expired'},error:null}).mockResolvedValueOnce({data:{attempt_id:'replacement',reserved_at:new Date().toISOString()},error:null})
  mocks.retrieve.mockResolvedValue({id:'cs_expired',status:'expired'})
  expect((await call({action:'checkout',stage:'deposit'})).status).toBe(200)
  expect(mocks.create.mock.calls[0][1]).toEqual({idempotencyKey:'staged:replacement'})
 })
 it('will not recreate an uncertain attempt after provider idempotency retention',async()=>{
  mocks.rpc.mockResolvedValue({data:{attempt_id:'old',reserved_at:'2000-01-01T00:00:00Z'},error:null})
  expect((await call({action:'checkout',stage:'deposit'})).status).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
 })
 it('requires admin delivery and a deposit before client acceptance',async()=>{
  expect((await call({action:'accept-delivery',confirm:true,digest:'digest',name:'Reviewer'})).status).toBe(400)
  expect(updates).toEqual([])
 })
 it('rejects acceptance from a stale delivery screen',async()=>{
  mocks.authorize.mockResolvedValue({policy,content_digest:'digest',delivered_at:'new-version'})
  mocks.view.mockResolvedValue({evidence:{...evidence,depositPaid:true,delivered:true}})
  expect((await call({action:'accept-delivery',confirm:true,digest:'digest',name:'Reviewer',deliveryVersion:'old-version'})).status).toBe(400)
  expect(updates).toEqual([])
 })
 it('blocks new actions when initiation is disabled',async()=>{
  mocks.enabled.mockImplementation(()=>{throw new Error('Paused')})
  expect((await call({action:'checkout',stage:'deposit'})).status).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
 })
})
