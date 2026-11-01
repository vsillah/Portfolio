'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchWithSessionRecovery } from '@/lib/authenticated-fetch'
import { DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'

type Report = { ready: boolean; packetPrepared: boolean; blockers: string[]; assetStatus?: string; fixture?: boolean; error?: string; canonical_href?: string }
const endpoint = `/api/admin/social-content/${DARK_CASTLE_COPY_CONTENT_ID}/bind-approved-master`

export default function DarkCastleApprovedBinding() {
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const fixture = new URLSearchParams(window.location.search).get('qa_fixture') === 'dark_castle_binding_readiness_v1'
    const url = fixture ? `${endpoint}?qa_fixture=dark_castle_binding_readiness_v1` : endpoint
    const run = async () => {
      try {
        const response = fixture ? await fetch(url) : await fetchWithSessionRecovery(url)
        if (!response) throw new Error('Sign in to inspect canonical binding readiness.')
        const data = await response.json() as Report
        if (!response.ok) throw new Error(data.error || 'Unable to inspect binding readiness.')
        if (active) setReport(data)
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to inspect binding readiness.') }
    }
    void run()
    return () => { active = false }
  }, [])

  const prepare = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetchWithSessionRecovery(endpoint, { method: 'POST' })
      if (!response) throw new Error('Sign in before preparing the packet.')
      const data = await response.json() as Report
      if (!response.ok || !data.canonical_href) throw new Error(data.error || data.blockers?.join(' ') || 'Atomic preparation failed.')
      setReport({ ...data, ready: true, packetPrepared: true, blockers: [] })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Atomic preparation failed.') }
    finally { setBusy(false) }
  }

  return <section aria-labelledby="dark-castle-binding-heading" className="rounded-xl border border-sky-500/30 bg-card p-4 sm:p-6" data-testid="dark-castle-binding">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase text-sky-300">Canonical operator workflow</p>
        <h2 id="dark-castle-binding-heading" className="mt-1 text-xl font-semibold">Bind approved media and prepare copy review</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">The exact master, Direction C, description, and evidence receipts must match the canonical record. Preparation creates the first internal Decision Queue packet. It records no decision and makes no provider call.</p>
      </div>
      <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">External execution closed</span>
    </div>
    {report ? <div className="mt-4 space-y-3" aria-live="polite">
      <p className="text-sm font-semibold">{report.packetPrepared ? 'Copy-review packet prepared' : report.ready ? 'Ready to prepare' : 'Preparation blocked'}</p>
      {report.assetStatus && <p className="text-sm text-muted-foreground">{report.assetStatus}</p>}
      {report.blockers.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200">{report.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={prepare} disabled={!report.ready || busy || report.fixture || report.packetPrepared}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Preparing…' : 'Bind and prepare copy packet'}
        </button>
        {report.canonical_href && <Link className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary" href={report.canonical_href}>Open Decision Queue packet</Link>}
      </div>
    </div> : <p className="mt-4 text-sm text-muted-foreground">Inspecting canonical receipts…</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <ol className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Ordered review gates">
      {['1 Copy review', '2 Visual review', '3 Asset packet', '4 Privacy', '5 Platform submission'].map(gate => <li key={gate} className="rounded border border-border px-2 py-1">{gate}</li>)}
    </ol>
  </section>
}
