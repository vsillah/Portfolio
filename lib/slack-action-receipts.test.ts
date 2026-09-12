// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), execute: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/agent-slack-actions', () => ({ prepareSlackAgentAction: mocks.prepare, handleSlackAgentAction: mocks.execute }))
import { acceptSlackAction, bounded, deliverSlackReceipt, patchActionBlocks, processSlackReceipt, receiptEnvironment, receiptStore, recoverSlackReceipts, withSlackMessageLease, type Receipt, type ReceiptStore } from './slack-action-receipts'
const value = { action: 'work.ready', workItemId: 'work-1', sourceEnvironment: 'staging' as const, sourceOrigin: 'https://staging.example.com' }
const payload = { type: 'block_actions', team: { id: 'T123' }, channel: { id: 'C123' }, user: { id: 'U123' },
  container: { message_ts: '123.456', channel_id: 'C123' }, actions: [{ action_id: 'work_ready', value: JSON.stringify(value) }] }
const canonical = { responseType: 'ephemeral' as const, text: 'Ready recorded.', actionStatus: 'completed' as const }
function memoryStore() {
  const rows = new Map<string, Receipt>()
  const clone = (r: Receipt) => structuredClone(r)
  const store: ReceiptStore = {
    insert: vi.fn(async row => { if (!rows.has(row.idempotency_key)) rows.set(row.idempotency_key, clone(row)); return clone(rows.get(row.idempotency_key)!) }),
    get: vi.fn(async key => rows.has(key) ? clone(rows.get(key)!) : null),
    cas: vi.fn(async (row, next) => { const old = rows.get(row.idempotency_key)
      if (!old || old.updated_at !== row.updated_at || old.metadata.fence !== row.metadata.fence || old.metadata.state !== row.metadata.state) return null
      rows.set(row.idempotency_key, clone(next)); return clone(next)
    }),
    pending: vi.fn(async env => [...rows.values()].filter(r => r.metadata.envelope.environment === env && !['delivered','reconciliation_required','message_lock','delivery_blocked'].includes(r.metadata.state) && Date.parse(r.metadata.leaseUntil) <= Date.now()).map(clone)),
  }
  return { rows, store }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID', 'T123'); vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', 'true'); vi.stubEnv('SLACK_ACTION_RECEIPTS_ENVIRONMENT', 'staging')
  vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('APP_ENV', 'staging'); vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging')
  vi.stubEnv('SLACK_AGENT_OPS_STAGING_BASE_URL', 'https://staging.example.com')
  vi.stubEnv('SLACK_AGENT_OPS_STAGING_BOT_TOKEN', 'fixture-token')
  mocks.prepare.mockImplementation(() => ({ ok: true, key: 'deterministic', authorization: { userId: 'U123' }, value }))
  mocks.execute.mockResolvedValue(canonical)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unmocked egress forbidden') }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('receipt acceptance', () => {
  it('authorizes before any write or duplicate lookup', async () => {
    const { store } = memoryStore()
    mocks.prepare.mockReturnValue({ ok: false, result: { responseType: 'ephemeral', text: 'Denied', actionStatus: 'blocked' } })
    expect((await acceptSlackAction(payload, store)).result.text).toBe('Denied')
    expect(store.insert).not.toHaveBeenCalled(); expect(store.get).not.toHaveBeenCalled()
  })
  it('persists only validated minimal fields, with canonical staging on production hosting', async () => {
    const { store } = memoryStore()
    const accepted = await acceptSlackAction({ ...payload, response_url: 'https://private.invalid/token', message: { ts: '123.456', blocks: [{ text: 'private' }] } } as never, store)
    expect(accepted.receipt?.metadata.envelope.environment).toBe('staging')
    expect(JSON.stringify(accepted.receipt)).not.toMatch(/private|response_url|blocks/)
    expect(accepted.result.text).toContain('queued')
  })
  it.each([{ team: undefined }, { actions: [] }, { channel: { id: 'C999' } }])('rejects invalid envelope before persistence %j', async change => {
    const { store } = memoryStore()
    await expect(acceptSlackAction({ ...payload, ...change }, store)).rejects.toThrow()
    expect(store.insert).not.toHaveBeenCalled()
  })
  it('rejects secret-bearing notes before writes', async () => {
    const { store } = memoryStore()
    mocks.prepare.mockReturnValue({ ok: true, key: 'key', value: { ...value, note: 'xoxb-secret-token' } })
    await expect(acceptSlackAction(payload, store)).rejects.toThrow('Unsafe')
    expect(store.insert).not.toHaveBeenCalled()
  })
  it('fails closed if reconstructed authorization key changes', async () => {
    const { store } = memoryStore()
    mocks.prepare.mockReturnValueOnce({ ok: true, key: 'original', value }).mockReturnValueOnce({ ok: true, key: 'changed', value })
    await expect(acceptSlackAction(payload, store)).rejects.toThrow('contract mismatch')
    expect(store.insert).not.toHaveBeenCalled()
  })
  it('does not promise a saved action on failed or timed-out persistence', async () => {
    const { store } = memoryStore()
    vi.mocked(store.insert).mockRejectedValueOnce(new Error('db down'))
    await expect(acceptSlackAction(payload, store)).rejects.toThrow('db down')
    vi.useFakeTimers()
    vi.mocked(store.insert).mockImplementation(() => new Promise(() => {}))
    const pending = expect(acceptSlackAction(payload, store)).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(1201); await pending
  })
  it('defaults off and rejects mismatched environment without writes', async () => {
    const { store } = memoryStore()
    vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', '')
    expect((await acceptSlackAction(payload, store)).result.actionStatus).toBe('blocked')
    vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID', 'T123'); vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', 'true'); vi.stubEnv('SLACK_ACTION_RECEIPTS_ENVIRONMENT', 'production')
    expect(receiptEnvironment()).toBeNull(); expect(store.insert).not.toHaveBeenCalled()
  })
})

