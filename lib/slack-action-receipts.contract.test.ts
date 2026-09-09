// @vitest-environment node
// Uses real CC-01 prepare + CC-03 decoder. Downstream operations remain mocked.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))
vi.mock('@/lib/chief-of-staff-chat', () => ({runChiefOfStaffChat:vi.fn()}))
vi.mock('@/lib/agent-run', () => ({recordAgentEvent:vi.fn()}))
vi.mock('@/lib/agent-work-items', () => ({claimAgentWorkItem:vi.fn(),createAgentWorkItem:vi.fn(),getAgentWorkItem:vi.fn(),handoffAgentWorkItem:vi.fn(),markAgentWorkItemReadyForKanban:vi.fn(),recordAgentWorkItemBlocker:vi.fn()}))
vi.mock('@/lib/agent-inbox-routing', () => ({routeAgentInboxItem:vi.fn()}))
vi.mock('@/lib/social-comment-attention', () => ({decideSocialCommentReplyFromSlack:vi.fn()}))
vi.mock('@/lib/social-content-calendar-handoff', () => ({authorizeCalendarDraftHandoff:vi.fn(),rejectCalendarDraftHandoff:vi.fn()}))
vi.mock('@/lib/warm-outreach-slack-send-approval', () => ({decideWarmGmailSendAuthorizationFromSlack:vi.fn()}))
import { prepareSlackAgentAction } from '@/lib/agent-slack-actions'
import { acceptSlackAction, processSlackReceipt, patchActionBlocks, type Receipt, type ReceiptStore } from './slack-action-receipts'
beforeEach(() => {
  vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED','true');vi.stubEnv('SLACK_ACTION_RECEIPTS_ENVIRONMENT','staging')
  vi.stubEnv('VERCEL_ENV','production');vi.stubEnv('APP_ENV','staging');vi.stubEnv('NEXT_PUBLIC_APP_ENV','staging')
  vi.stubEnv('SLACK_AGENT_OPS_STAGING_BASE_URL','https://staging.example.com')
  vi.stubEnv('SLACK_AGENT_OPS_STAGING_CHANNEL_ID','C123')
  vi.stubEnv('SLACK_AGENT_OPS_STAGING_ALLOWED_CHANNEL_IDS','')
  vi.stubEnv('SLACK_AGENT_OPS_PRODUCTION_CHANNEL_ID','CPROD')
  vi.stubEnv('SLACK_AGENT_OPS_PRODUCTION_ALLOWED_CHANNEL_IDS','')
  vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID','T123');vi.stubEnv('SLACK_AGENT_OPS_ALLOWED_USER_IDS','U123')
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Egress forbidden')}))
})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
const provenance = {sourceEnvironment:'staging',sourceOrigin:'https://staging.example.com',schemaVersion:'v1'}
const packets = [
  ...['social_calendar.approve','social_calendar.reject','social_calendar_draft_handoff.approve','social_calendar_draft_handoff.reject'].map(action=>({...provenance,action,calendarItemId:'calendar-1'})),
  ...['warm_gmail_send.approve','warm_gmail_send.revise','warm_gmail_send.reject'].map(action=>({...provenance,action,contactId:42,outreachQueueId:'queue-1',messageVersionKey:'version-1',sendQueueIdempotencyKey:'send-1'})),
  {...provenance,action:'insight.ask_shaka',contentId:'content-1',note:'Review the public source https://example.com/research'},
]
it.each(packets.flatMap(value => [{value,threadTs:undefined},{value,threadTs:'120.001'}]))('preserves real validated $value.action schema and thread $threadTs through receipt execution',async ({value,threadTs})=>{
  let saved: Receipt | null = null
  const store: ReceiptStore = {
    insert:vi.fn(async row=>{saved=structuredClone(row);return structuredClone(row)}),
    get:vi.fn(async()=>saved && structuredClone(saved)),
    cas:vi.fn(async(row,next)=>{expect(saved?.metadata.fence).toBe(row.metadata.fence);saved=structuredClone(next);return structuredClone(next)}),
    pending:vi.fn(async()=>[]),
  }
  const payload = {type:'block_actions',team:{id:'T123'},channel:{id:'C123'},container:{message_ts:'123.456',channel_id:'C123'},user:{id:'U123'},message:{ts:'123.456',...(threadTs ? {thread_ts:threadTs} : {})},actions:[{action_id:'decision',value:JSON.stringify(value)}]}
  const original = prepareSlackAgentAction(payload)
  expect(original.ok).toBe(true)
  const accepted = await acceptSlackAction(payload,store)
  expect(accepted.receipt?.metadata.envelope.value).toEqual(value)
  const execute = vi.fn(async reconstructed=>{
    expect(reconstructed.message?.thread_ts).toBe(threadTs)
    const prepared = prepareSlackAgentAction(reconstructed)
    expect(prepared).toEqual(original)
    return {responseType:'ephemeral' as const,text:'Decision recorded',actionStatus:'completed' as const}
  })
  await processSlackReceipt(accepted.receipt!.idempotency_key,store,execute,async()=>{})
  expect(execute).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
})
it('rejects an unapproved channel before recording a receipt', async () => {
  const store: ReceiptStore = { insert: vi.fn(), get: vi.fn(), cas: vi.fn(), pending: vi.fn() }
  const payload = { type: 'block_actions', team: { id: 'T123' }, channel: { id: 'COTHER' }, container: { message_ts: '123.456', channel_id: 'COTHER' }, user: { id: 'U123' }, message: { ts: '123.456' }, actions: [{ action_id: 'decision', value: JSON.stringify(packets[0]) }] }
  const result = await acceptSlackAction(payload, store)
  expect(result.receipt).toBeUndefined()
  expect(store.insert).not.toHaveBeenCalled()
  expect(store.get).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})
it('preserves a newer Gmail decision version while removing obsolete sibling decisions',async()=>{
  const value = packets.find(p=>p.action === 'warm_gmail_send.approve')!
  const row = {id:'r1',metadata:{envelope:{value,actionId:'approve'}},outcome:{canonical:{responseType:'ephemeral',text:'Recorded',actionStatus:'completed'}}} as Receipt
  const button = (action:string,version='version-1')=>({type:'button',action_id:action.endsWith('approve')?'approve':action,value:JSON.stringify({...value,action,messageVersionKey:version})})
  const next = patchActionBlocks([{type:'actions',elements:[button('warm_gmail_send.approve'),button('warm_gmail_send.reject'),button('warm_gmail_send.revise'),button('warm_gmail_send.approve','version-2')]}],row)
  expect(next[0].elements).toEqual([button('warm_gmail_send.approve','version-2')])
})
