import { preparationDeadline } from '@/lib/social-calendar-preparation-deadline'
import { projectSocialCalendarPreparation } from '@/lib/social-calendar-preparation'

type RecordValue = Record<string, unknown>

export type ReleaseAutomationRow = {
  id: string
  channel: string
  campaign_phase: 'tease' | 'teach' | 'proof' | 'offer'
  scheduled_for: string
  authorization_status: string
  due_status: string
  campaign_id: string | null
  social_content_id: string | null
  social_content_queue?: { status: string } | null
  agent_work_items?: { preparation_claim?: unknown } | null
  metadata?: unknown
}

export type ReleaseAutomationState = 'planned' | 'eligible' | 'preparing' | 'ready for human review' | 'blocked'

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function safePath(value: unknown): string | null {
  const path = string(value)
  return path?.startsWith('/') && !path.startsWith('//') ? path : null
}

const PRIORITY: Record<string, number> = { urgent: 0, high: 1, medium: 2, normal: 2, low: 3 }
const PHASE: Record<ReleaseAutomationRow['campaign_phase'], number> = { offer: 0, proof: 1, teach: 2, tease: 3 }
const STATE: Record<ReleaseAutomationState, number> = {
  'ready for human review': 0,
  blocked: 1,
  eligible: 2,
  preparing: 3,
  planned: 4,
}

export function projectReleaseAutomation(row: ReleaseAutomationRow, now: Date = new Date()) {
  const metadata = record(row.metadata)
  const preparation = record(metadata.publish_preparation)
  const trigger = preparationDeadline(row)
  const triggerTime = trigger ? Date.parse(trigger) : NaN
  const triggered = Number.isFinite(triggerTime) && triggerTime <= now.getTime()
  const claim = record(row.agent_work_items?.preparation_claim)
  const claimTime = Date.parse(string(claim.claimed_at) ?? '')
  const activeClaim = claim.status === 'preparing' && Number.isFinite(claimTime)
    && claimTime <= now.getTime() && claimTime > now.getTime() - 5 * 60_000
  const jit = record(metadata.jit_refresh)
  const jitValue = string(metadata.jit_refresh_status) ?? string(jit.status)
  const staleJit = ['stale', 'expired', 'blocked', 'failed'].includes(jitValue?.toLowerCase() ?? '')
  const externalEnabled = [
    'external_execution_enabled', 'provider_generation_enabled', 'upload_enabled',
    'schedule_enabled', 'publish_enabled', 'outreach_send_enabled',
  ].some(key => metadata[key] === true)
  const preparationProjection = row.social_content_id
    ? projectSocialCalendarPreparation({
        id: row.id,
        social_content_id: row.social_content_id,
        authorization_status: row.authorization_status,
        due_status: row.due_status,
        scheduled_for: row.scheduled_for,
        metadata,
      }, row.social_content_id, now)
    : null
  const sourceFreshness = preparationProjection?.source_freshness_status ?? 'unknown'
  const freshness = `JIT ${jitValue ?? 'unknown'} · source ${sourceFreshness}`
  const jitRank = staleJit ? 0 : !jitValue ? 1 : 2
  const sourceRank = sourceFreshness === 'expired' || sourceFreshness === 'stale' ? 0 : sourceFreshness === 'unknown' ? 1 : 2
  const ready = preparationProjection?.state === 'ready' && Boolean(jitValue) && !staleJit
  const blocker = externalEnabled ? 'External execution flag is enabled. Stop and review the authorization boundary.'
    : string(preparation.blocker)
    ?? (row.authorization_status === 'rejected' || row.authorization_status === 'expired'
      ? `Authorization is ${row.authorization_status}. Revise the calendar gate.`
      : row.due_status === 'cancelled' ? 'Release cancelled.'
      : row.authorization_status === 'authorized' && preparation.status === 'ready' && !ready
        ? `Preparation receipt or JIT/source freshness is incomplete, expired, or linked to another draft (${freshness}). Verify the content ID, version, trigger, source expiry, and prepared time.`
      : staleJit ? `JIT/source evidence is ${freshness}. Refresh approved evidence before review.`
      : triggered && row.authorization_status === 'authorized' && !row.campaign_id
        ? 'Link this row to an active campaign before preparation.' : null)
  const eligible = triggered && row.authorization_status === 'authorized'
    && Boolean(row.campaign_id) && ['draft', 'approved'].includes(row.social_content_queue?.status ?? '')
  const state: ReleaseAutomationState = blocker ? 'blocked'
    : ready ? 'ready for human review'
    : activeClaim ? 'preparing'
    : eligible ? 'eligible' : 'planned'
  const priorityName = string(metadata.review_priority)?.toLowerCase() ?? 'normal'
  const priorityRank = PRIORITY[priorityName] ?? PRIORITY.normal
  const reviewPath = ready ? safePath(preparation.review_path) : null
  const recoveryPath = safePath(preparation.recovery_action)
    ?? reviewPath
    ?? (row.social_content_id ? `/admin/social-content/${encodeURIComponent(row.social_content_id)}?step=copy`
      : `/admin/agents/content-intelligence?section=calendar&calendar_item=${encodeURIComponent(row.id)}#content-calendar-gate`)
  return {
    id: row.id,
    state,
    trigger,
    triggered,
    freshness,
    jitRank,
    sourceRank,
    sourceExpiresAt: preparationProjection?.source_expires_at ?? null,
    sourceLineage: string(preparation.source_lineage),
    blocker,
    recoveryPath,
    linkLabel: state === 'ready for human review' && reviewPath && recoveryPath === reviewPath ? 'Open review'
      : state === 'blocked' ? 'Open recovery' : 'Open details',
    receipt: string(preparation.content_version) ?? string(preparation.evidence_version)
      ?? string(claim.claimed_at),
    receiptLabel: string(preparation.content_version) ? 'Content version'
      : string(preparation.evidence_version) ? 'Evidence version'
      : string(claim.claimed_at) ? 'Claimed at' : 'No claim or receipt recorded',
    priorityName,
    priorityRank,
    phaseRank: PHASE[row.campaign_phase],
    stateRank: STATE[state],
    reason: blocker ?? (state === 'eligible' && !jitValue ? 'Preparation deadline reached; JIT freshness is unknown in this calendar record.'
      : state === 'eligible' ? 'Preparation deadline reached; authorized draft is eligible.'
      : state === 'preparing' ? 'An active preparation claim is in progress.'
      : state === 'ready for human review' ? 'A versioned internal packet is ready for review.'
      : row.authorization_status !== 'authorized' ? 'Draft authorization is still pending.'
      : !triggered ? 'Preparation trigger has not arrived.'
      : 'Linked draft or campaign is needed before preparation.'),
  }
}

