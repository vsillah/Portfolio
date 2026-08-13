import { recordAgentEvent } from '@/lib/agent-run'

export const SOCIAL_SCHEDULE_RECOVERY_SOURCE_TYPE = 'social_content_scheduled_publish_recovery'

const TERMINAL_WORK_ITEM_STATUSES = new Set(['merged', 'deployed', 'cancelled'])
const ACTIVE_WORK_ITEM_STATUSES = [
  'proposed',
  'queued',
  'assigned',
  'in_progress',
  'blocked',
  'ready_for_review',
  'ready_for_merge',
]

type JsonRecord = Record<string, unknown>

export type ScheduleRecoveryAction = 'reschedule_reconfirm' | 'cancel_scheduled_publication'

export type ScheduleRecoveryWorkItem = {
  id: string
  status: string
  owner_agent_key: string | null
  active_run_id: string | null
  source_type: string | null
  source_id: string | null
  blocker_summary: string | null
  metadata: JsonRecord | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type ScheduleRecoveryProjection = {
  state: 'action_required' | 'blocked'
  work_item_id: string | null
  owner: string
  stale_reason: string
  prior_scheduled_for: string | null
  next_action: string
  automatic_publication_blocked: true
}

type SocialContentScheduleRow = {
  id: string
  status: string
  scheduled_for: string | null
}

type PublishScheduleRow = {
  id: string
  status: string
  error_message: string | null
}

export type SocialScheduleRecoveryRepository = {
  readContent: (contentId: string) => Promise<SocialContentScheduleRow | null>
  readRecoveryItems: (contentId: string) => Promise<ScheduleRecoveryWorkItem[]>
  readPublishRows: (contentId: string) => Promise<PublishScheduleRow[]>
  updateContent: (input: {
    contentId: string
    expectedStatus: string
    expectedScheduledFor: string | null
    status: string
    scheduledFor: string | null
  }) => Promise<boolean>
  updatePublishes: (input: {
    ids: string[]
    status: string
    errorMessage: string | null
  }) => Promise<boolean>
  resolveWorkItem: (input: {
    item: ScheduleRecoveryWorkItem
    status: 'deployed' | 'cancelled'
    metadata: JsonRecord
    validationSummary: string
    completedAt: string
  }) => Promise<boolean>
  recordResolutionEvent: (input: {
    item: ScheduleRecoveryWorkItem
    action: ScheduleRecoveryAction
    message: string
    idempotencyKey: string
  }) => Promise<void>
}

export class SocialScheduleRecoveryError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function resolutionFor(item: ScheduleRecoveryWorkItem) {
  return asRecord(asRecord(item.metadata).schedule_recovery_resolution)
}

function isStaleRecovery(item: ScheduleRecoveryWorkItem, contentId: string) {
  const metadata = asRecord(item.metadata)
  return item.source_type === SOCIAL_SCHEDULE_RECOVERY_SOURCE_TYPE
    && item.source_id === contentId
    && asString(metadata.recovery_kind) === 'stale_schedule'
    && asString(metadata.recovery_action) === 'reschedule_reconfirm_or_cancel'
}

function activeRecoveryItems(items: ScheduleRecoveryWorkItem[], contentId: string) {
  return items.filter((item) => isStaleRecovery(item, contentId) && !TERMINAL_WORK_ITEM_STATUSES.has(item.status))
}

export function buildScheduleRecoveryProjection(
  items: ScheduleRecoveryWorkItem[],
  contentId: string,
): ScheduleRecoveryProjection | null {
  const active = activeRecoveryItems(items, contentId)
  if (!active.length) return null

  if (active.length !== 1) {
    return {
      state: 'blocked',
      work_item_id: null,
      owner: 'Integration Captain',
      stale_reason: 'Multiple active stale-schedule recovery records reference this Social Content item.',
      prior_scheduled_for: null,
      next_action: 'Resolve the duplicate canonical recovery records before changing the schedule.',
      automatic_publication_blocked: true,
    }
  }

  const item = active[0]
  const metadata = asRecord(item.metadata)
  return {
    state: 'action_required',
    work_item_id: item.id,
    owner: item.owner_agent_key ?? 'Unassigned',
    stale_reason: asString(metadata.blocker)
      ?? item.blocker_summary
      ?? 'The scheduled time is outside the automatic publish safety window.',
    prior_scheduled_for: asString(metadata.scheduled_for),
    next_action: 'Choose a future schedule and reconfirm publication intent, or cancel this scheduled publication.',
    automatic_publication_blocked: true,
  }
}

function matchingTerminalItem(
  items: ScheduleRecoveryWorkItem[],
  contentId: string,
  workItemId: string,
) {
  return items.find((item) => (
    item.id === workItemId
    && isStaleRecovery(item, contentId)
    && TERMINAL_WORK_ITEM_STATUSES.has(item.status)
  )) ?? null
}

function recoveryScheduledFor(item: ScheduleRecoveryWorkItem) {
  return asString(asRecord(item.metadata).scheduled_for)
}

function futureIso(value: unknown, now: Date) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.getTime() > now.getTime()
    ? parsed.toISOString()
    : null
}

