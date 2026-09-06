import { createHash, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { prepareSlackAgentAction, handleSlackAgentAction, type SlackInteractivePayload } from '@/lib/agent-slack-actions'
import { getSlackAgentSource } from '@/lib/slack-agent-environment'
import type { SlackAgentActionValue } from '@/lib/agent-slack-blocks'

export const SLACK_RECEIPT_KIND = 'slack_action_receipt'
const LEASE_MS = 120_000
const DB_MS = 1_200
export type ActionOutcome = { responseType: 'ephemeral' | 'in_channel'; text: string; actionStatus?: 'completed' | 'already_recorded' | 'blocked' | 'failed' }
type ReceiptActionValue = SlackAgentActionValue & { sourceEnvironment?: string; sourceOrigin?: string }
type Envelope = { environment: string; team: string; channel: string; user: string; ts: string; actionId: string; value: ReceiptActionValue }
type State = 'queued' | 'claimed' | 'executing' | 'outcome' | 'delivering' | 'delivered' | 'reconciliation_required' | 'message_lock'
export type Receipt = {
  id: string; idempotency_key: string; updated_at: string; status: string
  metadata: { envelope: Envelope; state: State; fence: string; leaseUntil: string; attempts: number }
  outcome: { canonical?: ActionOutcome; delivery?: 'failed' | 'delivered'; deliveryError?: string }
}
export interface ReceiptStore {
  insert(row: Receipt): Promise<Receipt>
  get(key: string): Promise<Receipt | null>
  cas(row: Receipt, next: Receipt): Promise<Receipt | null>
  pending(environment: string): Promise<Receipt[]>
}

export function receiptEnvironment(): string | null {
  if (process.env.SLACK_ACTION_RECEIPTS_ENABLED !== 'true') return null
  try {
    const source = getSlackAgentSource()
    return source.hosted && process.env.SLACK_ACTION_RECEIPTS_ENVIRONMENT === source.sourceEnvironment ? source.sourceEnvironment : null
  } catch { return null }
}

export async function bounded<T>(operation: PromiseLike<T>, ms = DB_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([Promise.resolve(operation), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Receipt operation timed out')), ms)
    })])
  } finally { clearTimeout(timer) }
}

function table() {
  if (!supabaseAdmin) throw new Error('Receipt database unavailable')
  return supabaseAdmin.from('agent_runs')
}
const fields = 'id,idempotency_key,updated_at,status,metadata,outcome'
export const receiptStore: ReceiptStore = {
  async insert(row) {
    const { data, error } = await bounded<{ data: unknown; error: { code?: string } | null }>(table().insert({ ...row, runtime: 'manual', kind: SLACK_RECEIPT_KIND,
      title: 'Slack action receipt', current_step: row.metadata.state, trigger_source: 'slack_interaction' })
      .select(fields).single().abortSignal(AbortSignal.timeout(DB_MS)))
    if (error?.code === '23505') {
      const existing = await this.get(row.idempotency_key)
      if (existing) return existing
    }
    if (error || !data) throw new Error('Receipt save unconfirmed')
    return data as Receipt
  },
  async get(key) {
    const { data, error } = await bounded<{ data: unknown; error: { code?: string } | null }>(table().select(fields).eq('kind', SLACK_RECEIPT_KIND)
      .eq('idempotency_key', key).maybeSingle().abortSignal(AbortSignal.timeout(DB_MS)))
    if (error) throw new Error('Receipt read failed')
    return data as Receipt | null
  },
  async cas(row, next) {
    let query = table().update({ metadata: next.metadata, outcome: next.outcome,
      status: next.status, updated_at: next.updated_at, current_step: next.metadata.state })
      .eq('id', row.id).eq('kind', SLACK_RECEIPT_KIND).eq('updated_at', row.updated_at)
      .eq('metadata->>fence', row.metadata.fence).eq('metadata->>state', row.metadata.state)
    const ownedWrite = (row.metadata.state === 'claimed' && next.metadata.state !== 'claimed') ||
      (row.metadata.state === 'executing' && next.metadata.state !== 'reconciliation_required') ||
      (row.metadata.state === 'delivering' && next.metadata.state !== 'delivering')
    if (ownedWrite) query = query.gt('metadata->>leaseUntil', new Date().toISOString())
    const { data, error } = await bounded<{ data: unknown; error: { code?: string } | null }>(
      query.select(fields).maybeSingle().abortSignal(AbortSignal.timeout(DB_MS)))
    if (error) throw new Error('Receipt transition unconfirmed')
    return data as Receipt | null
  },
  async pending(environment) {
    const { data, error } = await bounded<{ data: unknown; error: { code?: string } | null }>(table().select(fields).eq('kind', SLACK_RECEIPT_KIND)
      .eq('metadata->envelope->>environment', environment)
      .in('metadata->>state', ['queued', 'claimed', 'executing', 'outcome', 'delivering'])
      .lte('metadata->>leaseUntil', new Date().toISOString()).order('updated_at').limit(10)
      .abortSignal(AbortSignal.timeout(DB_MS)))
    if (error) throw new Error('Receipt recovery read failed')
    return (data || []) as Receipt[]
  },
}

