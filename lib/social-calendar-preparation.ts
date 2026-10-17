type RecordValue = Record<string, unknown>

export type SocialCalendarPreparationProjection = {
  calendar_item_id: string
  social_content_id: string
  state: 'ready' | 'pending' | 'blocked'
  authorization_status: string
  due_status: string
  scheduled_for: string
  prepared_at: string | null
  content_version: string | null
  reused_existing_approved_packet: boolean
}

function record(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function projectSocialCalendarPreparation(
  row: RecordValue | null | undefined,
  expectedSocialContentId: string,
): SocialCalendarPreparationProjection | null {
  if (!row) return null

  const calendarItemId = text(row.id)
  const socialContentId = text(row.social_content_id)
  if (!calendarItemId || !socialContentId || socialContentId !== expectedSocialContentId) return null

  const authorizationStatus = text(row.authorization_status)
  const dueStatus = text(row.due_status)
  const scheduledFor = text(row.scheduled_for)
  const preparation = record(record(row.metadata)?.publish_preparation)
  const preparationStatus = text(preparation?.status)
  const preparationContentId = text(preparation?.social_content_id)
  const contentVersion = text(preparation?.content_version) || null
  const preparedAt = text(preparation?.prepared_at) || null
  const preparationMatches = preparationContentId === socialContentId
    && Boolean(contentVersion)
    && Boolean(preparedAt)
  const ready = authorizationStatus === 'authorized'
    && preparationStatus === 'ready'
    && preparationMatches

  const blocked = authorizationStatus === 'rejected'
    || authorizationStatus === 'expired'
    || dueStatus === 'cancelled'

  return {
    calendar_item_id: calendarItemId,
    social_content_id: socialContentId,
    state: ready ? 'ready' : blocked ? 'blocked' : 'pending',
    authorization_status: authorizationStatus,
    due_status: dueStatus,
    scheduled_for: scheduledFor,
    prepared_at: preparedAt,
    content_version: contentVersion,
    reused_existing_approved_packet: ready && preparation?.reused_existing_approved_packet === true,
  }
}
