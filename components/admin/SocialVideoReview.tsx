'use client'
import { useEffect, useState } from 'react'
import { getCurrentSession } from '@/lib/auth'
import { LINKEDIN_VIDEO_BLOCKER, reviewRecord, socialVideoAssetVersion, socialVideoReviewReady } from '@/lib/social-video-review'

export function ReviewedVideoPlayer({ url, poster }: { url: string; poster?: string | null }) {
  return <video key={url} aria-label="Final LinkedIn video" controls playsInline preload="metadata" src={url} poster={poster || undefined} className="max-h-96 w-full rounded-lg border border-gray-700 bg-black">Your browser cannot play this video. <a href={url}>Open the final video</a></video>
}
type Item = { platform?: string; target_platforms?: string[] | null; id: string; updated_at: string; status: string; video_url?: string | null; rag_context?: unknown }
type Preview = { packet_version: string; target_version: string; state: string; message: string; source_work_item_id: string; copy: { post_text: string; cta_text: string | null; cta_url: string | null; hashtags: string[] } }
type Job = { id: string; updated_at: string; heygen_status: string; video_url: string; thumbnail_url: string | null }
/** Cross-channel eligibility comes only from the server-validated linked packet. */
export function LinkedInReviewSurface(props: { item: Item; hasUnsavedChanges?: boolean; onRefresh: () => Promise<unknown> }) {
  const { item } = props
  const nativeLinkedIn = item.platform === 'linkedin' || item.target_platforms?.includes('linkedin') === true
  const calendarId = reviewRecord(item.rag_context).calendar_item_id
  const key = `${item.id}:${String(calendarId)}`
  const [eligibleKey, setEligibleKey] = useState<string | null>(null)
  useEffect(() => {
    if (nativeLinkedIn || !calendarId) return
    const controller = new AbortController()
    void (async () => {
      try {
        const session = await getCurrentSession()
        if (!session || controller.signal.aborted) return
        const response = await fetch(`/api/admin/social-content/${item.id}/review-handoff`, { cache: 'no-store', signal: controller.signal, headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await response.json()
        if (!controller.signal.aborted) setEligibleKey(response.ok && data.preview?.packet_version ? key : null)
      } catch { if (!controller.signal.aborted) setEligibleKey(null) }
    })()
    return () => controller.abort()
  }, [nativeLinkedIn, calendarId, item.id, item.updated_at, key])
  return nativeLinkedIn || eligibleKey === key ? <SocialVideoReview {...props} /> : null
}
export default function SocialVideoReview({ item, onRefresh, hasUnsavedChanges = false }: { item: Item; hasUnsavedChanges?: boolean; onRefresh: () => Promise<unknown> }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [library, setLibrary] = useState<Array<{ id: string; drive_file_name?: string; created_at?: string }>>([])
  const [jobId, setJobId] = useState(''), [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [privacy, setPrivacy] = useState(false)
  const rag = reviewRecord(item.rag_context), asset = reviewRecord(rag.reviewed_video_asset)
  async function request(body?: Record<string, unknown>, query = '', path?: string) {
    const session = await getCurrentSession()
    if (!session) throw new Error('Sign in again to review this item.')
    const response = await fetch(path || `/api/admin/social-content/${item.id}/review-handoff${query}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify({ ...body, expected_updated_at: item.updated_at }) } : {}) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Review unavailable.')
    return data
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : 'Review failed.') } finally { setBusy(false) }
  }
  async function save(body: Record<string, unknown>) {
    if (hasUnsavedChanges) throw new Error('Save or reload your copy edits before changing this review.')
    const result = await request(body)
    setPrivacy(false); setJob(null); setPreview(null)
    await onRefresh()
    setMessage(result.unchanged ? 'Already synchronized; no changes made.' : 'Saved for internal review. External submission remains separate.')
  }
  const button = 'rounded-lg border border-gray-600 px-3 py-2 text-sm disabled:opacity-50'
  return <section aria-label="Campaign and video review" className="min-w-0 space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-4">
    <h3 className="font-semibold">Campaign and video review</h3>
    {hasUnsavedChanges && <p role="status" className="text-sm text-amber-200">Save or reload your copy edits before changing this review.</p>}
    {rag.calendar_item_id ? <div className="space-y-3">
      <p className="text-sm text-gray-300">Compare the approved LinkedIn campaign packet with this draft before applying it.</p>
      <button type="button" className={button} disabled={busy} onClick={() => void run(async () => { setPreview(null); setPreview((await request()).preview) })}>Compare approved campaign copy</button>
      {preview && <div className="space-y-2 rounded border border-gray-700 p-3 text-sm">
        <p role="status">{preview.message}</p>
        <a className="text-blue-300 underline" href={`/admin/agents/social-insights/${preview.source_work_item_id}`}>Open campaign review and receipts</a>
        <p className="whitespace-pre-wrap break-words">{preview.copy.post_text}</p><p>{preview.copy.cta_text}</p><p className="break-all">{preview.copy.cta_url}</p><p className="break-words">{preview.copy.hashtags.join(' ')}</p>
        <button type="button" className={button} disabled={busy || hasUnsavedChanges || preview.state !== 'ready' || preview.target_version !== item.updated_at} onClick={() => void run(() => save({ action: 'synchronize', packet_version: preview.packet_version }))}>Apply reviewed copy to this draft</button>
      </div>}
    </div> : null}
    <div className="space-y-2">
      <a className="text-sm text-blue-300 underline" href="/admin/content/video-generation">Open Video Generation library</a>
      <button type="button" className={button} disabled={busy} onClick={() => void run(async () => { const data = await request(undefined, '', '/api/admin/video-generation/jobs?status=completed&limit=50'); setLibrary(data.jobs || []); if (!data.jobs?.length) setMessage('No completed videos yet. Open Video Generation to review render status.') })}>Load completed videos</button>
      {library.length > 0 && <label className="block text-sm">Choose a completed video<select value={jobId} onChange={event => { setJobId(event.target.value); setJob(null) }} className="mt-1 w-full min-w-0 rounded border border-gray-600 bg-gray-950 p-2"><option value="">Choose from the latest 50 completed videos</option>{library.map(video => <option key={video.id} value={video.id}>{video.drive_file_name || 'Completed video'}{video.created_at ? ` · ${new Date(video.created_at).toLocaleDateString()}` : ''} · {video.id.slice(0, 8)}</option>)}</select></label>}
      <details><summary className="cursor-pointer text-sm text-gray-400">Find an older video by job ID</summary><label className="block text-sm">Completed video job ID<input value={jobId} onChange={event => { setJobId(event.target.value); setJob(null) }} className="mt-1 w-full min-w-0 rounded border border-gray-600 bg-gray-950 p-2" /></label></details>
      <button type="button" className={button} disabled={busy || !jobId.trim()} onClick={() => void run(async () => { setJob(null); setJob((await request(undefined, `?job_id=${encodeURIComponent(jobId.trim())}`)).job) })}>Preview completed job</button>
      {job && <div className="space-y-2"><p className="text-sm">Render status: {job.heygen_status}</p>{job.video_url && <ReviewedVideoPlayer url={job.video_url} poster={job.thumbnail_url} />}<button type="button" className={button} disabled={busy || hasUnsavedChanges || job.heygen_status !== 'completed'} onClick={() => void run(() => save({ action: 'attach_video', job_id: job.id, job_version: job.updated_at }))}>Attach this video · reset media approval</button></div>}
    </div>
    {item.video_url && <div className="space-y-3 text-sm">
      <p>Render: attached · Media: {socialVideoReviewReady(item) ? 'approved for this version' : 'review required'} · External submission: blocked</p>
      <p className="break-all text-gray-400">Job: {String(asset.job_id || 'attach a completed job to bind this asset')}</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={privacy} onChange={event => setPrivacy(event.target.checked)} className="mt-1" /><span>I watched this version and checked its content, rights, and privacy.</span></label>
      <button type="button" className={button} disabled={busy || hasUnsavedChanges || !privacy || item.status !== 'approved' || !socialVideoAssetVersion(item) || socialVideoReviewReady(item)} onClick={() => void run(() => save({ action: 'approve_media', asset_version: socialVideoAssetVersion(item), privacy_confirmed: privacy }))}>Approve this media version</button>
      {item.status !== 'approved' && <p>Approve the saved copy before approving media.</p>}
      <p className="text-amber-200">{LINKEDIN_VIDEO_BLOCKER}</p>
    </div>}
    {message && <p role="status" className="break-words text-sm text-amber-100">{message}</p>}
  </section>
}