function payloadFor(e: Envelope): SlackInteractivePayload {
  return { type: 'block_actions', team: { id: e.team }, channel: { id: e.channel }, user: { id: e.user },
    container: { channel_id: e.channel, message_ts: e.ts }, message: { ts: e.ts },
    actions: [{ action_id: e.actionId, value: JSON.stringify(e.value) }] } as SlackInteractivePayload
}
function envelopeFor(payload: SlackInteractivePayload, value: ReceiptActionValue, environment: string): Envelope {
  const p = payload as SlackInteractivePayload & { team?: { id?: string }; channel?: { id?: string }; container?: { channel_id?: string } }
  const team = p.team?.id, channel = p.channel?.id || p.container?.channel_id, user = p.user?.id
  const ts = p.container?.message_ts || p.message?.ts, actionId = p.actions?.[0]?.action_id
  if (p.type !== 'block_actions' || p.actions?.length !== 1 || !team || !channel || !user || !ts || !actionId ||
    !/^[A-Z0-9]{2,32}$/.test(team) || !/^[A-Z0-9]{2,32}$/.test(channel) || !/^[A-Z0-9]{2,32}$/.test(user) ||
    !/^\d{1,20}\.\d{1,10}$/.test(ts) || !/^[\w.:-]{1,255}$/.test(actionId) ||
    (p.channel?.id && p.container?.channel_id && p.channel.id !== p.container.channel_id)) throw new Error('Invalid receipt envelope')
  const source = getSlackAgentSource()
  if (value.sourceEnvironment !== source.sourceEnvironment || value.sourceOrigin !== source.sourceOrigin) throw new Error('Receipt source mismatch')
  const minimal: ReceiptActionValue = { action: value.action, sourceEnvironment: value.sourceEnvironment, sourceOrigin: value.sourceOrigin }
  for (const key of ['schemaVersion', 'approvalId', 'runId', 'workItemId', 'agentKey', 'contentId', 'calendarItemId', 'commentId', 'outreachQueueId', 'messageVersionKey', 'sendQueueIdempotencyKey', 'note'] as const) {
    const item = value[key]
    if (item !== undefined) {
      if (typeof item !== 'string' || item.length > (key === 'note' ? 3000 : 500) || /xox[baprs]-|hooks\.slack\.com\/|-----BEGIN .*PRIVATE KEY-----/i.test(item)) throw new Error('Unsafe receipt field')
      minimal[key] = item
    }
  }
  if (value.contactId !== undefined) {
    if (!Number.isSafeInteger(value.contactId) || value.contactId <= 0) throw new Error('Invalid receipt contact')
    minimal.contactId = value.contactId
  }
  return { environment, team, channel, user, ts, actionId, value: minimal }
}

