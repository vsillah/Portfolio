import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabase'
import { getSlackAgentSource, getSlackAgentDeliveryConfig } from './slack-agent-environment'
import { allowedSlackUserIds, requireAuthorizedSlackChannel } from './slack-agent-access'
import { postToSlack, type SlackDeliveryResult } from './agent-slack-delivery'
import { campaignReleaseSlackBlocks } from './campaign-release-slack'
import { assertCurrentCampaignSources, CAMPAIGN_RELEASE_KIND, getCampaignRelease } from './campaign-release-store'
import { decideCampaignRelease, releaseHash, type ReleaseDecision, type ReleaseRecord } from './campaign-release-manifest'
import type { Receipt } from './slack-action-receipts'

export const CAMPAIGN_SLACK_KIND = 'campaign_slack_dispatch'
export type CampaignSlackIntent = {
  id: string; key: string; releaseId: string; hash: string; version: number; campaignId: string
  sourceEnvironment: string; sourceOrigin: string; team: string; channel: string; actor: string
  state: 'prepared' | 'sending' | 'sent' | 'unconfirmed' | 'rejected'; ts?: string
}
export type CampaignSlackDecision = {
  releaseId: string; hash: string; version: number; intentId: string; decision: ReleaseDecision
  actor: string; team: string; channel: string; ts: string; sourceEnvironment: string; sourceOrigin: string; commandKey: string
}
type SignedRecord = ReleaseRecord & { slackDecision?: CampaignSlackDecision }
export interface CampaignSlackStore {
  release(id: string): Promise<SignedRecord>
  sources(record: ReleaseRecord): Promise<void>
  intent(id: string): Promise<CampaignSlackIntent | null>
  insert(intent: CampaignSlackIntent): Promise<CampaignSlackIntent>
  transition(intent: CampaignSlackIntent, next: CampaignSlackIntent): Promise<CampaignSlackIntent | null>
  decide(current: ReleaseRecord, next: SignedRecord): Promise<boolean>
}
const table = () => {
  if (!supabaseAdmin) throw new Error('Campaign Slack storage unavailable.')
  return supabaseAdmin.from('agent_runs')
}
export const campaignSlackStore: CampaignSlackStore = {
  release: getCampaignRelease,
  sources: record => assertCurrentCampaignSources(record.manifest),
  async intent(id) {
    const { data, error } = await table().select('metadata').eq('kind', CAMPAIGN_SLACK_KIND).eq('id', id).maybeSingle()
    if (error) throw new Error('Dispatch read unconfirmed.')
    return data?.metadata as CampaignSlackIntent | null
  },
  async insert(intent) {
    const { data, error } = await table().insert({ id: intent.id, kind: CAMPAIGN_SLACK_KIND, runtime: 'manual',
      title: 'Campaign Slack review', subject_type: 'campaign', subject_id: intent.campaignId, trigger_source: 'portfolio',
      status: 'waiting_for_approval', current_step: 'Slack dispatch intent only', idempotency_key: intent.key, metadata: intent,
      outcome: { providerExecutionEnabled: false } }).select('metadata').single()
    if (error?.code === '23505') {
      const existing = await table().select('metadata').eq('kind', CAMPAIGN_SLACK_KIND).eq('idempotency_key', intent.key).single()
      if (!existing.error && existing.data) return existing.data.metadata as CampaignSlackIntent
    }
    if (error || !data) throw new Error('Dispatch intent save unconfirmed. Refresh before retrying.')
    return data.metadata as CampaignSlackIntent
  },
  async transition(intent, next) {
    const { data, error } = await table().update({ metadata: next, current_step: `Slack ${next.state}` })
      .eq('kind', CAMPAIGN_SLACK_KIND).eq('id', intent.id).eq('metadata->>state', intent.state)
      .select('metadata').maybeSingle()
    if (error) throw new Error('Dispatch save unconfirmed. Reconcile the original card; do not resend.')
    return data ? data.metadata as CampaignSlackIntent : null
  },
  async decide(current, next) {
    const { data, error } = await table().update({ metadata: next, status: next.state === 'stopped' ? 'cancelled' : 'waiting_for_approval',
      current_step: `${next.state}; provider execution unavailable` })
      .eq('id', current.manifest.releaseId).eq('kind', CAMPAIGN_RELEASE_KIND).eq('metadata->>hash', current.hash)
      .eq('metadata->>version', String(current.version)).select('id').maybeSingle()
    if (error) throw new Error('Decision write unconfirmed. Inspect the receipt before retrying.')
    return Boolean(data)
  },
}

