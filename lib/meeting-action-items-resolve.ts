/**
 * Single source of truth for parsing meeting_records action payloads:
 * same precedence and title rules as GET /api/admin/meetings/[id] (meeting detail).
 *
 * Pure module — no Supabase — safe for scripts and tests.
 */

/** Minimal row slice needed to resolve action lines (DB JSONB or API object). */
export type MeetingRecordActionSlice = {
  action_items?: unknown
  key_decisions?: unknown
  structured_notes?: unknown
}

export interface NormalizedMeetingActionItem {
  title: string
  description: string | null
  owner: string | null
  due_date: string | null
  /** Raw status string from extraction; callers map to enums. */
  status: string | null
}

/** Parse JSONB that may be an array or a JSON string of an array (double-encoding). */
export function safeParseJsonbArray(val: unknown): unknown[] {
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

/** structured_notes as object, or JSON string → object. */
export function normalizeStructuredNotes(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

/**
 * First non-empty source, matching meeting detail API:
 * 1. row.action_items
 * 2. structured_notes.action_items
 * 3. row.key_decisions
 */
export function resolveActionItemsRawList(record: MeetingRecordActionSlice): unknown[] {
  const fromRow = safeParseJsonbArray(record.action_items)
  if (fromRow.length > 0) return fromRow

  const notes = normalizeStructuredNotes(record.structured_notes)
  if (notes) {
    const fromNotes = safeParseJsonbArray(notes.action_items)
    if (fromNotes.length > 0) return fromNotes
  }

  return safeParseJsonbArray(record.key_decisions)
}

/**
 * Normalize one JSON array of mixed shapes into promotable/display rows.
 * Title: string element, or object text ?? action ?? title (Read.ai / WF-MCH).
 */
export function normalizeActionItemsFromUnknownList(items: unknown[]): NormalizedMeetingActionItem[] {
  const out: NormalizedMeetingActionItem[] = []
  for (const item of items) {
    if (typeof item === 'string') {
      const title = item.trim()
      if (title.length > 0) {
        out.push({ title, description: null, owner: null, due_date: null, status: null })
      }
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const rawTitle = o.text ?? o.action ?? o.title
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
      if (!title) continue

      const description = typeof o.description === 'string' ? o.description : null
      const ownerRaw = o.owner ?? o.assignee
      const owner = typeof ownerRaw === 'string' && ownerRaw.trim() ? ownerRaw.trim() : null
      const due_date = typeof o.due_date === 'string' && o.due_date.trim() ? o.due_date.trim() : null
      const status = typeof o.status === 'string' && o.status.trim() ? o.status.trim() : null

      out.push({ title, description, owner, due_date, status })
    }
  }
  return out
}

/** Meeting detail API shape: { text }[] */
export function actionItemsToDisplayParts(normalized: NormalizedMeetingActionItem[]): Array<{ text: string }> {
  return normalized.map((n) => ({ text: n.title }))
}

export type CollectQuickWinTitlesOptions = {
  /** Max lines after cross-meeting dedupe (default 15). */
  maxLines?: number
}

/**
 * For Outreach Quick Wins fallback: collect titles from several meetings (newest first),
 * dedupe case-insensitively across meetings, cap length.
 */
export function collectQuickWinTitlesFromMeetingRows(
  meetings: MeetingRecordActionSlice[],
  options?: CollectQuickWinTitlesOptions
): string[] {
  const maxLines = options?.maxLines ?? 15
  const seen = new Set<string>()
  const lines: string[] = []

  for (const m of meetings) {
    const raw = resolveActionItemsRawList(m)
    const normalized = normalizeActionItemsFromUnknownList(raw)
    for (const { title } of normalized) {
      const key = title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      lines.push(title)
      if (lines.length >= maxLines) return lines
    }
  }
  return lines
}

/**
 * Preview how many action lines resolve for a meeting (dry-run / logging).
 * Does not query meeting_action_tasks.
 */
export function countResolvableActionItems(record: MeetingRecordActionSlice): number {
  return normalizeActionItemsFromUnknownList(resolveActionItemsRawList(record)).length
}