export async function acceptSlackAction(payload: SlackInteractivePayload, store = receiptStore) {
  // Pure authorization and action-specific validation MUST precede even a duplicate lookup.
  const prepared = prepareSlackAgentAction(payload)
  if (!prepared.ok) return { result: prepared.result as ActionOutcome }
  const environment = receiptEnvironment()
  if (!environment) return { result: { responseType: 'ephemeral', text: 'Slack action processing is disabled. Open Portfolio to continue.', actionStatus: 'blocked' } as ActionOutcome }
  const envelope = envelopeFor(payload, prepared.value, environment)
  const reconstructed = prepareSlackAgentAction(payloadFor(envelope))
  if (!reconstructed.ok || reconstructed.key !== prepared.key) throw new Error('Receipt authorization contract mismatch')
  const key = 'slack-receipt:' + createHash('sha256').update(JSON.stringify([environment, envelope.team, envelope.channel, prepared.key])).digest('hex')
  const now = new Date().toISOString()
  const row = await bounded(store.insert({ id: randomUUID(), idempotency_key: key, updated_at: now, status: 'queued',
    metadata: { envelope, state: 'queued', fence: randomUUID(), leaseUntil: now, attempts: 0 }, outcome: {} }))
  return { receipt: row, result: receiptAcknowledgement(row) }
}
export function receiptAcknowledgement(row: Receipt): ActionOutcome {
  if (row.outcome.canonical) return row.outcome.canonical
  const text = row.metadata.state === 'reconciliation_required'
    ? 'Action outcome is uncertain. Review in Portfolio before trying again.'
    : row.metadata.state === 'executing' ? 'Saved action is executing; completion is not yet confirmed.'
      : 'Action saved and queued for processing. Completion is not yet confirmed.'
  return { responseType: 'ephemeral', text }
}
function transition(row: Receipt, state: State, now: number, extras: Partial<Receipt> = {}): Receipt {
  return { ...row, ...extras, updated_at: new Date(Math.max(now, Date.parse(row.updated_at) + 1)).toISOString(),
    metadata: { ...row.metadata, state, fence: randomUUID(), leaseUntil: new Date(now + LEASE_MS).toISOString() } }
}

export async function processSlackReceipt(key: string, store = receiptStore,
  execute: (payload: SlackInteractivePayload) => Promise<ActionOutcome> = handleSlackAgentAction,
  deliver: (row: Receipt) => Promise<void> = row => deliverSlackReceipt(row, store)) {
  const environment = receiptEnvironment()
  if (!environment) return
  let row = await store.get(key)
  if (!row || row.metadata.envelope.environment !== environment) return
  const now = Date.now()
  const state = row.metadata.state
  if (state === 'delivered' || state === 'reconciliation_required' || state === 'message_lock') return
  if (state !== 'queued' && Date.parse(row.metadata.leaseUntil) > now) return
  if (state === 'executing') {
    await store.cas(row, transition(row, 'reconciliation_required', now, { status: 'waiting_for_approval' }))
    return // Never replay a canonical mutation whose completion is uncertain.
  }
  if (state === 'queued' || state === 'claimed') {
    row = await store.cas(row, transition(row, 'claimed', now, { status: 'running' }))
    if (!row) return
    const payload = payloadFor(row.metadata.envelope)
    const prepared = prepareSlackAgentAction(payload)
    if (!prepared.ok) {
      row = await store.cas(row, transition(row, 'outcome', Date.now(), { outcome: { canonical: prepared.result }, status: 'completed' }))
    } else {
      row = await store.cas(row, transition(row, 'executing', Date.now()))
      if (!row) return
      let result: ActionOutcome
      try { result = await execute(payload) } catch {
        await store.cas(row, transition(row, 'reconciliation_required', Date.now(), { status: 'waiting_for_approval' }))
        return
      }
      // A lost/failed outcome write leaves executing, so recovery requires reconciliation.
      row = await store.cas(row, transition(row, 'outcome', Date.now(), { outcome: { canonical: {
        responseType: result.responseType, text: result.text, ...(result.actionStatus ? { actionStatus: result.actionStatus } : {}),
      } }, status: 'completed' }))
    }
    if (!row) return
  }
  if (!row.outcome.canonical) return
  const delivery = transition(row, 'delivering', Date.now())
  delivery.metadata.attempts++
  row = await store.cas(row, delivery)
  if (!row) return
  try {
    await deliver(row)
  } catch {
    const failed = transition(row, 'outcome', Date.now(), { outcome: { ...row.outcome, delivery: 'failed', deliveryError: 'Slack feedback unconfirmed' } })
    failed.metadata.leaseUntil = new Date(Date.now() + Math.min(3600_000, LEASE_MS * 2 ** Math.min(row.metadata.attempts, 5))).toISOString()
    await store.cas(row, failed)
    return
  }
  await store.cas(row, transition(row, 'delivered', Date.now(), { outcome: { ...row.outcome, delivery: 'delivered' } }))
}

