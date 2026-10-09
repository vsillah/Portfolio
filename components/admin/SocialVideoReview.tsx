'use client'
import { currentEditorialReceipt, VIDEO_EDITORIAL_CRITERIA } from '@/lib/video-editorial-quality'
import { useEffect, useState } from 'react'
import { archiveId, classifyVideoUrl, VIDEO_MEDIA_RECOVERY } from '@/lib/video-media-url'
import { getCurrentSession } from '@/lib/auth'
import { LINKEDIN_VIDEO_BLOCKER, reviewRecord, socialVideoAssetVersion, socialVideoReviewReady } from '@/lib/social-video-review'
import AutoSizingScriptTextarea from '@/components/admin/AutoSizingScriptTextarea'

export function ReviewedVideoPlayer({ url, poster, playbackUrl }: { url: string; poster?: string | null; playbackUrl?: string | null }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const media = classifyVideoUrl(url)
  const source = archiveId(url) ? playbackUrl : media.kind === 'remote' && !media.expired ? url : null
  const failed = Boolean(source && failedSource === source)
  if (!source || failed) return <p role="status" className="text-sm text-amber-200">{failed ? 'Video playback failed. Reload for a fresh link; if it still fails, recover the archive.' : media.reason || 'Private playback is unavailable. Reload this review.'} <a className="underline" href="/admin/content/video-generation">Open Video Generation</a></p>
  return <video key={source} onError={() => setFailedSource(source)} aria-label="Final LinkedIn video" controls playsInline preload="metadata" src={source} poster={poster || undefined} className="max-h-96 w-full rounded-lg border border-gray-700 bg-black">Your browser cannot play this video. <a href={source}>Open the final video</a></video>
}
type Item = { platform?: string; target_platforms?: string[] | null; id: string; updated_at: string; status: string; video_url?: string | null; rag_context?: unknown; voiceover_text?: string | null }
type Preview = { packet_version: string; target_version: string; state: string; message: string; source_work_item_id: string; copy: { post_text: string; cta_text: string | null; cta_url: string | null; hashtags: string[] } }
type Eligibility = { eligible: boolean; label: string; blockers: string[] }
type Editorial = { input_version: string; script: string; blockers: string[]; receipt: unknown; screening: { safety: { status: string }; production_quality: { status: string } } }
type Job = { eligibility?: Eligibility; id: string; updated_at: string; heygen_status: string; video_url: string; thumbnail_url: string | null; playback_url?: string | null; media_blocker?: string | null }
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
  const [scriptDraft, setScriptDraft] = useState('')
  const [editorial, setEditorial] = useState<Editorial | null>(null), [checks, setChecks] = useState<Record<string, boolean>>({}), [notes, setNotes] = useState('')
  const [avatarDefaults, setAvatarDefaults] = useState<{ avatarId?: string; voiceId?: string }>({})
  const [preview, setPreview] = useState<Preview | null>(null)
  const [library, setLibrary] = useState<Array<{ id: string; drive_file_name?: string; created_at?: string; media_blocker?: string | null; eligibility?: Eligibility }>>([])
  const [jobId, setJobId] = useState(''), [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [privacy, setPrivacy] = useState(false)
  useEffect(() => { setLibrary([]); setJob(null); setJobId(''); setEditorial(null); setChecks({}); setPrivacy(false) }, [item.id, item.updated_at])
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
    setPrivacy(false); setJob(null); setJobId(''); setLibrary([]); setPreview(null); setEditorial(null); setChecks({}); setNotes('')
    await onRefresh()
    setMessage(result.unchanged ? 'Already synchronized; no changes made.' : 'Saved for internal review. External submission remains separate.')
  }
  const button = 'min-h-11 max-w-full whitespace-normal rounded-lg border border-gray-600 px-3 py-2 text-sm disabled:opacity-50'
  const mediaReady = Boolean(item.video_url && socialVideoReviewReady(item))
  // This is a display projection only. Existing action predicates and server gates remain authoritative.
  const blockers = Array.from(new Set([
    ...(hasUnsavedChanges ? ['Save or reload your copy edits before changing this review.'] : []),
    ...(item.status !== 'approved' ? ['Approve the saved copy before approving media.'] : []),
    ...(!currentEditorialReceipt(item) ? ['Review the saved video script and record editorial evidence for this version.'] : []),
    ...(!item.video_url ? ['Choose an eligible completed video for this campaign.'] : !socialVideoAssetVersion(item) ? ['Attach an eligible video with current campaign and editorial lineage.'] : !mediaReady ? ['Watch the attached version and complete its media review.'] : []),
    ...(editorial?.blockers || []),
    ...(job?.eligibility?.blockers || []),
    ...(job?.media_blocker ? [job.media_blocker] : []),
  ]))
  return <section aria-label="Campaign and video review" className="min-w-0 space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-4">
    <h3 className="font-semibold">Campaign and video review</h3>
    <div aria-label="Video readiness summary" className="space-y-2 text-sm">
      <p className="font-medium">{mediaReady && blockers.length === 0 ? 'Media reviewed for this version' : 'Internal review required'} · {blockers.length} review blocker{blockers.length === 1 ? '' : 's'}</p>
      <p className="text-amber-200">External video submission remains blocked.</p>
      {blockers.length > 0 && <ul className="list-disc space-y-1 pl-5 text-amber-100">{blockers.slice(0, 2).map(reason => <li key={reason}>{reason}</li>)}</ul>}
      <details>
        <summary className="cursor-pointer py-1 text-gray-300">Full blocker evidence and provider boundary{blockers.length > 2 ? ` · ${blockers.length - 2} more review blockers` : ''}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-100">{blockers.slice(2).map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p className="mt-2 text-amber-200">{LINKEDIN_VIDEO_BLOCKER}</p>
      </details>
    </div>
    {rag.calendar_item_id ? <details className="space-y-3">
      <summary className="cursor-pointer text-sm font-medium">Campaign copy and lineage receipts</summary>
      <p className="text-sm text-gray-300">Compare the approved LinkedIn campaign packet with this draft before applying it.</p>
      <button type="button" className={button} disabled={busy} onClick={() => void run(async () => { setPreview(null); setPreview((await request()).preview) })}>Compare approved campaign copy</button>
      {preview && <div className="space-y-2 rounded border border-gray-700 p-3 text-sm">
        <p role="status">{preview.message}</p>
        <a className="text-blue-300 underline" href={`/admin/agents/social-insights/${preview.source_work_item_id}`}>Open campaign review and receipts</a>
        <p className="whitespace-pre-wrap break-words">{preview.copy.post_text}</p><p>{preview.copy.cta_text}</p><p className="break-all">{preview.copy.cta_url}</p><p className="break-words">{preview.copy.hashtags.join(' ')}</p>
        <button type="button" className={button} disabled={busy || hasUnsavedChanges || preview.state !== 'ready' || preview.target_version !== item.updated_at} onClick={() => void run(() => save({ action: 'synchronize', packet_version: preview.packet_version }))}>Apply reviewed copy to this draft</button>
      </div>}
    </details> : null}
    <details className="space-y-3 rounded border border-gray-700 p-3">
      <summary className="cursor-pointer text-sm font-medium">Pre-render editorial review</summary>
      <p className="text-sm text-gray-300">Safety screening checks leakage. Production review checks the spoken story, audience value, voice, evidence, and campaign message. Playback alone qualifies neither.</p>
      <button type="button" className={button} disabled={busy} onClick={() => void run(async () => { const data = await request(undefined, '?editorial=1'); setEditorial(data.editorial); setScriptDraft(data.editorial.script); setAvatarDefaults(data.defaults || {}); setChecks({}); setNotes('') })}>Review saved video script</button>
      {editorial && <div className="space-y-3 text-sm">
        <p>Safety screening: {editorial.screening.safety.status} · Production quality: {editorial.receipt ? 'reviewed for this version' : editorial.screening.production_quality.status.replace('_', ' ')}</p>
        <label className="block">Saved spoken script<AutoSizingScriptTextarea data-social-script-editor="saved-spoken-script" value={scriptDraft} onChange={e => setScriptDraft(e.target.value)} className="mt-1 w-full rounded border border-gray-600 bg-gray-950 p-2" /></label>
        <button type="button" className={button} disabled={busy || hasUnsavedChanges || !scriptDraft.trim() || scriptDraft.trim().length > 5000 || scriptDraft.trim() === editorial.script} onClick={() => void run(() => save({ action: 'save_video_script', input_version: editorial.input_version, script: scriptDraft }))}>Save script · reset editorial and media review</button>
        <p className="break-all">Avatar: {avatarDefaults.avatarId || 'Select a default in Video Generation settings'} · Voice: {avatarDefaults.voiceId || 'Select a default in Video Generation settings'}</p>
        {editorial.blockers.map(reason => <p key={reason} className="text-amber-200">{reason}</p>)}
        <details className="space-y-3">
          <summary className="cursor-pointer font-medium">Editorial checklist and source evidence</summary>
        {Object.entries(VIDEO_EDITORIAL_CRITERIA).map(([key, label]) => <label key={key} className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={checks[key] || false} onChange={e => setChecks({ ...checks, [key]: e.target.checked })} /><span>{label}</span></label>)}
        <label className="block">Editorial evidence and source support<textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 w-full rounded border border-gray-600 bg-gray-950 p-2" /></label>
        </details>
        <p className="text-gray-300">Recording requires a saved script, no editorial blockers, an avatar and voice, every checklist item, and at least 20 characters of source evidence. Copy edits must be saved first.</p>
        <button type="button" className={button} disabled={busy || hasUnsavedChanges || scriptDraft.trim() !== editorial.script || editorial.blockers.length > 0 || !avatarDefaults.avatarId || !avatarDefaults.voiceId || notes.trim().length < 20 || !Object.keys(VIDEO_EDITORIAL_CRITERIA).every(key => checks[key])} onClick={() => void run(() => save({ action: 'approve_editorial', input_version: editorial.input_version, avatar_id: avatarDefaults.avatarId, voice_id: avatarDefaults.voiceId, checks, notes }))}>Record editorial review · no render</button>
      </div>}
    </details>
    <details className="space-y-2">
      <summary className="cursor-pointer text-sm font-medium">Completed videos and eligibility</summary>
      <a className="block text-sm text-blue-300 underline" href="/admin/content/video-generation">Open Video Generation library</a>
      <button type="button" className={button} disabled={busy} onClick={() => void run(async () => { const data = await request(undefined, '?candidates=1'); setLibrary(data.jobs || []); if (!data.jobs?.length) setMessage('No completed videos yet. Open Video Generation to review render status.') })}>Load completed videos</button>
      {library.length > 0 && <label className="block text-sm">Choose a completed video<select value={jobId} onChange={event => { setJobId(event.target.value); setJob(null) }} className="mt-1 w-full min-w-0 rounded border border-gray-600 bg-gray-950 p-2"><option value="">Choose from the latest 50 completed videos</option>{library.map(video => <option key={video.id} value={video.id}>{video.eligibility?.eligible ? 'Eligible · ' : 'Ineligible · history only · '}{video.drive_file_name || 'Completed video'}{video.created_at ? ` · ${new Date(video.created_at).toLocaleDateString()}` : ''} · {video.id.slice(0, 8)}</option>)}</select></label>}
      <details><summary className="cursor-pointer text-sm text-gray-400">Find an older video by job ID</summary><label className="block text-sm">Completed video job ID<input value={jobId} onChange={event => { setJobId(event.target.value); setJob(null) }} className="mt-1 w-full min-w-0 rounded border border-gray-600 bg-gray-950 p-2" /></label></details>
      <button type="button" className={button} disabled={busy || !jobId.trim()} onClick={() => void run(async () => { setJob(null); setJob((await request(undefined, `?job_id=${encodeURIComponent(jobId.trim())}`)).job) })}>Preview completed job</button>
      {job && <div className="space-y-2"><p className="text-sm">Render status: {job.heygen_status} · {job.eligibility?.label || 'Ineligible · history only'}</p>{job.eligibility?.blockers.map(reason => <p role="status" key={reason} className="text-sm text-amber-200">{reason}</p>)}{job.media_blocker && <p role="status" className="text-sm text-amber-200">{job.media_blocker} {VIDEO_MEDIA_RECOVERY}</p>}{job.video_url && !job.media_blocker && <ReviewedVideoPlayer url={job.video_url} poster={job.thumbnail_url} playbackUrl={job.playback_url} />}<button type="button" className={button} disabled={busy || hasUnsavedChanges || !job.eligibility?.eligible || job.heygen_status !== 'completed' || Boolean(job.media_blocker) || !archiveId(job.video_url)} onClick={() => void run(() => save({ action: 'attach_video', job_id: job.id, job_version: job.updated_at }))}>Attach this video · reset media approval</button></div>}
    </details>
    {item.video_url && <details className="space-y-3 text-sm">
      <summary className="cursor-pointer font-medium">Attached media review and audit detail</summary>
      <p>Render: attached · Media: {socialVideoReviewReady(item) ? 'approved for this version' : 'review required'} · External submission: blocked</p>
      <p className="break-all text-gray-400">Job: {String(asset.job_id || 'attach a completed job to bind this asset')}</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={privacy} onChange={event => setPrivacy(event.target.checked)} className="mt-1" /><span>I watched this version and checked its content, rights, and privacy.</span></label>
      <button type="button" className={button} disabled={busy || hasUnsavedChanges || !privacy || item.status !== 'approved' || !socialVideoAssetVersion(item) || socialVideoReviewReady(item)} onClick={() => void run(() => save({ action: 'approve_media', asset_version: socialVideoAssetVersion(item), privacy_confirmed: privacy }))}>Approve this media version</button>
      {item.status !== 'approved' && <p>Approve the saved copy before approving media.</p>}
      <p className="text-gray-300">Approval requires saved copy approval, current asset provenance, and the viewing confirmation above. An already approved version cannot be approved again.</p>
    </details>}
    {message && <p role="status" className="break-words text-sm text-amber-100">{message}</p>}
  </section>
}
