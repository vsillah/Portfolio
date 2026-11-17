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
  campaign_review_metadata: RecordValue
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
    campaign_review_metadata: (() => {
      const metadata = record(row.metadata)
      return {
        visual_asset_binding: metadata?.visual_asset_binding ?? null,
        visual_source_manifest_sha256: metadata?.visual_source_manifest_sha256 ?? null,
        visual_human_qa_approved_at: metadata?.visual_human_qa_approved_at ?? null,
        review_checks: metadata?.review_checks ?? null,
        jit_refresh_status: metadata?.jit_refresh_status ?? null,
        jit_refresh_packet_sha256: metadata?.jit_refresh_packet_sha256 ?? null,
        primary_cta_url: metadata?.primary_cta_url ?? null,
        content_packet_status: metadata?.content_packet_status ?? null,
        external_execution_enabled: metadata?.external_execution_enabled ?? null,
        provider_generation_enabled: metadata?.provider_generation_enabled ?? null,
        upload_enabled: metadata?.upload_enabled ?? null,
        schedule_enabled: metadata?.schedule_enabled ?? null,
        publish_enabled: metadata?.publish_enabled ?? null,
        outreach_send_enabled: metadata?.outreach_send_enabled ?? null,
      }
    })(),
  }
}