export function campaignSlackDispatchGate(): { enabled: boolean; reason: string } {
  try {
    const source = getSlackAgentSource()
    if (!source.hosted || process.env.CAMPAIGN_SLACK_DISPATCH_ENABLED !== 'true') return { enabled: false,
      reason: 'Slack dispatch is disabled. Ask the Integration Captain to qualify the signed callback canary and enable campaign review dispatch for this environment.' }
    if (process.env.SLACK_ACTION_RECEIPTS_ENABLED !== 'true' || process.env.SLACK_ACTION_RECEIPTS_ENVIRONMENT !== source.sourceEnvironment || !process.env.SLACK_SIGNING_SECRET) {
      return { enabled: false, reason: 'Configure signed callbacks and the source-environment receipt worker, then refresh.' }
    }
    const config = getSlackAgentDeliveryConfig()
    if (!/^[A-Z0-9]{2,32}$/.test(process.env.SLACK_AGENT_OPS_TEAM_ID ?? '') || !allowedSlackUserIds().size || !requireAuthorizedSlackChannel(config.channel).ok) {
      return { enabled: false, reason: 'Verify the Agent Ops workspace, operator allowlist and source channel, then refresh.' }
    }
    return { enabled: true, reason: 'Routes this exact release for one Slack decision. Provider execution remains disabled.' }
  } catch (error) {
    return { enabled: false, reason: error instanceof Error ? error.message : 'Verify Slack source configuration, then refresh.' }
  }
}

function requireCurrent(record: ReleaseRecord, hash: string, version: number) {
  if (record.hash !== hash || releaseHash(record.manifest) !== hash || record.version !== version ||
    record.state !== 'pending' || Date.parse(record.manifest.createdAt) > Date.now() ||
    Date.parse(record.manifest.expiresAt) <= Date.now() ||
    record.manifest.actions.some(action => Date.parse(action.evidenceExpiresAt) <= Date.now())) throw new Error('Release changed or expired. Refresh and prepare a fresh packet.')
}

/** Admin-authenticated entry point. Preparing never sends; dispatch additionally requires all environment gates. */
export async function routeCampaignToSlack(input: { campaignId: string; releaseId: string; hash: string; version: number; actor: string; dispatch: boolean },
  store = campaignSlackStore, send = postToSlack) {
  const record = await store.release(input.releaseId)
  if (record.manifest.campaignId !== input.campaignId) throw new Error('Campaign mismatch.')
  requireCurrent(record, input.hash, input.version)
  await store.sources(record)
  const source = getSlackAgentSource()
  const prefix = `SLACK_AGENT_OPS_${source.sourceEnvironment.toUpperCase()}`
  const team = process.env.SLACK_AGENT_OPS_TEAM_ID?.trim() ?? ''
  const channel = process.env[`${prefix}_CHANNEL_ID`] || (source.sourceEnvironment === 'production' ? process.env.SLACK_AGENT_OPS_CHANNEL_ID : '') || ''
  // One dispatch identity per source/release/version. Changing config never grants a resend.
  const key = `campaign-slack:${releaseHash([source.sourceEnvironment, source.sourceOrigin, input.releaseId, input.hash, input.version])}`
  let intent = await store.insert({ id: randomUUID(), key, releaseId: input.releaseId, hash: input.hash, version: input.version,
    campaignId: input.campaignId, ...source, team, channel, actor: input.actor, state: 'prepared' })
  const gate = campaignSlackDispatchGate()
  if (!input.dispatch || !gate.enabled || intent.state !== 'prepared') return { intent, gate, sent: false }
  const config = getSlackAgentDeliveryConfig()
  // Configuration may be completed after preparation, but only before the one-way send claim.
  const claimed = await store.transition(intent, { ...intent, team, channel: config.channel, state: 'sending' })
  if (!claimed) throw new Error('Dispatch already claimed. Refresh; do not resend.')
  intent = claimed
  let delivery: SlackDeliveryResult
  try {
    // Recheck after the durable claim. A crash retains sending and cannot dispatch again.
    const current = await store.release(input.releaseId)
    requireCurrent(current, input.hash, input.version)
    await store.sources(current)
    if (!campaignSlackDispatchGate().enabled) throw new Error('Dispatch disabled after claim.')
    delivery = await send('Campaign release review · provider execution remains gated', campaignReleaseSlackBlocks(current, intent.id), config)
  } catch {
    delivery = { sent: false, uncertain: true, mode: 'none', reason: 'Dispatch unconfirmed. Reconcile before any new card.' }
  }
  const sent = delivery.sent && delivery.channel === intent.channel && /^\d+\.\d+$/.test(delivery.ts ?? '')
  const next: CampaignSlackIntent = { ...intent, state: sent ? 'sent' : delivery.uncertain || delivery.sent ? 'unconfirmed' : 'rejected', ...(sent ? { ts: delivery.ts! } : {}) }
  const saved = await store.transition(intent, next)
  if (!saved) throw new Error('Dispatch outcome unconfirmed. Refresh and reconcile the original card.')
  return { intent: saved, gate, sent: Boolean(sent) }
}

