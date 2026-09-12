import { isSocialReleaseLocked, socialReleaseGate } from './social-release-safety'

type Row = Record<string, any>
type Admin = { from: (table: string) => any }
export class SocialQueueWriteConflict extends Error {
  constructor(message = 'Content changed or a release is in progress. Reload the current record; do not overwrite release evidence.') {
    super(message)
    this.name = 'SocialQueueWriteConflict'
  }
}
export function assertSocialQueueWritable(row: Row | null | undefined): void {
  if (!row || typeof row.id !== 'string' || typeof row.updated_at !== 'string' || !row.updated_at ||
    typeof row.status !== 'string' || ['scheduled', 'publishing', 'published'].includes(row.status) ||
    Boolean(row.scheduled_for || row.published_at || row.platform_post_id || row.platform_post_url) || isSocialReleaseLocked(row.rag_context)) throw new SocialQueueWriteConflict()
}
/** Bounded legacy-evidence check, not a cross-table transaction or dispatch claim. */
export async function assertSocialQueuePublicationClear(admin: Admin, id: string): Promise<void> {
  const { data, error } = await admin.from('social_content_publishes')
    .select('status,platform_post_id,platform_post_url,published_at').eq('content_id', id).limit(7)
  if (error || !Array.isArray(data) || data.length >= 7 || data.some(row =>
    ['scheduled', 'publishing', 'published', 'submitting', 'uncertain', 'ambiguous'].includes(row.status) ||
    row.platform_post_id || row.platform_post_url || row.published_at)) throw new SocialQueueWriteConflict('Existing provider publication evidence requires reconciliation before editing.')
}
export async function readSocialQueueForWrite(admin: Admin, id: string): Promise<Row> {
  const { data, error } = await admin.from('social_content_queue').select('*').eq('id', id).single()
  if (error) throw new SocialQueueWriteConflict('Current content could not be read. Reload before preparing changes.')
  assertSocialQueueWritable(data)
  await assertSocialQueuePublicationClear(admin, id)
  return data
}
/** Every asynchronous producer must retain its original row and use this CAS at completion. */
export async function updateSocialQueueWithVersion(admin: Admin, original: Row, patch: Row): Promise<{ data: Row; error: { message: string } | null }> {
  assertSocialQueueWritable(original)
  await assertSocialQueuePublicationClear(admin, original.id)
  const currentContext = original.rag_context && typeof original.rag_context === 'object' ? original.rag_context : {}
  const incomingContext = patch.rag_context && typeof patch.rag_context === 'object' ? patch.rag_context : {}
  const gate = socialReleaseGate(currentContext)
  const context = { ...currentContext, ...incomingContext }
  delete context.platform_submission_gate
  if (Object.keys(gate).length) context.platform_submission_gate = {
    ...gate, status: 'pending', approved_fingerprint: null, invalidated_reason: 'Preparation changed the reviewed content; final approval is required again.',
  }
  const { data, error } = await admin.from('social_content_queue')
    .update({ ...patch, rag_context: context })
    .eq('id', original.id).eq('updated_at', original.updated_at).eq('status', original.status)
    .select('*').maybeSingle()
  if (error || !data) throw new SocialQueueWriteConflict()
  return { data, error: null }
}
