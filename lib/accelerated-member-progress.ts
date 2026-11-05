import { DECISION_FILE_VERSION, lessons, validateDecisionFile, type DecisionFileDraft } from './accelerated-decision-file'

export const GUEST_PROGRESS_KEY = 'amadutown:accelerated:guest-progress:v1'
const lessonIds = new Set(lessons.map((lesson) => lesson.id))

export type LearningState = {
  version: string
  worksheet: DecisionFileDraft
  completed: string[]
  videoSeconds: Record<string, number>
  currentLessonId: string
  updatedAt: string
}

export function validateLearningState(value: unknown): { ok: true; state: LearningState } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid learning state.' }
  const row = value as Partial<LearningState>
  if (row.version !== DECISION_FILE_VERSION) return { ok: false, error: 'This course edition has changed. Review your saved copy before claiming progress.' }
  const worksheet = validateDecisionFile(row.worksheet)
  if (!worksheet.ok || worksheet.draft.version !== row.version) return { ok: false, error: 'Invalid or mismatched worksheet.' }
  if (!Array.isArray(row.completed) || row.completed.length > lessons.length || new Set(row.completed).size !== row.completed.length || row.completed.some((id) => !lessonIds.has(id))) return { ok: false, error: 'Invalid lesson completion.' }
  if (!row.videoSeconds || typeof row.videoSeconds !== 'object' || Array.isArray(row.videoSeconds)) return { ok: false, error: 'Invalid video positions.' }
  for (const [id, seconds] of Object.entries(row.videoSeconds)) {
    if (!lessonIds.has(id) || !Number.isInteger(seconds) || seconds < 0 || seconds > 7200) return { ok: false, error: 'Invalid video position.' }
  }
  if (!row.currentLessonId || !lessonIds.has(row.currentLessonId)) return { ok: false, error: 'Invalid current lesson.' }
  const date = typeof row.updatedAt === 'string' ? Date.parse(row.updatedAt) : NaN
  if (!Number.isFinite(date) || date > Date.now() + 5 * 60_000 || date < Date.now() - 90 * 24 * 60 * 60_000) return { ok: false, error: 'Saved progress is stale or has an invalid date.' }
  return { ok: true, state: row as LearningState }
}