export function rankReleaseAutomation<T extends ReleaseAutomationRow>(rows: T[], now: Date = new Date()) {
  return rows.filter(row => {
    const metadata = record(row.metadata)
    const lifecycle = record(metadata.social_content_lifecycle)
    const lifecyclePublished = string(lifecycle.social_content_status)?.toLowerCase() === 'published'
      || string(record(lifecycle.published).status)?.toLowerCase() === 'published'
    return !['completed', 'cancelled'].includes(row.due_status.toLowerCase())
      && row.social_content_queue?.status?.toLowerCase() !== 'published'
      && !lifecyclePublished
      && metadata.superseded_by_agentified_packet !== true
      && !string(metadata.superseded_at)
  }).map(row => ({ row, projection: projectReleaseAutomation(row, now) }))
    .sort((a, b) => a.projection.stateRank - b.projection.stateRank
      || a.projection.priorityRank - b.projection.priorityRank
      || a.projection.jitRank - b.projection.jitRank
      || a.projection.sourceRank - b.projection.sourceRank
      || (Number.isFinite(Date.parse(a.projection.trigger ?? '')) ? Date.parse(a.projection.trigger!) : Number.MAX_SAFE_INTEGER)
        - (Number.isFinite(Date.parse(b.projection.trigger ?? '')) ? Date.parse(b.projection.trigger!) : Number.MAX_SAFE_INTEGER)
      || Date.parse(a.row.scheduled_for) - Date.parse(b.row.scheduled_for)
      || a.projection.phaseRank - b.projection.phaseRank
      || a.row.id.localeCompare(b.row.id))
}
