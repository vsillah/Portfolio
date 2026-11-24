import { preparationDeadline } from '@/lib/social-calendar-preparation-deadline'

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
  source_expires_at: string | null
  source_freshness_status: 'fresh' | 'stale' | 'expired' | 'unknown'
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
  now: Date = new Date(),
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
  const sourceExpiresAt = text(preparation?.source_expires_at) || null
  const sourceExpiry = Date.parse(sourceExpiresAt ?? '')
  const recordedFreshness = text(preparation?.source_freshness_status)
  const sourceFreshnessStatus = !Number.isFinite(sourceExpiry) ? 'unknown'
    : sourceExpiry <= now.getTime() ? 'expired'
    : ['stale', 'blocked', 'failed'].includes(recordedFreshness) ? 'stale'
    : recordedFreshness === 'fresh' ? 'fresh' : 'unknown'
  const preparationMatches = preparationContentId === socialContentId
    && Boolean(contentVersion)
    && Number.isFinite(Date.parse(preparedAt ?? ''))
    && Date.parse(preparedAt ?? '') <= now.getTime()
    && text(preparation?.source_lineage) !== ''
    && text(preparation?.evidence_version) === text(preparation?.source_lineage)
    && text(preparation?.source_freshness_status) === 'fresh'
    && text(preparation?.scheduled_for) === scheduledFor
    && text(preparation?.trigger_at) === preparationDeadline({ scheduled_for: scheduledFor, metadata: row.metadata })
    && sourceFreshnessStatus === 'fresh'
  const blocked = authorizationStatus === 'rejected'
    || authorizationStatus === 'expired'
    || dueStatus === 'cancelled'
  const ready = !blocked && authorizationStatus === 'authorized'
    && preparationStatus === 'ready'
    && preparationMatches

  return {
    calendar_item_id: calendarItemId,
    social_content_id: socialContentId,
    state: ready ? 'ready' : blocked ? 'blocked' : 'pending',
    authorization_status: authorizationStatus,
    due_status: dueStatus,
    scheduled_for: scheduledFor,
    prepared_at: preparedAt,
    content_version: contentVersion,
    source_expires_at: sourceExpiresAt,
    source_freshness_status: sourceFreshnessStatus,
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