describe('ownership and recovery', () => {
  it('concurrent deliveries execute once, then duplicates return persisted outcome', async () => {
    const { store, rows } = memoryStore()
    const [a,b] = await Promise.all([acceptSlackAction(payload, store), acceptSlackAction(payload, store)])
    expect(a.receipt!.id).toBe(b.receipt!.id)
    const deliver = vi.fn(async () => {})
    await Promise.all([processSlackReceipt(a.receipt!.idempotency_key, store, mocks.execute, deliver), processSlackReceipt(b.receipt!.idempotency_key, store, mocks.execute, deliver)])
    expect(mocks.execute).toHaveBeenCalledTimes(1); expect(deliver).toHaveBeenCalledTimes(1)
    expect([...rows.values()][0].metadata.state).toBe('delivered')
    expect((await acceptSlackAction(payload, store)).result).toEqual({ ...canonical,
      text: `${canonical.text}\nSlack card updated. Receipt: https://staging.example.com/admin/agents/runs/${a.receipt!.id}` })
  })
  it('persists executing before mutation and outcome before feedback', async () => {
    const { store, rows } = memoryStore(); const a = await acceptSlackAction(payload, store); const key = a.receipt!.idempotency_key
    await processSlackReceipt(key, store, async () => { expect(rows.get(key)?.metadata.state).toBe('executing'); return canonical }, async () => {
      expect(rows.get(key)?.outcome.canonical).toEqual(canonical)
    })
  })
  it('restarts queued/expired claims but never expired executions', async () => {
    for (const state of ['queued','claimed','executing'] as const) {
      const { store, rows } = memoryStore(); const a = await acceptSlackAction(payload, store); const row = rows.get(a.receipt!.idempotency_key)!
      row.metadata.state = state; row.metadata.leaseUntil = new Date(0).toISOString()
      const execute = vi.fn(async () => canonical)
      await processSlackReceipt(row.idempotency_key, store, execute, async () => {})
      expect(execute).toHaveBeenCalledTimes(state === 'executing' ? 0 : 1)
      if (state === 'executing') expect(rows.get(row.idempotency_key)?.metadata.state).toBe('reconciliation_required')
    }
  })
  it('rejects stale owner writes after a replacement claim', async () => {
    const { store } = memoryStore(); const a = await acceptSlackAction(payload, store); const old = a.receipt!
    const newer = structuredClone(old); newer.metadata.fence = 'replacement'; newer.updated_at = new Date(Date.now()+1).toISOString()
    expect(await store.cas(old, newer)).toBeTruthy(); expect(await store.cas(old, old)).toBeNull()
  })
  it('lost outcome persistence never delivers or reruns canonical work', async () => {
    const { store, rows } = memoryStore(); const a = await acceptSlackAction(payload, store); const key = a.receipt!.idempotency_key
    const original = store.cas
    store.cas = vi.fn(async (row, next) => { if (next.metadata.state === 'outcome') throw new Error('lost DB'); return original(row,next) })
    const deliver = vi.fn()
    await expect(processSlackReceipt(key, store, mocks.execute, deliver)).rejects.toThrow('lost DB')
    expect(deliver).not.toHaveBeenCalled()
    rows.get(key)!.metadata.leaseUntil = new Date(0).toISOString()
    await processSlackReceipt(key, store, mocks.execute, deliver)
    expect(mocks.execute).toHaveBeenCalledTimes(1); expect(rows.get(key)!.metadata.state).toBe('reconciliation_required')
  })
  it('canonical exception requires reconciliation rather than replay', async () => {
    const { store, rows } = memoryStore(); const a = await acceptSlackAction(payload, store)
    mocks.execute.mockRejectedValue(new Error('ambiguous provider result'))
    await processSlackReceipt(a.receipt!.idempotency_key, store)
    expect([...rows.values()][0].metadata.state).toBe('reconciliation_required')
  })
  it('feedback failure preserves canonical result; recovery retries feedback only', async () => {
    const { store, rows } = memoryStore(); const a = await acceptSlackAction(payload, store); const key = a.receipt!.idempotency_key
    const deliver = vi.fn().mockRejectedValueOnce(new Error('Slack 503')).mockResolvedValue(undefined)
    await processSlackReceipt(key, store, mocks.execute, deliver)
    expect(rows.get(key)!.outcome).toMatchObject({ canonical, delivery: 'failed' })
    rows.get(key)!.metadata.leaseUntil = new Date(0).toISOString()
    await processSlackReceipt(key, store, mocks.execute, deliver)
    expect(mocks.execute).toHaveBeenCalledTimes(1); expect(deliver).toHaveBeenCalledTimes(2)
  })
  it('rechecks authorization before executing a recovered queue', async () => {
    const {store,rows} = memoryStore(); const a = await acceptSlackAction(payload,store)
    mocks.prepare.mockReturnValue({ok:false,result:{responseType:'ephemeral',text:'Authorization revoked',actionStatus:'blocked'}})
    await processSlackReceipt(a.receipt!.idempotency_key,store,mocks.execute,async()=>{})
    expect(mocks.execute).not.toHaveBeenCalled()
    expect([...rows.values()][0].outcome.canonical?.actionStatus).toBe('blocked')
  })
  it('does not steal a live lease or cross environment boundaries', async () => {
    const {store,rows} = memoryStore(); const a = await acceptSlackAction(payload,store); const row = rows.get(a.receipt!.idempotency_key)!
    row.metadata.state = 'executing'; row.metadata.leaseUntil = new Date(Date.now()+120000).toISOString()
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,async()=>{})
    expect(store.cas).not.toHaveBeenCalled()
    row.metadata.state = 'queued'; row.metadata.envelope.environment = 'production'
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,async()=>{})
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('serializes different receipts updating the same Slack message', async () => {
    const {store} = memoryStore(); const a = (await acceptSlackAction(payload,store)).receipt!
    const b = {...a,id:'another-receipt'}
    let finish!: () => void
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const first = withSlackMessageLease(a,store,async()=> { started(); await new Promise<void>(resolve => {finish = resolve}) })
    await ready
    const work = vi.fn(async()=>{})
    await expect(withSlackMessageLease(b,store,work)).rejects.toThrow('already claimed')
    expect(work).not.toHaveBeenCalled()
    finish(); await first
    await withSlackMessageLease(b,store,work)
    expect(work).toHaveBeenCalledTimes(1)
  })
  it('disabled recovery never reads persistence', async () => {
    const { store } = memoryStore(); vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', '')
    expect(await recoverSlackReceipts(store)).toEqual({ enabled: false, checked: 0, failed: 0 })
    expect(store.pending).not.toHaveBeenCalled()
  })
})