// Slack has no conditional chat.update. Fresh reads preserve unrelated cards, but concurrent
// updates by other writers still require reconciliation; this is not an exactly-once guarantee.
type Block = { type: string; block_id?: string; elements?: Array<Record<string, unknown>>; [key: string]: unknown }
export function patchActionBlocks(blocks: Block[], row: Receipt): Block[] {
  const e = row.metadata.envelope
  const marker = `receipt_${row.id}`
  const result = row.outcome.canonical!
  const success = result.actionStatus === 'completed' || result.actionStatus === 'already_recorded'
  const sameGate = (candidate: Record<string, unknown>) => {
    const action = candidate.action
    const target = e.value
    if (candidate.schemaVersion !== target.schemaVersion || candidate.messageVersionKey !== target.messageVersionKey || candidate.sendQueueIdempotencyKey !== target.sendQueueIdempotencyKey) return false
    // Only mutually exclusive decision families become obsolete together.
    if (target.action.startsWith('approval.') && ['approval.approve', 'approval.reject', 'approval.revision'].includes(target.action)) {
      return ['approval.approve', 'approval.reject', 'approval.revision'].includes(String(action)) && candidate.approvalId === target.approvalId
    }
    if (target.action.startsWith('social_comment_reply.')) {
      return ['social_comment_reply.approve', 'social_comment_reply.reject'].includes(String(action)) && candidate.commentId === target.commentId
    }
    if (['social_calendar.approve', 'social_calendar.reject', 'social_calendar_draft_handoff.approve', 'social_calendar_draft_handoff.reject'].includes(target.action)) {
      return String(action).split('.')[0] === target.action.split('.')[0] && ['approve', 'reject'].includes(String(action).split('.')[1]) && candidate.calendarItemId === target.calendarItemId
    }
    if (target.action.startsWith('warm_gmail_send.')) {
      return ['warm_gmail_send.approve', 'warm_gmail_send.reject', 'warm_gmail_send.revise'].includes(String(action)) && candidate.contactId === target.contactId && candidate.outreachQueueId === target.outreachQueueId
    }
    return false
  }
  const matches = (button: Record<string, unknown>, siblings = false) => {
    if (typeof button.value !== 'string') return false
    try {
      const value = JSON.parse(button.value)
      if (siblings && sameGate(value) && value.sourceEnvironment === e.value.sourceEnvironment && value.sourceOrigin === e.value.sourceOrigin) return true
      return button.action_id === e.actionId && Object.entries(e.value).every(([key, item]) => value[key] === item)
    } catch { return false }
  }
  const index = blocks.findIndex(block => block.type === 'actions' && block.elements?.some(button => matches(button)))
  const existing = blocks.findIndex(block => block.block_id === marker)
  if (index < 0 && existing < 0) throw new Error('Affected Slack action not found')
  const feedback: Block = { type: 'context', block_id: marker, elements: [{ type: 'plain_text', text:
    result.actionStatus ? `Action ${result.actionStatus.replace('_', ' ')}. ${result.text}`.slice(0, 2000)
      : `Action response (completion unconfirmed): ${result.text}`.slice(0, 2000) }] }
  const output: Block[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.block_id === marker) { if (index < 0) output.push(feedback); continue }
    if (i !== index) { output.push(block); continue }
    const elements = success ? block.elements!.filter(button => !matches(button, true)) : block.elements!
    if (elements.length) output.push({ ...block, elements })
    output.push(feedback)
  }
  if (output.length > 50) throw new Error('Slack block limit')
  return output
}
async function slack(method: string, body: Record<string, unknown>) {
  const environment = receiptEnvironment()
  if (!environment) throw new Error('Receipt delivery disabled')
  const token = process.env[`SLACK_AGENT_OPS_${environment.toUpperCase()}_BOT_TOKEN`] ||
    (environment === 'production' ? process.env.SLACK_BOT_TOKEN : undefined)
  if (!token) throw new Error('Slack token unavailable')
  const response = await fetch(`https://slack.com/api/${method}`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('Slack HTTP failure')
  const data = await response.json()
  if (data?.ok !== true) throw new Error('Slack API failure')
  return data
}
export async function withSlackMessageLease(row: Receipt, store: ReceiptStore, work: () => Promise<void>) {
  const e = row.metadata.envelope
  const key = 'slack-message-lock:' + createHash('sha256').update(JSON.stringify([e.environment, e.team, e.channel, e.ts])).digest('hex')
  const epoch = new Date(0).toISOString()
  const lock = await store.insert({ ...row, id: randomUUID(), idempotency_key: key, status: 'completed', outcome: {},
    metadata: { ...row.metadata, state: 'message_lock', fence: randomUUID(), leaseUntil: epoch, attempts: 0 } })
  if (Date.parse(lock.metadata.leaseUntil) > Date.now()) throw new Error('Slack message feedback already claimed')
  const owned = await store.cas(lock, transition(lock, 'message_lock', Date.now()))
  if (!owned) throw new Error('Slack message feedback claim lost')
  try { await work() } finally {
    const released = transition(owned, 'message_lock', Date.now())
    released.metadata.leaseUntil = epoch
    await store.cas(owned, released)
  }
}
export async function deliverSlackReceipt(row: Receipt, store = receiptStore) {
  const { channel, ts, environment, value } = row.metadata.envelope
  const source = getSlackAgentSource()
  if (receiptEnvironment() !== environment || source.sourceOrigin !== value.sourceOrigin) throw new Error('Receipt delivery source mismatch')
  await withSlackMessageLease(row, store, async () => {
    const current = await slack('conversations.history', { channel, latest: ts, inclusive: true, limit: 1 })
    const message = current.messages?.find((item: { ts?: string }) => item.ts === ts)
    if (!message || !Array.isArray(message.blocks)) throw new Error('Slack message unavailable')
    const blocks = patchActionBlocks(message.blocks, row)
    const updated = await slack('chat.update', { channel, ts, blocks })
    if (updated.channel !== channel || updated.ts !== ts) throw new Error('Slack update receipt missing')
  })
}
export async function recoverSlackReceipts(store = receiptStore) {
  const environment = receiptEnvironment()
  if (!environment) return { enabled: false, checked: 0, failed: 0 }
  const rows = await store.pending(environment)
  let failed = 0
  await Promise.all(rows.map(row => processSlackReceipt(row.idempotency_key, store).catch(() => { failed++ })))
  return { enabled: true, checked: rows.length, failed }
}
