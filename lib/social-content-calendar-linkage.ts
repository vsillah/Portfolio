import { parseMetadata } from '@/lib/social-content-calendar'
import type { SocialPlatform } from '@/lib/social-content'

type SupabaseLike = {
  from: (table: string) => unknown
}

type CalendarLinkageEvent =
  | {
      type: 'copy_approved'
      at: string
      userId: string
    }
  | {
      type: 'platform_submission_approved'
      at: string
      userId: string
      platforms: SocialPlatform[]
      submitAfterApproval: boolean
    }
  | {
      type: 'published'
      at: string
      platforms: SocialPlatform[]
      platformPostUrls: string[]
    }

export type SocialContentCalendarLinkageResult = {
  matched: number
  updated: number
  skipped: boolean
  error: string | null
}

type CalendarRow = {
  id: string
  due_status?: string | null
  metadata?: Record<string, unknown> | null
}

function asQuery(value: unknown) {
  return value as {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data?: CalendarRow[] | null; error?: { code?: string; message?: string } | null }>
    }
    update: (updates: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ data?: unknown; error?: { code?: string; message?: string } | null }>
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function nonActionableCalendarError(error: { code?: string } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function eventPatch(event: CalendarLinkageEvent) {
  switch (event.type) {
    case 'copy_approved':
      return {
        social_content_status: 'approved',
        copy_review: {
          status: 'approved',
          approved_at: event.at,
          approved_by: event.userId,
        },
        last_material_update: {
          state: 'copy_approved',
          at: event.at,
          detail: 'Social Content copy was approved for post-approval production work.',
        },
      }
    case 'platform_submission_approved':
      return {
        social_content_status: event.submitAfterApproval ? 'submission_approved_auto_submit_requested' : 'submission_approved',
        platform_submission: {
          status: 'approved',
          approved_at: event.at,
          approved_by: event.userId,
          platforms: event.platforms,
          submit_after_approval: event.submitAfterApproval,
        },
        last_material_update: {
          state: 'platform_submission_approved',
          at: event.at,
          detail: event.submitAfterApproval
            ? 'Final platform submission was approved and automatic submission was requested.'
            : 'Final platform submission was approved without automatic submission.',
        },
      }
    case 'published':
      return {
        social_content_status: 'published',
        published: {
          status: 'published',
          published_at: event.at,
          platforms: event.platforms,
          platform_post_urls: event.platformPostUrls,
        },
        last_material_update: {
          state: 'published',
          at: event.at,
          detail: 'Linked Social Content was published; this calendar item is complete.',
        },
      }
  }
}

export async function syncCampaignCalendarForSocialContent(input: {
  admin: SupabaseLike
  socialContentId: string
  event: CalendarLinkageEvent
}): Promise<SocialContentCalendarLinkageResult> {
  const table = asQuery(input.admin.from('social_content_calendar_items'))
  const { data, error } = await table
    .select('id, due_status, metadata')
    .eq('social_content_id', input.socialContentId)

  if (error) {
    return {
      matched: 0,
      updated: 0,
      skipped: nonActionableCalendarError(error),
      error: nonActionableCalendarError(error) ? null : error.message ?? 'Failed to read linked calendar items',
    }
  }

  const rows = Array.isArray(data) ? data : []
  let updated = 0
  const patch = eventPatch(input.event)

  for (const row of rows) {
    const metadata = parseMetadata(row.metadata)
    const lifecycle = asRecord(metadata.social_content_lifecycle)
    const nextMetadata = {
      ...metadata,
      social_content_id: input.socialContentId,
      social_content_lifecycle: {
        ...lifecycle,
        ...patch,
        updated_at: input.event.at,
      },
    }

    const updatePayload: Record<string, unknown> = { metadata: nextMetadata }
    if (input.event.type === 'published') {
      updatePayload.due_status = 'completed'
    }

    const updateResult = await table
      .update(updatePayload)
      .eq('id', row.id)

    if (updateResult.error) {
      return {
        matched: rows.length,
        updated,
        skipped: false,
        error: updateResult.error.message ?? `Failed to update calendar item ${row.id}`,
      }
    }
    updated += 1
  }

  return {
    matched: rows.length,
    updated,
    skipped: false,
    error: null,
  }
}