describe('Slack feedback', () => {
  async function row() { const { store } = memoryStore(); const r = (await acceptSlackAction(payload, store)).receipt!; r.outcome.canonical = { ...canonical }; return r }
  const clicked = { type: 'button', action_id: 'work_ready', value: JSON.stringify(value) }
  const other = { type: 'button', action_id: 'other', value: '{}' }
  it('preserves unrelated cards/buttons and inserts state under affected controls', async () => {
    const r = await row(); const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'unrelated card' } }, { type: 'actions', elements: [clicked,other] }]
    const patched = patchActionBlocks(blocks,r)
    expect(patched[0]).toEqual(blocks[0]); expect(patched[1].elements).toEqual([other]); expect(patched[2].type).toBe('context')
    expect(blocks[1].elements).toHaveLength(2)
    expect(patchActionBlocks(patched,r)).toEqual(patched)
  })
  it('removes obsolete same-approval decisions while preserving other cards and useful links', async () => {
    const r = await row()
    const decision = {...value,action:'approval.approve',approvalId:'approval-1'}
    r.metadata.envelope.value = decision; r.metadata.envelope.actionId = 'approve'
    const button = (action: string, approvalId = 'approval-1') => ({type:'button',action_id:action === 'approval.approve' ? 'approve' : action,value:JSON.stringify({...decision,action,approvalId})})
    const link = {type:'button',action_id:'open',url:'https://staging.example.com/review'}
    const blocks = [{type:'actions',elements:[button('approval.approve'),button('approval.reject'),button('approval.revision'),button('approval.ask_shaka'),link]},
      {type:'actions',elements:[button('approval.approve','approval-2'),button('approval.reject','approval-2')]}]
    const patched = patchActionBlocks(blocks,r)
    expect(patched[0].elements).toEqual([button('approval.ask_shaka'),link])
    expect(patched[1].type).toBe('context'); expect(patched[2]).toEqual(blocks[1])
  })
  it.each([undefined,'blocked','failed'] as const)('keeps controls for unconfirmed or unsuccessful status %s', async status => {
    const r = await row(); r.outcome.canonical!.actionStatus = status
    expect(patchActionBlocks([{ type: 'actions', elements: [clicked] }],r)[0].elements).toEqual([clicked])
  })
  it('records successful Slack feedback only with confirmed channel and timestamp', async () => {
    const {store,rows} = memoryStore(); const a = await acceptSlackAction(payload,store)
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({ok:true,messages:[{ts:'123.456',blocks:[{type:'actions',elements:[clicked,other]}]}]})})
      .mockResolvedValueOnce({ok:true,json:async()=>({ok:true,channel:'C123',ts:'123.456'})}))
    await processSlackReceipt(a.receipt!.idempotency_key,store,mocks.execute,r=>deliverSlackReceipt(r,store))
    expect(rows.get(a.receipt!.idempotency_key)!.outcome.delivery).toBe('delivered')
    expect(rows.get(a.receipt!.idempotency_key)!.outcome.canonical).toEqual(canonical)
  })
  it.each(['http','ok_false','missing_message','missing_update_receipt'])('persists delivery failure for %s', async failure => {
    const { store, rows } = memoryStore(); const a = await acceptSlackAction(payload,store)
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: failure !== 'http', json: async () => failure === 'ok_false' ? {ok:false} : {ok:true,messages: failure === 'missing_message' ? [] : [{ts:'123.456',blocks:[{type:'actions',elements:[clicked]}]}]} })
      .mockResolvedValueOnce({ok:true,json:async()=>({ok:true})})
    vi.stubGlobal('fetch',fetcher)
    await processSlackReceipt(a.receipt!.idempotency_key,store,mocks.execute,r => deliverSlackReceipt(r,store))
    expect([...rows.values()][0].outcome.delivery).toBe('failed')
    expect([...rows.values()][0].outcome.canonical).toEqual(canonical)
    expect(fetcher.mock.calls.every(c => String(c[0]).startsWith('https://slack.com/api/'))).toBe(true)
  })
})

