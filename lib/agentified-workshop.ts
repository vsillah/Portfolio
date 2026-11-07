import content from './agentified-workshop-content.json'

export const AGENTIFIED_VERSION = content.version
export const AGENTIFIED_GUEST_KEY = 'amadutown:agentified:guest-progress:v1'
export const agentifiedLessons = content.lessons
export const agentifiedActs = [...new Set(agentifiedLessons.map((lesson) => lesson.act))]
const ids = new Set(agentifiedLessons.map((lesson) => lesson.id))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AgentifiedDraft = { version: string; worksheetId: string; answers: Record<string, string>; updatedAt: string }
export type AgentifiedState = { version: string; worksheet: AgentifiedDraft; completed: string[]; videoSeconds: Record<string, number>; currentLessonId: string; updatedAt: string }

export function emptyAgentifiedDraft(worksheetId: string): AgentifiedDraft {
  return { version: AGENTIFIED_VERSION, worksheetId, answers: {}, updatedAt: new Date().toISOString() }
}

export function validateAgentifiedDraft(value: unknown): { ok: true; draft: AgentifiedDraft } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid Operating File.' }
  const draft = value as Partial<AgentifiedDraft>
  if (draft.version !== AGENTIFIED_VERSION) return { ok: false, error: 'This workshop edition has changed. Export and review your saved copy.' }
  if (typeof draft.worksheetId !== 'string' || !uuid.test(draft.worksheetId)) return { ok: false, error: 'Invalid file identity.' }
  if (!draft.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers)) return { ok: false, error: 'Invalid responses.' }
  if (Object.entries(draft.answers).some(([id, answer]) => !ids.has(id) || typeof answer !== 'string' || answer.length > 4000) || JSON.stringify(draft.answers).length > 32000) return { ok: false, error: 'A response is invalid or too long.' }
  if (typeof draft.updatedAt !== 'string' || !Number.isFinite(Date.parse(draft.updatedAt))) return { ok: false, error: 'Invalid file date.' }
  return { ok: true, draft: draft as AgentifiedDraft }
}

export function validateAgentifiedState(value: unknown): { ok: true; state: AgentifiedState } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid progress.' }
  const state = value as Partial<AgentifiedState>
  if (state.version !== AGENTIFIED_VERSION) return { ok: false, error: 'This workshop edition has changed. Export and review your saved copy.' }
  const checked = validateAgentifiedDraft(state.worksheet)
  if (!checked.ok) return checked
  if (!Array.isArray(state.completed) || state.completed.length > 16 || new Set(state.completed).size !== state.completed.length || state.completed.some((id) => !ids.has(id))) return { ok: false, error: 'Invalid lesson progress.' }
  if (!state.videoSeconds || typeof state.videoSeconds !== 'object' || Array.isArray(state.videoSeconds) || Object.entries(state.videoSeconds).some(([id, seconds]) => !ids.has(id) || !Number.isInteger(seconds) || seconds < 0 || seconds > 7200)) return { ok: false, error: 'Invalid video progress.' }
  if (!state.currentLessonId || !ids.has(state.currentLessonId)) return { ok: false, error: 'Invalid current lesson.' }
  const date = typeof state.updatedAt === 'string' ? Date.parse(state.updatedAt) : NaN
  if (!Number.isFinite(date) || date > Date.now() + 300000 || date < Date.now() - 90 * 86400000) return { ok: false, error: 'Saved progress is stale.' }
  return { ok: true, state: state as AgentifiedState }
}