export async function resolveSocialScheduleRecovery(input: {
  repository: SocialScheduleRecoveryRepository
  contentId: string
  workItemId: string
  action: ScheduleRecoveryAction
  scheduledFor?: string | null
  reconfirmPublicationIntent?: boolean
  actorId: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const completedAt = now.toISOString()
  const items = await input.repository.readRecoveryItems(input.contentId)
  const terminal = matchingTerminalItem(items, input.contentId, input.workItemId)
  if (terminal) {
    const priorResolution = resolutionFor(terminal)
    if (asString(priorResolution.action) === input.action) {
      if (input.action === 'reschedule_reconfirm') {
        const replayDate = typeof input.scheduledFor === 'string' ? new Date(input.scheduledFor) : null
        const replaySchedule = replayDate && Number.isFinite(replayDate.getTime())
          ? replayDate.toISOString()
          : null
        if (replaySchedule !== asString(priorResolution.scheduled_for)) {
          throw new SocialScheduleRecoveryError(
            'This recovery item was already resolved with a different schedule.',
            'recovery_already_resolved',
            409,
          )
        }
      }
      return {
        ok: true,
        idempotent: true,
        action: input.action,
        work_item_id: terminal.id,
        scheduled_for: asString(priorResolution.scheduled_for),
        side_effects: { provider_call: false, publish: false, external_schedule: false },
      }
    }
    throw new SocialScheduleRecoveryError(
      'This recovery item was already resolved with a different decision.',
      'recovery_already_resolved',
      409,
    )
  }

  const active = activeRecoveryItems(items, input.contentId)
  if (active.length !== 1 || active[0].id !== input.workItemId) {
    throw new SocialScheduleRecoveryError(
      active.length > 1
        ? 'Multiple active recovery items reference this Social Content record.'
        : 'The linked stale-schedule recovery item is missing or no longer actionable.',
      active.length > 1 ? 'ambiguous_recovery_items' : 'recovery_not_actionable',
      409,
    )
  }

  const item = active[0]
  const content = await input.repository.readContent(input.contentId)
  if (!content) {
    throw new SocialScheduleRecoveryError('Social Content record not found.', 'content_not_found', 404)
  }

  const priorScheduledFor = recoveryScheduledFor(item)
  if (!priorScheduledFor) {
    throw new SocialScheduleRecoveryError(
      'The recovery item does not contain an attributable prior schedule.',
      'missing_prior_schedule',
      409,
    )
  }

  const publishRows = await input.repository.readPublishRows(input.contentId)
  const actionablePublishes = publishRows.filter((row) => row.status === 'pending' || row.status === 'failed')
  const alreadyCancelledPublishes = publishRows.filter((row) => (
    row.status === 'skipped'
    && row.error_message?.startsWith('Scheduled publication cancelled by ')
  ))
  const cancellationPartiallyApplied = input.action === 'cancel_scheduled_publication'
    && content.status === 'approved'
    && content.scheduled_for === null
    && alreadyCancelledPublishes.length > 0
    && actionablePublishes.length === 0
  if (!actionablePublishes.length && !cancellationPartiallyApplied) {
    throw new SocialScheduleRecoveryError(
      'No pending or failed publish records are linked to this stale schedule.',
      'publish_records_not_actionable',
      409,
    )
  }

  let nextScheduledFor: string | null = null
  let contentStatus: string
  let publishStatus: string
  let publishMessage: string | null
  let workItemStatus: 'deployed' | 'cancelled'
  let validationSummary: string

  if (input.action === 'reschedule_reconfirm') {
    if (input.reconfirmPublicationIntent !== true) {
      throw new SocialScheduleRecoveryError(
        'Explicit publication-intent reconfirmation is required.',
        'publication_intent_not_reconfirmed',
        400,
      )
    }
    nextScheduledFor = futureIso(input.scheduledFor, now)
    if (!nextScheduledFor) {
      throw new SocialScheduleRecoveryError(
        'Choose a valid future schedule.',
        'future_schedule_required',
        400,
      )
    }
    contentStatus = 'scheduled'
    publishStatus = 'pending'
    publishMessage = null
    workItemStatus = 'deployed'
    validationSummary = `Publication intent reconfirmed and rescheduled for ${nextScheduledFor}. No provider was called.`
  } else {
    contentStatus = 'approved'
    publishStatus = 'skipped'
    publishMessage = `Scheduled publication cancelled by ${input.actorId} at ${completedAt}.`
    workItemStatus = 'cancelled'
    validationSummary = 'Scheduled publication cancelled. Content and provider history were preserved; no provider was called.'
  }

  const contentAlreadyUpdated = input.action === 'reschedule_reconfirm'
    ? content.status === 'scheduled' && content.scheduled_for === nextScheduledFor
    : content.status === 'approved' && content.scheduled_for === null

  if (!contentAlreadyUpdated) {
    if (content.status !== 'scheduled' || content.scheduled_for !== priorScheduledFor) {
      throw new SocialScheduleRecoveryError(
        'The canonical schedule changed after this recovery item was created. Refresh before deciding.',
        'schedule_changed',
        409,
      )
    }
    const updated = await input.repository.updateContent({
      contentId: input.contentId,
      expectedStatus: content.status,
      expectedScheduledFor: content.scheduled_for,
      status: contentStatus,
      scheduledFor: nextScheduledFor,
    })
    if (!updated) {
      throw new SocialScheduleRecoveryError(
        'The canonical schedule changed while the recovery decision was being applied.',
        'schedule_update_conflict',
        409,
      )
    }
  }

  if (!cancellationPartiallyApplied) {
    const publishesUpdated = await input.repository.updatePublishes({
      ids: actionablePublishes.map((row) => row.id),
      status: publishStatus,
      errorMessage: publishMessage,
    })
    if (!publishesUpdated) {
      throw new SocialScheduleRecoveryError(
        'Publish records changed while the recovery decision was being applied. The recovery item remains open.',
        'publish_update_conflict',
        409,
      )
    }
  }

  const resolvedPublishRows = cancellationPartiallyApplied ? alreadyCancelledPublishes : actionablePublishes
  const resolution = {
    action: input.action,
    resolved_at: completedAt,
    resolved_by: input.actorId,
    prior_scheduled_for: priorScheduledFor,
    scheduled_for: nextScheduledFor,
    publish_record_ids: resolvedPublishRows.map((row) => row.id),
    provider_called: false,
    published: false,
  }
  const workItemUpdated = await input.repository.resolveWorkItem({
    item,
    status: workItemStatus,
    metadata: {
      ...asRecord(item.metadata),
      schedule_recovery_resolution: resolution,
    },
    validationSummary,
    completedAt,
  })
  if (!workItemUpdated) {
    throw new SocialScheduleRecoveryError(
      'The recovery item changed while the decision was being applied. Refresh to confirm the canonical result.',
      'work_item_update_conflict',
      409,
    )
  }

  await input.repository.recordResolutionEvent({
    item,
    action: input.action,
    message: validationSummary,
    idempotencyKey: `social-schedule-recovery:${item.id}:${input.action}`,
  })

  return {
    ok: true,
    idempotent: false,
    action: input.action,
    work_item_id: item.id,
    scheduled_for: nextScheduledFor,
    side_effects: { provider_call: false, publish: false, external_schedule: false },
  }
}

function asQuery(value: unknown): any {
  return value
}

export function createSupabaseSocialScheduleRecoveryRepository(admin: { from: (table: string) => unknown }): SocialScheduleRecoveryRepository {
  return {
    async readContent(contentId) {
      const { data } = await asQuery(admin.from('social_content_queue'))
        .select('id, status, scheduled_for')
        .eq('id', contentId)
        .maybeSingle()
      return data ?? null
    },
    async readRecoveryItems(contentId) {
      const { data, error } = await asQuery(admin.from('agent_work_items'))
        .select('id, status, owner_agent_key, active_run_id, source_type, source_id, blocker_summary, metadata, created_at, updated_at, completed_at')
        .eq('source_type', SOCIAL_SCHEDULE_RECOVERY_SOURCE_TYPE)
        .eq('source_id', contentId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    async readPublishRows(contentId) {
      const { data, error } = await asQuery(admin.from('social_content_publishes'))
        .select('id, status, error_message')
        .eq('content_id', contentId)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    async updateContent(input) {
      let query = asQuery(admin.from('social_content_queue'))
        .update({ status: input.status, scheduled_for: input.scheduledFor })
        .eq('id', input.contentId)
        .eq('status', input.expectedStatus)
      query = input.expectedScheduledFor === null
        ? query.is('scheduled_for', null)
        : query.eq('scheduled_for', input.expectedScheduledFor)
      const { data, error } = await query.select('id')
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data.length === 1
    },
    async updatePublishes(input) {
      const { data, error } = await asQuery(admin.from('social_content_publishes'))
        .update({ status: input.status, error_message: input.errorMessage })
        .in('id', input.ids)
        .in('status', ['pending', 'failed'])
        .select('id')
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data.length === input.ids.length
    },
    async resolveWorkItem(input) {
      const { data, error } = await asQuery(admin.from('agent_work_items'))
        .update({
          status: input.status,
          metadata: input.metadata,
          blocker_summary: null,
          validation_summary: input.validationSummary,
          completed_at: input.completedAt,
        })
        .eq('id', input.item.id)
        .in('status', ACTIVE_WORK_ITEM_STATUSES)
        .select('id')
      if (error) throw new Error(error.message)
      return Array.isArray(data) && data.length === 1
    },
    async recordResolutionEvent(input) {
      if (!input.item.active_run_id) return
      await recordAgentEvent({
        runId: input.item.active_run_id,
        eventType: 'social_schedule_recovery_resolved',
        severity: 'info',
        message: input.message,
        metadata: { work_item_id: input.item.id, action: input.action, provider_called: false },
        idempotencyKey: input.idempotencyKey,
      }).catch(() => {})
    },
  }
}
