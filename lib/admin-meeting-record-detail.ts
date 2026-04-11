export type MeetingRecordDetailRow = {
  id: string
  meeting_type: string | null
  meeting_date: string
  transcript: string | null
  structured_notes: unknown
  action_items: unknown
  key_decisions: unknown
}

function safeParseArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* ignore */
    }
  }
  return []
}

function normalizeNotes(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

function toActionItemTexts(rawItems: unknown[]): Array<{ text: string }> {
  const out: Array<{ text: string }> = []
  for (const item of rawItems) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ text: item.trim() })
      continue
    }
    if (item && typeof item === 'object') {
      const obj = item as { text?: unknown; action?: unknown; title?: unknown }
      const text = obj.text ?? obj.action ?? obj.title
      if (typeof text === 'string' && text.trim()) out.push({ text: text.trim() })
    }
  }
  return out
}

export function buildMeetingRecordDetail(
  row: MeetingRecordDetailRow,
  nowMs: number = Date.now()
) {
  const notes = normalizeNotes(row.structured_notes)
  const summaryFromNotes =
    (typeof notes?.summary === 'string' && notes.summary.trim()) ||
    (typeof notes?.highlights === 'string' && notes.highlights.trim()) ||
    null

  const transcript = typeof row.transcript === 'string' ? row.transcript : ''
  const summary = summaryFromNotes || (transcript.trim() ? transcript.slice(0, 4000) : null)

  let actionItems = toActionItemTexts(safeParseArray(row.action_items))
  if (actionItems.length === 0 && notes) {
    actionItems = toActionItemTexts(safeParseArray(notes.action_items))
  }
  if (actionItems.length === 0) {
    actionItems = toActionItemTexts(safeParseArray(row.key_decisions))
  }

  const title =
    typeof row.meeting_type === 'string' && row.meeting_type.trim()
      ? row.meeting_type.replace(/_/g, ' ')
      : 'Meeting'

  const startMs = Date.parse(row.meeting_date)

  return {
    id: row.id,
    title,
    start_time_ms: Number.isFinite(startMs) ? startMs : nowMs,
    end_time_ms: null as number | null,
    participants: [] as Array<{ name: string; email: string | null }>,
    platform: 'record',
    report_url: '',
    summary,
    action_items: actionItems.length > 0 ? actionItems : null,
  }
}
