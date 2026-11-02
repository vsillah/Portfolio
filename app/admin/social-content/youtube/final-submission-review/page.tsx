'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import { socialContentDecisionHref } from '@/lib/social-content-decision-routing'

type Item = { id: string; platform: string; updated_at: string; rag_context?: Record<string, any> }
type State = { item: Item | null; error: string; loading: boolean; preparing: boolean; href: string }

export default function YouTubeFinalSubmissionReviewPage() {
  const contentId = useSearchParams().get('content') || ''
  const [state, setState] = useState<State>({ item: null, error: '', loading: true, preparing: false, href: '' })

  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(contentId)) {
      setState(previous => ({ ...previous, loading: false, error: 'Open this review from an exact Social Content record.' }))
      return
    }
    let active = true
    getCurrentSession().then(session => {
      if (!session) throw new Error('Admin sign-in required.')
      return fetch(`/api/admin/social-content/${encodeURIComponent(contentId)}`, {
        cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` },
      })
    })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load Social Content.')
        if (active) setState(previous => ({ ...previous, item: body.item, loading: false, error: '' }))
      }).catch(error => { if (active) setState(previous => ({ ...previous, loading: false, error: error.message })) })
    return () => { active = false }
  }, [contentId])

  const rag = state.item?.rag_context
  const master = rag?.dark_castle_master_binding
  const thumbnail = rag?.dark_castle_thumbnail_binding
  const privacy = rag?.latest_internal_decision_receipt_id
  const existing = rag?.mobile_decision_review
  const ready = state.item?.platform === 'youtube' && rag?.current_gate === 'platform_submission'
    && rag?.latest_internal_decision === 'approve' && rag?.latest_internal_decision_command === 'approve_privacy'
    && typeof privacy === 'string' && typeof master?.sha256 === 'string'
    && typeof thumbnail?.sha256 === 'string' && typeof thumbnail?.direction === 'string'
  const canPrepare = ready && existing?.current_gate !== 'platform_submission'

  async function prepare() {
    if (!state.item || !canPrepare) return
    setState(previous => ({ ...previous, preparing: true, error: '' }))
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Admin sign-in required.')
      const response = await fetch(`/api/admin/social-content/${encodeURIComponent(state.item.id)}/prepare-youtube-platform-submission-review`, {
        method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ expected_content_updated_at: state.item.updated_at,
          privacy_decision_receipt_id: privacy, content_version: rag?.content_version,
          master_sha256: master.sha256, thumbnail_sha256: thumbnail.sha256,
          thumbnail_direction: thumbnail.direction }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Preparation failed. Reload the record and review its evidence.')
      setState(previous => ({ ...previous, preparing: false, href: body.canonical_href }))
    } catch (error) {
      setState(previous => ({ ...previous, preparing: false, error: error instanceof Error ? error.message : 'Preparation failed.' }))
    }
  }

  const queueHref = state.href || (existing?.current_gate === 'platform_submission' && existing?.platform === 'youtube'
    && typeof existing?.work_item_id === 'string' && state.item
    ? socialContentDecisionHref({ contentId: state.item.id, workItemId: existing.work_item_id, gate: 'platform_submission' }) : '')

  return <ProtectedRoute requireAdmin><main className="mx-auto max-w-3xl space-y-5 p-6" aria-labelledby="youtube-final-review-title">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Internal review · YouTube</p>
      <h1 id="youtube-final-review-title" className="mt-2 text-2xl font-bold">Final platform-submission packet</h1>
      <p className="mt-2 text-sm text-muted-foreground">Prepare one version-bound Decision Queue packet from the approved privacy decision, master, thumbnail, candidate, and six immutable prerequisites.</p>
    </div>
    <section className="rounded-xl border border-gray-700 p-5 text-sm" aria-label="Packet identity">
      {state.loading ? <p>Loading current record…</p> : state.item ? <div className="space-y-2 break-all">
        <p><strong>Record:</strong> {state.item.id}</p>
        <p><strong>Channel:</strong> {state.item.platform}</p>
        <p><strong>Current gate:</strong> {rag?.current_gate || 'missing'}</p>
        <p><strong>Content version:</strong> {rag?.content_version || 'missing'}</p>
        <p><strong>Privacy decision:</strong> {privacy || 'missing'}</p>
        <p><strong>Master SHA-256:</strong> {master?.sha256 || 'missing'}</p>
        <p><strong>Thumbnail:</strong> {thumbnail?.direction || 'missing'} · {thumbnail?.sha256 || 'missing'}</p>
      </div> : <p>No record loaded.</p>}
    </section>
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">This prepares an internal packet only. It does not record a decision, call YouTube, create a platform draft, upload, schedule, or publish.</p>
    {state.error && <p role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm text-red-200">{state.error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => void prepare()} disabled={!canPrepare || state.preparing || state.loading}
        className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
        {state.preparing ? 'Preparing…' : 'Prepare Decision Queue packet'}
      </button>
      {queueHref && <Link href={queueHref} className="rounded-lg border border-gray-600 px-4 py-2 font-semibold">Open protected Decision Queue</Link>}
      {state.item && <Link href={`/admin/social-content/${encodeURIComponent(state.item.id)}?step=submit#social-platform-submission-gate`}
        className="rounded-lg border border-gray-600 px-4 py-2">Back to Social Content</Link>}
    </div>
    {!ready && !state.loading && state.item && <p role="status" className="text-sm text-amber-200">The exact YouTube privacy approval and media bindings must be current before preparation is available.</p>}
  </main></ProtectedRoute>
}
