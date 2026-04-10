/**
 * Shared shape for admin UI lists that combine meeting_records + Read.ai meetings
 * (Review & Enrich modal, Add Lead → Read.ai tab).
 */
export type AdminMeetingContextItem = {
  id: string
  title: string
  start_time_ms: number
  end_time_ms: number | null
  participants: Array<{ name: string; email: string | null }>
  platform: string
  report_url: string
  summary: string | null
  action_items: Array<{ text: string; assignee?: string }> | null
}

export const MEETING_RECORD_ID_PREFIX = 'meeting_record:'

export function isMeetingRecordContextId(id: string): boolean {
  return id.startsWith(MEETING_RECORD_ID_PREFIX)
}

export function meetingRecordUuidFromContextId(id: string): string {
  return id.slice(MEETING_RECORD_ID_PREFIX.length)
}

/** Rows from GET /api/admin/meetings (list shape). */
export function mapDbMeetingRowsToContextItems(
  rows: Array<{ id: string; meeting_type: string; meeting_date: string; summary: string | null }>
): AdminMeetingContextItem[] {
  return rows.map((m) => {
    const startMs = Date.parse(m.meeting_date)
    return {
      id: `${MEETING_RECORD_ID_PREFIX}${m.id}`,
      title:
        typeof m.meeting_type === 'string' && m.meeting_type.trim()
          ? m.meeting_type.replace(/_/g, ' ')
          : 'Meeting',
      start_time_ms: Number.isFinite(startMs) ? startMs : Date.now(),
      end_time_ms: null,
      participants: [],
      platform: 'record',
      report_url: '',
      summary: m.summary,
      action_items: null,
    }
  })
}

export function mergeDbFirstWithReadAi(
  dbItems: AdminMeetingContextItem[],
  readAiItems: AdminMeetingContextItem[]
): AdminMeetingContextItem[] {
  return [...dbItems, ...readAiItems]
}