describe('thread message feedback', () => {
  const threadTs = '120.001'
  const blocks = [{ type: 'actions', elements: [{ type: 'button', action_id: 'work_ready', value: JSON.stringify(value) }] }]
  const ok = (data: unknown) => ({ ok: true, json: async () => ({ ok: true, ...(data as object) }) })
  async function receipt(thread: unknown = threadTs) {
    const context = memoryStore()
    const input = { ...payload, message: { ts: '123.456', ...(thread !== undefined ? { thread_ts: thread } : {}) } }
    const accepted = await acceptSlackAction(input as never, context.store)
    return { ...context, row: accepted.receipt! }
  }
  const deliver = (store: ReceiptStore) => (row: Receipt) => deliverSlackReceipt(row, store)
  it.each([
    {container:{...payload.container,is_ephemeral:true}},
    {message:{ts:'123.456',thread_ts:threadTs,is_ephemeral:true}},
    {message:{ts:'123.456',type:'ephemeral'}},
  ])('blocks explicit ephemeral cards before receipt writes or canonical work %j',async extra=>{
    const {store} = memoryStore()
    const accepted = await acceptSlackAction({...payload,...extra,response_url:'https://untrusted.example.com',message_url:'https://untrusted.example.com'} as never,store)
    expect(accepted.result.actionStatus).toBe('blocked')
    expect(accepted.result.text).toContain('https://staging.example.com/admin/agents')
    expect(accepted.result.text).not.toContain('untrusted')
    expect(store.insert).not.toHaveBeenCalled();expect(mocks.execute).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
  })
  it('persists only the signed parent and reconstructs it, without changing duplicate identity', async () => {
    const { store, row } = await receipt()
    expect(row.metadata.envelope.threadTs).toBe(threadTs)
    const execute = vi.fn(async input => { expect(input.message).toEqual({ts:'123.456',thread_ts:threadTs}); return canonical })
    await processSlackReceipt(row.idempotency_key,store,execute,async()=>{})
    const duplicate = await acceptSlackAction({...payload,message:{ts:'123.456',thread_ts:threadTs,blocks:[{secret:'raw'}]},response_url:'https://hooks.slack.com/raw',thread_ts:'999.000'} as never,store)
    expect(duplicate.receipt!.id).toBe(row.id)
    expect(duplicate.result).toEqual({ ...canonical,
      text: `${canonical.text}\nSlack card updated. Receipt: https://staging.example.com/admin/agents/runs/${duplicate.receipt!.id}` })
    expect(JSON.stringify(row)).not.toMatch(/hooks|secret|999.000/)
  })
  it.each(['https://example.com/thread', '', '124.000', 120.001, null, {}, '120', '120.12345678901'])('rejects malformed or later parent %j before persistence',async parent=>{
    const {store} = memoryStore()
    await expect(acceptSlackAction({...payload,message:{ts:'123.456',thread_ts:parent}} as never,store)).rejects.toThrow('identity')
    expect(store.insert).not.toHaveBeenCalled()
  })
  it('rejects conflicting signed source timestamps before persistence',async()=>{
    const {store} = memoryStore()
    await expect(acceptSlackAction({...payload,message:{ts:'124.000',thread_ts:threadTs}} as never,store)).rejects.toThrow('identity')
    expect(store.insert).not.toHaveBeenCalled()
  })
  it('reads an exact reply using the verified parent, never updating the parent or adjacent cards',async()=>{
    const {store,row,rows} = await receipt()
    const fetcher = vi.fn().mockResolvedValueOnce(ok({messages:[{ts:threadTs,thread_ts:threadTs,blocks:[{type:'divider'}]}, {ts:'123.456',thread_ts:threadTs,channel:'C123',team:'T123',blocks}, {ts:'125.000',thread_ts:threadTs,blocks}]}))
      .mockResolvedValueOnce(ok({channel:'C123',ts:'123.456'}))
    vi.stubGlobal('fetch',fetcher)
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(fetcher.mock.calls[0][0]).toBe('https://slack.com/api/conversations.replies')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({channel:'C123',ts:threadTs,oldest:'123.456',latest:'123.456',inclusive:true,limit:15})
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({channel:'C123',ts:'123.456'})
    expect(rows.get(row.idempotency_key)!.outcome.delivery).toBe('delivered')
  })
  it('keeps old root envelopes working with exact history bounds',async()=>{
    const {store} = memoryStore();const row = (await acceptSlackAction(payload,store)).receipt!
    expect(row.metadata.envelope).not.toHaveProperty('threadTs')
    const fetcher = vi.fn().mockResolvedValueOnce(ok({messages:[{ts:'123.456',blocks}]})).mockResolvedValueOnce(ok({channel:'C123',ts:'123.456'}))
    vi.stubGlobal('fetch',fetcher)
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(fetcher.mock.calls[0][0]).toBe('https://slack.com/api/conversations.history')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({channel:'C123',oldest:'123.456',latest:'123.456',inclusive:true,limit:1})
  })
  it('can recover an old reply envelope via exact-target replies, never guessed parent IDs',async()=>{
    const {store} = memoryStore();const row = (await acceptSlackAction(payload,store)).receipt!
    const fetcher = vi.fn().mockResolvedValueOnce(ok({messages:[]})).mockResolvedValueOnce(ok({messages:[{ts:'123.456',thread_ts:threadTs,blocks}]}))
      .mockResolvedValueOnce(ok({channel:'C123',ts:'123.456'}))
    vi.stubGlobal('fetch',fetcher)
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetcher.mock.calls[1][1].body).ts).toBe('123.456')
    expect(JSON.parse(fetcher.mock.calls[2][1].body).ts).toBe('123.456')
  })
  it.each([
    {messages:[{ts:'123.456',thread_ts:'119.000',blocks}]},
    {messages:[{ts:'123.456',blocks}]},
    {messages:[{ts:threadTs,thread_ts:threadTs,blocks}]},
    {messages:[{ts:'123.456',thread_ts:threadTs,channel:'C999',blocks}]},
    {messages:[{ts:'123.456',thread_ts:threadTs,team:'T999',blocks}]},
    {channel:'C999',messages:[{ts:'123.456',thread_ts:threadTs,blocks}]},
    {messages:[],has_more:true,response_metadata:{next_cursor:'untrusted-cursor'}},
  ])('blocks wrong/missing thread or source identity without falling back %j',async data=>{
    const {store,row,rows} = await receipt();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(ok(data)))
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(rows.get(row.idempotency_key)!.metadata.state).toBe('delivery_blocked')
    expect(rows.get(row.idempotency_key)!.outcome.canonical).toEqual(canonical)
    expect((await store.pending('staging')).map(r=>r.id)).not.toContain(row.id)
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })
  it.each(['missing_scope','not_allowed_token_type','no_permission','thread_not_found','token_revoked'])('persists actionable %s and returns it on duplicate without automatic retry',async error=>{
    const {store,row,rows} = await receipt()
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({ok:false,error,detail:'xoxb-never-persist-provider-data'})}))
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    const persisted = rows.get(row.idempotency_key)!
    expect(persisted.metadata.state).toBe('delivery_blocked')
    expect(persisted.outcome.deliveryError).toContain('Portfolio')
    expect(JSON.stringify(persisted)).not.toContain('xoxb-')
    const duplicate = await acceptSlackAction({...payload,message:{ts:'123.456',thread_ts:threadTs}} as never,store)
    expect(duplicate.result.text).toContain(canonical.text)
    expect(duplicate.result.text).toContain('Slack card update blocked')
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(fetch).toHaveBeenCalledTimes(1);expect(mocks.execute).toHaveBeenCalledTimes(1)
  })
  it('retries a transient thread lookup failure as feedback only',async()=>{
    const {store,row,rows} = await receipt()
    const fetcher = vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValueOnce(ok({messages:[{ts:'123.456',thread_ts:threadTs,blocks}]})).mockResolvedValueOnce(ok({channel:'C123',ts:'123.456'}))
    vi.stubGlobal('fetch',fetcher)
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(rows.get(row.idempotency_key)!.metadata.state).toBe('outcome')
    rows.get(row.idempotency_key)!.metadata.leaseUntil = new Date(0).toISOString()
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(rows.get(row.idempotency_key)!.outcome.delivery).toBe('delivered')
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })
  it('reconciles ambiguous chat.update against the exact reply marker without replaying the action',async()=>{
    const {store,row,rows} = await receipt()
    let currentBlocks = blocks as unknown[]
    let writes = 0
    vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
      if (String(url).endsWith('conversations.replies')) return ok({messages:[{ts:'123.456',thread_ts:threadTs,blocks:currentBlocks}]})
      writes++
      currentBlocks = JSON.parse(init.body).blocks
      if (writes === 1) throw new Error('Reply changed but response lost')
      return ok({channel:'C123',ts:'123.456'})
    }))
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    rows.get(row.idempotency_key)!.metadata.leaseUntil = new Date(0).toISOString()
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(rows.get(row.idempotency_key)!.outcome.delivery).toBe('delivered')
    expect(currentBlocks).toHaveLength(1)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
  })
  it.each([false,true])('stops retries for a definitively replaced card (thread=%s)',async threaded=>{
    const {store,rows} = memoryStore()
    const input = {...payload,...(threaded ? {message:{ts:'123.456',thread_ts:threadTs}} : {})}
    const row = (await acceptSlackAction(input as never,store)).receipt!
    const replaced = [{type:'section',text:{type:'plain_text',text:'Another card'}},
      {type:'actions',elements:[{type:'button',action_id:'other_action',value:'{}'}]}]
    const snapshot = structuredClone(replaced)
    const fetcher = vi.fn().mockResolvedValue(ok({messages:[{ts:'123.456',...(threaded ? {thread_ts:threadTs} : {}),blocks:replaced}]}))
    vi.stubGlobal('fetch',fetcher)
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    const saved = rows.get(row.idempotency_key)!
    expect(saved.metadata.state).toBe('delivery_blocked')
    expect(saved.outcome.canonical).toEqual(canonical)
    expect(saved.outcome.deliveryError).toContain('no longer on this Slack card')
    expect(await store.pending('staging')).toEqual([])
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe(`https://slack.com/api/conversations.${threaded ? 'replies' : 'history'}`)
    expect(replaced).toEqual(snapshot)
  })
  it.each([undefined,null,{},[null],[{type:'actions'}],[{type:'actions',elements:[null]}]])('does not infer a replaced action from malformed blocks %j',async malformed=>{
    const {store,row,rows} = await receipt()
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(ok({messages:[{ts:'123.456',thread_ts:threadTs,blocks:malformed}]})))
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(rows.get(row.idempotency_key)!.metadata.state).toBe('outcome')
    expect(rows.get(row.idempotency_key)!.outcome.delivery).toBe('failed')
    expect(rows.get(row.idempotency_key)!.outcome.canonical).toEqual(canonical)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('blocks changed source origin and workspace before any Slack call',async()=>{
    const {store,row,rows} = await receipt()
    rows.get(row.idempotency_key)!.metadata.envelope.value.sourceOrigin = 'https://other.example.com'
    await processSlackReceipt(row.idempotency_key,store,mocks.execute,deliver(store))
    expect(fetch).not.toHaveBeenCalled()
    expect(rows.get(row.idempotency_key)!.metadata.state).toBe('delivery_blocked')
  })
})

