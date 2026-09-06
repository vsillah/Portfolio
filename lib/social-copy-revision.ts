import { createHash } from 'node:crypto'

// Calendar copy currently has no revision consumer. This contract describes
// persisted manual edits only; a work-item row is not worker evidence.
type CopyRow = { id: string; status?: string; rag_context?: unknown; [key: string]: unknown }
export type SocialCopyRevisionView = {
  current_version: string
  state: 'needs_review' | 'blocked' | 'ready'
  feedback: string | null
  received_at: string | null
  worker: 'not_configured'
  review_path: string
}
const COPY_FIELDS = ['post_text', 'cta_text', 'cta_url', 'hashtags', 'image_prompt', 'voiceover_text', 'platform', 'target_platforms', 'youtube_title', 'youtube_description']
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export function isCalendarSocialCopy(item: { rag_context?: unknown }) {
  return record(item.rag_context).source === 'social_content_calendar_authorization'
}
export function socialCopyVersion(item: CopyRow) {
  return createHash('sha256').update(JSON.stringify(COPY_FIELDS.map((key) => item[key] ?? null))).digest('hex')
}
export function socialCopyRevisionView(item: CopyRow): SocialCopyRevisionView {
  const revision = record(record(item.rag_context).copy_revision)
  const version = socialCopyVersion(item)
  return {
    current_version: version,
    state: item.status === 'rejected' ? 'blocked'
      : revision.completed_version === version && item.status === 'draft' ? 'ready' : 'needs_review',
    feedback: typeof revision.feedback === 'string' && revision.feedback ? revision.feedback : null,
    received_at: typeof revision.received_at === 'string' ? revision.received_at : null,
    worker: 'not_configured',
    review_path: `/admin/social-content/${encodeURIComponent(item.id)}?step=copy#social-copy-gate`,
  }
}
export function withSocialCopyRevision<T extends CopyRow>(item: T) {
  return isCalendarSocialCopy(item) ? { ...item, copy_revision: socialCopyRevisionView(item) } : item
}
export function prepareManualCopyUpdate(input: {
  current: CopyRow; patch: Record<string, unknown>; expectedVersion?: unknown; actor: string; now: string
}) {
  const { current, actor, now } = input
  const patch = { ...input.patch }
  if (!isCalendarSocialCopy(current)) return patch
  patch.updated_at = new Date(Math.max(Date.parse(now), Date.parse(String(current.updated_at)) + 1 || 0)).toISOString()
  const version = socialCopyVersion(current)
  const incomingRag = record(patch.rag_context)
  const revisionFeedback = record(incomingRag.content_calibration).operator_feedback
  const needsVersion = COPY_FIELDS.some((field) => field in patch) || 'status' in patch || 'scheduled_for' in patch || 'section_gate_reviews' in incomingRag || revisionFeedback !== undefined
  if (needsVersion && (typeof input.expectedVersion !== 'string' || !input.expectedVersion.trim())) {
    throw new Error('A current copy version is required for edits, decisions, or revision feedback. Reload this review before saving.')
  }
  if (input.expectedVersion !== undefined && input.expectedVersion !== version) {
    throw new Error('Copy changed since this review opened. Reload the current version before deciding or saving.')
  }
  const currentRag = record(current.rag_context)
  const nextRag: Record<string, unknown> = { ...currentRag, ...incomingRag, source: currentRag.source }
  for (const field of ['copy_approval_invalidated_at', 'platform_submission_orchestration', 'platform_draft_handoff', 'linkedin_draft_handoff']) {
    if (field in currentRag) nextRag[field] = currentRag[field]
    else delete nextRag[field]
  }
  const existing = record(currentRag.copy_revision)
  // Clients may provide feedback, but never worker or completion evidence.
  nextRag.copy_revision = existing
  const candidate = { ...current, ...patch }
  const nextVersion = socialCopyVersion(candidate)
  const changed = nextVersion !== version
  if (changed && ['scheduled', 'publishing', 'published'].includes(current.status || '')) {
    throw new Error('Resolve the existing publication or schedule in its recovery gate before creating a revised draft.')
  }
  const calibration = record(nextRag.content_calibration)
  const feedback = record(calibration.operator_feedback).revision_request
  let revision = existing
  if (patch.status === 'rejected') {
    revision = {
      ...existing,
      request_version: existing.request_version === version ? existing.request_version : version,
      received_at: existing.request_version === version ? existing.received_at : now,
      received_by: existing.request_version === version ? existing.received_by : actor,
      feedback: typeof feedback === 'string' && feedback.trim() ? feedback.trim() : existing.request_version === version ? existing.feedback ?? null : null,
      state: 'blocked',
      blocker: 'manual_revision_required',
      worker: 'not_configured',
      completed_version: null,
    }
    patch.reviewed_by = null
    patch.scheduled_for = null
  }
  if (changed || patch.status === 'rejected') {
    if (changed && patch.status !== 'rejected' && (['approved', 'scheduled'].includes(current.status || '') || ['approved', 'scheduled'].includes(String(patch.status)))) patch.status = 'draft'
    patch.reviewed_by = null
    patch.scheduled_for = null
    const gates = { ...record(currentRag.section_gate_reviews), ...record(incomingRag.section_gate_reviews) }
    nextRag.section_gate_reviews = Object.fromEntries(Object.entries(gates).map(([key, value]) => [key, {
      ...record(value), status: 'pending', invalidated_at: changed ? now : record(value).invalidated_at || now, invalidation_reason: changed ? 'copy_version_changed' : 'copy_rejected',
    }]))
    nextRag.copy_approval_invalidated_at = changed ? now : currentRag.copy_approval_invalidated_at || now
  }
  if (patch.status === 'draft' && (current.status === 'rejected' || existing.request_version)) {
    const requestVersion = typeof existing.request_version === 'string' ? existing.request_version : version
    if (nextVersion === requestVersion) throw new Error('Save changed copy before returning this revision to review.')
    revision = existing.completed_version === nextVersion && current.status === 'draft' ? existing : { ...revision, state: 'ready', completed_version: nextVersion, completed_at: now, completed_by: actor, completion_source: 'manual_edit', worker: 'not_configured' }
    const nextCalibration = { ...calibration, status: 'returned_to_copy_review' }
    delete (nextCalibration as Record<string, unknown>).approval_rejection
    nextRag.content_calibration = nextCalibration
    patch.reviewed_by = null
    patch.scheduled_for = null
  }
  // Ignore fabricated client revision metadata even on unrelated saves.
  nextRag.copy_revision = revision
  if (patch.rag_context !== undefined || patch.status === 'rejected' || changed || revision !== existing) patch.rag_context = nextRag
  return patch
}