/** Called only by the signed, allowlisted receipt worker. No provider adapter is reachable here. */
export async function decideCampaignSlackRelease(input: CampaignSlackDecision, store = campaignSlackStore) {
  const blocked = (text: string) => ({ status: 'blocked' as const, text })
  const intent = await store.intent(input.intentId)
  if (!intent || intent.state !== 'sent' || intent.releaseId !== input.releaseId || intent.hash !== input.hash || intent.version !== input.version ||
    intent.team !== input.team || intent.channel !== input.channel || intent.ts !== input.ts ||
    intent.sourceEnvironment !== input.sourceEnvironment || intent.sourceOrigin !== input.sourceOrigin) return blocked('Campaign card identity changed or dispatch is unconfirmed. Reconcile this release in Portfolio; do not resend.')
  const current = await store.release(input.releaseId)
  if (current.manifest.campaignId !== intent.campaignId || current.hash !== input.hash) return blocked('Campaign release identity changed. Open the current Portfolio release.')
  if (current.slackDecision?.commandKey === input.commandKey) return { status: 'already_recorded' as const, text: `Campaign decision already recorded. Current release: ${current.state}. No provider action started.` }
  if (current.version !== input.version) return blocked('Stale campaign decision. Refresh the current release in Portfolio; do not reuse this card.')
  let next: ReleaseRecord
  try {
    requireCurrent(current, input.hash, input.version)
    await store.sources(current)
    next = decideCampaignRelease(current, input.hash, input.decision, `slack:${input.actor}`)
  } catch { return blocked('Release or source evidence changed, expired, or stopped. Review in Portfolio and prepare a fresh packet.') }
  // Version CAS and signed context are persisted in the same row write as the decision.
  if (!await store.decide(current, { ...next, slackDecision: input })) return blocked('Release changed concurrently. Refresh the current release; do not repeat this decision.')
  return { status: 'completed' as const, text: `Campaign release ${next.state}. Provider execution remains gated. Review: ${input.sourceOrigin}/admin/campaigns/${intent.campaignId}?release=${input.releaseId}` }
}

export async function campaignSlackProjection(campaignId: string, releaseId: string): Promise<CampaignSlackProjection> {
  const source = getSlackAgentSource()
  const [intents, receipts] = await Promise.all([
    table().select('metadata').eq('kind', CAMPAIGN_SLACK_KIND).eq('subject_id', campaignId)
      .eq('metadata->>releaseId', releaseId).eq('metadata->>sourceOrigin', source.sourceOrigin)
      .eq('metadata->>sourceEnvironment', source.sourceEnvironment).order('created_at', { ascending: false }).limit(10),
    table().select('id,idempotency_key,updated_at,status,metadata,outcome').eq('kind', 'slack_action_receipt')
      .eq('metadata->envelope->value->>runId', releaseId).eq('metadata->envelope->value->>sourceOrigin', source.sourceOrigin)
      .eq('metadata->envelope->>environment', source.sourceEnvironment)
      .in('metadata->envelope->value->>action', ['campaign_release.approve', 'campaign_release.revise', 'campaign_release.hold', 'campaign_release.stop'])
      .neq('metadata->>state', 'message_lock').order('created_at', { ascending: false }).limit(10),
  ])
  if (intents.error || receipts.error) throw new Error('Slack outcome unavailable. Refresh before retrying.')
  // Read the decision after receipts so an observed completed callback cannot project an older release state.
  const record = await getCampaignRelease(releaseId)
  if (record.manifest.campaignId !== campaignId) throw new Error('Campaign mismatch.')
  return { release: record, gate: campaignSlackDispatchGate(), intents: (intents.data ?? []).map((row: { metadata: CampaignSlackIntent }) => row.metadata),
    receipts: (receipts.data ?? []).map((r: Receipt) => {
      return { id: r.id, state: r.metadata.state, action: r.metadata.envelope.value.action,
        version: r.metadata.envelope.value.releaseVersion, status: r.outcome.canonical?.actionStatus,
        text: r.outcome.canonical?.text, delivery: r.outcome.delivery, deliveryError: r.outcome.deliveryError }
    }) }
}
export type CampaignSlackProjection = {
  release: ReleaseRecord
  gate: { enabled: boolean; reason: string }
  intents: CampaignSlackIntent[]
  receipts: Array<{ id: string; state: Receipt['metadata']['state']; action: string; version?: string;
    status?: NonNullable<Receipt['outcome']['canonical']>['actionStatus']; text?: string;
    delivery?: 'delivered' | 'failed'; deliveryError?: string }>
}