describe('database adapter', () => {
  function query(data: unknown, error: unknown = null) {
    const q: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['insert','select','single','abortSignal','eq','update','maybeSingle','in','lte','gt','order','limit']) q[method] = vi.fn(() => q)
    q.then = vi.fn((resolve) => Promise.resolve({data,error}).then(resolve))
    mocks.from.mockReturnValue(q)
    return q
  }
  it('CAS filters id, kind, observed updated_at, fence and state', async () => {
    const {store} = memoryStore(); const row = (await acceptSlackAction(payload,store)).receipt!
    const q = query(null)
    expect(await receiptStore.cas(row,row)).toBeNull()
    expect(q.eq.mock.calls).toEqual([['id',row.id],['kind','slack_action_receipt'],['updated_at',row.updated_at],['metadata->>fence',row.metadata.fence],['metadata->>state',row.metadata.state]])
  })
  it('requires an unexpired execution lease to persist the outcome', async () => {
    const {store} = memoryStore(); const row = (await acceptSlackAction(payload,store)).receipt!
    row.metadata.state = 'executing'
    const next = structuredClone(row); next.metadata.state = 'outcome'
    const q = query(null)
    await receiptStore.cas(row,next)
    expect(q.gt).toHaveBeenCalledWith('metadata->>leaseUntil',expect.any(String))
  })
  it('resolves unique-key conflicts to the actual persisted record', async () => {
    const {store} = memoryStore(); const row = (await acceptSlackAction(payload,store)).receipt!
    const duplicate = query(null,{code:'23505'}); const persisted = query({...row,outcome:{canonical}})
    mocks.from.mockReset().mockReturnValueOnce(duplicate).mockReturnValueOnce(persisted)
    expect((await receiptStore.insert(row)).outcome.canonical).toEqual(canonical)
  })
  it('bounded recovery filters environment and expired leases and caps rows at ten', async () => {
    const q = query([]); await receiptStore.pending('staging')
    expect(q.eq).toHaveBeenCalledWith('metadata->envelope->>environment','staging'); expect(q.limit).toHaveBeenCalledWith(10); expect(q.lte).toHaveBeenCalled()
  })
  it('bounded helper propagates errors', async () => { await expect(bounded(Promise.reject(new Error('offline')))).rejects.toThrow('offline') })
})
