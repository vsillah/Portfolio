import { createHash } from 'node:crypto'
import { hasSubmissionOrPublishEvidence, validateSocialContentFinalCopyQuality, type LifecycleItem } from './social-content-lifecycle'

// Calendar copy currently has no revision consumer. This contract describes
// persisted manual edits only; a work-item row is not worker evidence.
type CopyRow = { id: string; status?: string; rag_context?: unknown; [key: string]: unknown }
export type SocialCopyRevisionView = {
  current_version: string
  state: 'needs_review' | 'blocked' | 'ready'
  feedback: string | null
  received_at: string | null
  worker: 'not_configured'
  release_locked: boolean
  has_saved_revision: boolean
  review_path: string
}
const COPY_FIELDS = ['post_text', 'cta_text', 'cta_url', 'hashtags', 'image_prompt', 'voiceover_text', 'platform', 'target_platforms', 'youtube_title', 'youtube_description']
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export function isCalendarSocialCopy(item: { rag_context?: unknown }) {
  return record(item.rag_context).source === 'social_content_calendar_authorization'
}
export function hasSocialCopyReleaseEvidence(item: CopyRow): boolean {
  // Reuse durable lifecycle evidence, then conservatively lock in-flight or
  // uncertain outcomes even when the provider has not supplied an ID yet.
  const inFlight = ['claimed', 'submitting', 'publishing', 'submitted', 'uncertain', 'ambiguous']
  const gate = record(record(item.rag_context).platform_submission_gate)
  return gate.status === 'partially_submitted' || Object.keys(record(gate.confirmed_platforms)).length > 0 || inFlight.includes(String(gate.status)) || hasSubmissionOrPublishEvidence(item as LifecycleItem) || Boolean(item.scheduled_for) || inFlight.includes(item.status || '') ||
    (Array.isArray(item.publishes) && item.publishes.some(value => ['scheduled', ...inFlight].includes(String(record(value).status))))
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
    release_locked: hasSocialCopyReleaseEvidence(item),
    has_saved_revision: typeof revision.request_version === 'string' && revision.request_version !== version,
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
  if (hasSocialCopyReleaseEvidence(current)) {
    throw new Error('Resolve publication or schedule evidence in the platform recovery gate before changing this copy.')
  }
  if ('rag_context' in patch) {
    const storedRag = record(current.rag_context)
    const safeRag = { ...storedRag, ...record(patch.rag_context) }
    if ('platform_submission_gate' in storedRag) safeRag.platform_submission_gate = storedRag.platform_submission_gate
    else delete safeRag.platform_submission_gate
    patch.rag_context = safeRag
  }
  if (!isCalendarSocialCopy(current)) return patch
  patch.updated_at = new Date(Math.max(Date.parse(now), Date.parse(String(current.updated_at)) + 1 || 0)).toISOString()
  const version = socialCopyVersion(current)
  if (hasSocialCopyReleaseEvidence(current) && (COPY_FIELDS.some(field => field in patch) || 'status' in patch || 'scheduled_for' in patch)) {
    throw new Error('Resolve publication or schedule evidence in the platform recovery gate before changing this copy.')
  }
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
  for (const field of ['calendar_item_id', 'campaign_id', 'copy_approval_invalidated_at', 'platform_submission_orchestration', 'platform_draft_handoff', 'linkedin_draft_handoff']) {
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
    if (changed && currentRag.platform_submission_gate) nextRag.platform_submission_gate = { ...record(currentRag.platform_submission_gate), status: 'pending', approved_at: null, approved_by: null, invalidated_at: now, invalidation_reason: 'copy_version_changed' }
    nextRag.copy_approval_invalidated_at = changed ? now : currentRag.copy_approval_invalidated_at || now
  }
  if (patch.status === 'draft' && (current.status === 'rejected' || existing.request_version)) {
    if (validateSocialContentFinalCopyQuality(candidate as LifecycleItem).status === 'blocked') throw new Error('Remove internal prompts from the public copy before returning it to review.')
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

export function prepareSocialImageAttachment(input: { current: CopyRow; url: unknown; sourceNote: unknown; expectedVersion: unknown; actor: string; now: string; storageOrigin: string }) {
  const {current}=input
  if (!isCalendarSocialCopy(current) || !['draft','rejected','approved'].includes(current.status || '') || hasSocialCopyReleaseEvidence(current)) throw new Error('Resolve the release evidence before attaching an image.')
  if (input.expectedVersion !== socialCopyVersion(current)) throw new Error('Copy changed. Reload before attaching an image.')
  let url: URL
  try { url=new URL(String(input.url)); const origin=new URL(input.storageOrigin); if(url.origin!==origin.origin || !url.pathname.startsWith('/storage/v1/object/public/social-content/') || url.username || url.password || url.search || url.hash || !/\.(png|jpe?g|webp|gif)$/i.test(url.pathname)) throw new Error() } catch { throw new Error('Choose an image from the existing social-content storage bucket.') }
  if(typeof input.sourceNote!=='string'||!input.sourceNote.trim()||input.sourceNote.length>2000)throw new Error('Add the source or approval reference for this image.')
  if(current.image_url===url.href)throw new Error('This image is already attached.')
  const rag=record(current.rag_context)
  const gates=record(rag.section_gate_reviews)
  const nextGates={...gates}
  for(const key of ['visual_assets','asset_packet','privacy','linkedin_draft','platform_draft','submit'])nextGates[key]={...record(gates[key]),status:'pending',invalidated_at:input.now,invalidation_reason:'image_changed'}
  return { image_url:url.href,updated_at:input.now,rag_context:{...rag,section_gate_reviews:nextGates,
    attached_image:{url:url.href,source_note:input.sourceNote.trim(),attached_by:input.actor,attached_at:input.now,privacy_status:'pending',previous_image_url:current.image_url??null},
    previous_image_handoffs:{linkedin:rag.linkedin_draft_handoff??null,platform:rag.platform_draft_handoff??null,production_assets:rag.production_assets??null},
    linkedin_draft_handoff:null,platform_draft_handoff:null,production_assets:null,agentified_visual_qa:null,
    platform_submission_gate:{...record(rag.platform_submission_gate),status:'pending',approved_at:null,approved_by:null,invalidated_at:input.now,invalidation_reason:'image_changed'},
  }}
}
