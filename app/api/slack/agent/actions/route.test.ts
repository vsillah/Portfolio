// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ verify: vi.fn(), accept: vi.fn(), process: vi.fn(), wait: vi.fn() }))
vi.mock('@/lib/slack-signature', () => ({ verifySlackSignature: mocks.verify }))
vi.mock('@/lib/slack-action-receipts', () => ({ acceptSlackAction: mocks.accept, processSlackReceipt: mocks.process }))
vi.mock('@vercel/functions', () => ({ waitUntil: mocks.wait }))
import { POST } from './route'
function request(body = 'payload=%7B%7D', retry = false) { return new NextRequest('https://example.com/api/slack/agent/actions', {method:'POST',body,headers:retry ? {'x-slack-retry-num':'1'} : {}}) }
beforeEach(() => { vi.resetAllMocks(); mocks.verify.mockReturnValue(true); mocks.process.mockResolvedValue(undefined) })
describe('action receipt route', () => {
  it('rejects invalid signature before acceptance', async () => { mocks.verify.mockReturnValue(false); expect((await POST(request())).status).toBe(401); expect(mocks.accept).not.toHaveBeenCalled() })
  it.each(['','payload=%7B', ...['null', '[]', 'true', '42', '"text"'].map(value => new URLSearchParams({ payload: value }).toString())])('rejects missing/malformed payload %s', async body => { expect((await POST(request(body))).status).toBe(400); expect(mocks.accept).not.toHaveBeenCalled() })
  it('validates retries and returns the persisted result', async () => {
    mocks.accept.mockResolvedValue({receipt:{idempotency_key:'key'},result:{responseType:'ephemeral',text:'Actual persisted outcome'}})
    expect(await (await POST(request(undefined,true))).json()).toEqual({response_type:'ephemeral',text:'Actual persisted outcome'})
    expect(mocks.accept).toHaveBeenCalledOnce(); expect(mocks.wait).toHaveBeenCalledOnce()
  })
  it('database failure never claims saved', async () => { mocks.accept.mockRejectedValue(new Error('timeout')); const r = await POST(request()); expect(r.status).toBe(503); expect((await r.json()).text).toContain('could not be confirmed'); expect(mocks.wait).not.toHaveBeenCalled() })
  it('ACK does not await execution', async () => { mocks.process.mockImplementation(() => new Promise(() => {})); mocks.accept.mockResolvedValue({receipt:{idempotency_key:'key'},result:{responseType:'ephemeral',text:'Queued'}}); expect((await POST(request())).status).toBe(200) })
})

it('does not dispatch without a confirmed receipt', async () => {
  mocks.accept.mockResolvedValue({ result: { responseType: 'ephemeral', text: 'Processing disabled' } })
  expect((await POST(request())).status).toBe(200)
  expect(mocks.process).not.toHaveBeenCalled()
  expect(mocks.wait).not.toHaveBeenCalled()
})
it('keeps a saved ACK when scheduling fails so cron can recover', async () => {
  mocks.accept.mockResolvedValue({ receipt: { idempotency_key: 'key' }, result: { responseType: 'ephemeral', text: 'Saved and queued' } })
  mocks.wait.mockImplementation(() => { throw new Error('dispatch unavailable') })
  expect((await (await POST(request())).json()).text).toBe('Saved and queued')
  expect(mocks.process).toHaveBeenCalledWith('key')
})
it('keeps a saved ACK when the background worker fails', async () => {
  mocks.accept.mockResolvedValue({ receipt: { idempotency_key: 'key' }, result: { responseType: 'ephemeral', text: 'Saved and queued' } })
  mocks.process.mockRejectedValue(new Error('worker unavailable'))
  expect((await POST(request())).status).toBe(200)
  await expect(mocks.wait.mock.calls[0][0]).resolves.toBeUndefined()
})
