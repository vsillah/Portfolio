// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const recover = vi.hoisted(() => vi.fn())
vi.mock('@/lib/slack-action-receipts', () => ({recoverSlackReceipts:recover}))
import { GET } from './route'
afterEach(() => {vi.unstubAllEnvs();vi.resetAllMocks()})
const req = (token='fixture') => new NextRequest('https://example.com/api/cron/slack-action-receipts',{headers:{authorization:`Bearer ${token}`}})
describe('receipt cron', () => {
  it('requires configured cron secret', async () => {vi.stubEnv('CRON_SECRET','');expect((await GET(req())).status).toBe(401);expect(recover).not.toHaveBeenCalled()})
  it('rejects incorrect secret', async () => {vi.stubEnv('CRON_SECRET','fixture');expect((await GET(req('wrong'))).status).toBe(401)})
  it('reports disabled recovery truthfully', async () => {vi.stubEnv('CRON_SECRET','fixture');recover.mockResolvedValue({enabled:false,checked:0,failed:0});expect(await (await GET(req())).json()).toEqual({enabled:false,checked:0,failed:0})})
  it('surfaces recovery failures', async () => {vi.stubEnv('CRON_SECRET','fixture');recover.mockRejectedValue(new Error('database'));expect((await GET(req())).status).toBe(503)})
})
