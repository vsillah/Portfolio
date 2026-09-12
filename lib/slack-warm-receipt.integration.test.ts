// @vitest-environment node
// Real decoder, authorization, action adapter and receipt worker; in-memory DB and Slack transport.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/chief-of-staff-chat', () => ({ runChiefOfStaffChat: vi.fn() }))
vi.mock('@/lib/agent-run', () => ({ recordAgentEvent: vi.fn() }))
vi.mock('@/lib/agent-work-items', () => ({ claimAgentWorkItem: vi.fn(), createAgentWorkItem: vi.fn(), getAgentWorkItem: vi.fn(), handoffAgentWorkItem: vi.fn(), markAgentWorkItemReadyForKanban: vi.fn(), recordAgentWorkItemBlocker: vi.fn() }))
vi.mock('@/lib/agent-inbox-routing', () => ({ routeAgentInboxItem: vi.fn() }))
import { warmFinalCopyFingerprint } from './warm-outreach-copy-fingerprint'
import { acceptSlackAction, processSlackReceipt, patchActionBlocks, type Receipt, type ReceiptStore } from './slack-action-receipts'
import { handleSlackAgentAction } from './agent-slack-actions'

beforeEach(() => {
  vi.resetAllMocks()
  for (const [key, value] of Object.entries({
    SLACK_ACTION_RECEIPTS_ENABLED: 'true', SLACK_ACTION_RECEIPTS_ENVIRONMENT: 'staging',
    VERCEL_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging',
    SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.com', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'C123',
    SLACK_AGENT_OPS_STAGING_ALLOWED_CHANNEL_IDS: '', SLACK_AGENT_OPS_PRODUCTION_CHANNEL_ID: 'CPROD',
    SLACK_AGENT_OPS_PRODUCTION_ALLOWED_CHANNEL_IDS: '', SLACK_AGENT_OPS_TEAM_ID: 'T123', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123',
    ENABLE_WARM_GMAIL_SEND_EXECUTION: 'false', SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED: 'false',
  })) vi.stubEnv(key, value)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Egress forbidden') }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it.each([['approve', 'approved'], ['reject', 'rejected'], ['revise', 'revision_requested']])(
  'persists warm Gmail %s and receipt once across duplicate actions, preserving disabled execution', async (action, status) => {
    const copy = { id: 'queue-1', contact_submission_id: 42, subject: 'Hello', body: 'Body text',
      updated_at: '2026-09-08T00:00:00.000Z', contact_submissions: { email: 'qa@example.invalid' } }
    const fingerprint = warmFinalCopyFingerprint(copy)
    let inputs: Record<string, any> = {
      gmail_draft_creation: { draft_id: 'fixture-draft', final_copy_fingerprint: fingerprint },
      warm_gmail_send_slack_approval_request: { request_key: 'request-1', contact_submission_id: 42, outreach_queue_id: 'queue-1',
        gmail_draft_id: 'fixture-draft', message_version_key: fingerprint, final_copy_fingerprint: fingerprint,
        lifecycle_message_version_key: 'version-1', send_queue_idempotency_key: 'send-1', records_authorization_intent_only: true,
        gmail_send_called: false, external_send_performed: false },
    }
    const update = vi.fn((body) => { inputs = body.generation_inputs })
    mocks.from.mockImplementation(table => {
      if (!['outreach_queue', 'agent_run_events'].includes(table)) throw new Error(`Unexpected table ${table}`)
      const query: any = {
        select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: table === 'agent_run_events' ? null : { ...copy, channel: 'email', status: 'approved', generation_inputs: inputs }, error: null }),
        update: (body: unknown) => { update(body); return query },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ id: 'queue-1' }], error: null }).then(resolve),
      }
      return query
    })
    const rows = new Map<string, Receipt>()
    const store: ReceiptStore = {
      insert: async row => { if (!rows.has(row.idempotency_key)) rows.set(row.idempotency_key, structuredClone(row)); return structuredClone(rows.get(row.idempotency_key)!) },
      get: async key => rows.has(key) ? structuredClone(rows.get(key)!) : null,
      cas: async (row, next) => {
        if (rows.get(row.idempotency_key)?.metadata.fence !== row.metadata.fence) return null
        rows.set(row.idempotency_key, structuredClone(next)); return structuredClone(next)
      }, pending: async () => [],
    }
    const value = { action: `warm_gmail_send.${action}`, schemaVersion: 'v1', sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.com',
      contactId: 42, outreachQueueId: 'queue-1', messageVersionKey: fingerprint, sendQueueIdempotencyKey: 'send-1' }
    const buttons = ['approve', 'reject', 'revise'].map(decision => ({ type: 'button', action_id: decision, value: JSON.stringify({ ...value, action: `warm_gmail_send.${decision}` }) }))
    const payload = { type: 'block_actions', team: { id: 'T123' }, channel: { id: 'C123' }, user: { id: 'U123' },
      container: { message_ts: '123.456', channel_id: 'C123' }, actions: [{ action_id: action, value: JSON.stringify(value) }] }
    const accepted = await acceptSlackAction(payload, store)
    const key = accepted.receipt!.idempotency_key
    expect(accepted.result.text).toContain(`/admin/agents/runs/${accepted.receipt!.id}`)
    const deliver = vi.fn(async (row: Receipt) => {
      expect(rows.get(key)?.outcome.canonical?.actionStatus).toBe('completed')
      const patched = patchActionBlocks([{ type: 'actions', elements: buttons }], row)
      expect(patched.some(block => block.type === 'actions')).toBe(false)
      expect(JSON.stringify(patched)).toContain('Action completed')
    })
    await Promise.all([processSlackReceipt(key, store, handleSlackAgentAction, deliver), processSlackReceipt(key, store, handleSlackAgentAction, deliver)])
    const duplicate = await acceptSlackAction(payload, store)
    await processSlackReceipt(key, store, handleSlackAgentAction, deliver)
    expect(update).toHaveBeenCalledOnce()
    expect(deliver).toHaveBeenCalledOnce()
    expect(duplicate.receipt?.id).toBe(accepted.receipt!.id)
    expect(duplicate.result.text).toContain('Slack card updated')
    expect(rows.get(key)?.outcome.canonical?.actionStatus).toBe('completed')
    expect(inputs.warm_gmail_send_authorization).toMatchObject({ status, provider_execution_enabled: false,
      external_send_enabled: false, gmail_send_called: false, external_send_performed: false })
    expect(inputs.warm_gmail_send_authorization_history).toHaveLength(1)
    expect(fetch).not.toHaveBeenCalled()
  },
)
