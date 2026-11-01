'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fetchWithSessionRecovery } from '@/lib/authenticated-fetch'
import { DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'
import type { ReceiptReviewPacket } from '@/lib/dark-castle-receipt-review-packets'

const endpoint = `/api/admin/social-content/${DARK_CASTLE_COPY_CONTENT_ID}/dark-castle-receipt-review`
type Report = { packets: ReceiptReviewPacket[]; fixture: boolean; record_verified: boolean; external_execution: false }

export default function DarkCastleReceiptReviewPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)
  useEffect(() => {
    let active = true
    const fixture = new URLSearchParams(window.location.search).get('qa_fixture') === 'dark_castle_receipt_packets_v1'
    const load = async () => {
      try {
        const response = fixture
          ? await fetch(`${endpoint}?qa_fixture=dark_castle_receipt_packets_v1`)
          : await fetchWithSessionRecovery(endpoint)
        if (!response) throw new Error('Sign in to inspect the canonical record.')
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Unable to inspect the review packets.')
        if (active) setReport(body)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to inspect the review packets.')
      }
    }
    void load()
    return () => { active = false }
  }, [])
  const packet = report?.packets[selected]
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6" data-testid="dark-castle-receipt-review">
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-amber-100">Review candidates · No decisions</span>
        <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">External execution closed</span>
      </div>
      <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Dark Castle YouTube receipt review</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Six separate packets organize the evidence needed before a copy-review receipt can exist. These packets do not record a decision or prepare a Decision Queue item.</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <Link className="font-semibold text-primary underline" href="/admin/social-content/dark-castle-youtube-master-review">View approved master</Link>
        <Link className="font-semibold text-primary underline" href={`/admin/social-content/${DARK_CASTLE_COPY_CONTENT_ID}?step=copy`}>Open canonical record</Link>
      </div>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    {!report && !error && <p role="status" className="text-sm text-muted-foreground">Inspecting version-bound evidence…</p>}
    {report && <>
      <div className="rounded-lg border-l-4 border-amber-400 bg-muted/30 p-4 text-sm" role="status">
        <p className="font-semibold">{report.fixture ? 'Local review fixture' : report.record_verified ? 'Canonical record checked' : 'Canonical record unavailable'}</p>
        <p className="mt-1 break-all text-muted-foreground">Content version: {report.packets[0]?.content_version}</p>
        <p className="mt-1 text-muted-foreground">Each packet lists its current blockers. No review decision is recorded here.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Receipt review packets" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-col">
          {report.packets.map((entry, index) => <button key={entry.kind} type="button" onClick={() => setSelected(index)} aria-current={selected === index ? 'page' : undefined}
            className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm font-semibold ${selected === index ? 'border-amber-300 bg-amber-300/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
            <span className="block text-xs uppercase text-amber-200">{index + 1} / 6</span>{entry.title}
          </button>)}
        </nav>
        {packet && <article className="min-w-0 space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6" aria-labelledby="packet-title">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-300">{packet.kind} · Review candidate</p>
            <h2 id="packet-title" className="mt-1 text-xl font-semibold">{packet.title}</h2>
            <p className="mt-2 break-all text-xs text-muted-foreground">Packet ID: {packet.packet_id}</p>
            <p className="mt-1 text-xs text-muted-foreground">Record timestamp: {packet.content_updated_at}</p>
          </div>
          <section aria-label="Evidence"><h3 className="font-semibold">Evidence to inspect</h3>
            <dl className="mt-2 divide-y divide-border rounded-lg border border-border">
              {packet.evidence.map((entry) => <div key={`${entry.label}:${entry.value}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]"><dt className="text-muted-foreground">{entry.label}</dt><dd className="min-w-0 break-all font-mono text-xs">{entry.value.startsWith('https://') ? <a href={entry.value} target="_blank" rel="noreferrer" className="text-primary underline">{entry.value}</a> : entry.value}</dd></div>)}
            </dl>
          </section>
          <section aria-label="Review questions"><h3 className="font-semibold">Reviewer checks</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{packet.review_questions.map(question => <li key={question}>{question}</li>)}</ol></section>
          <section aria-label="Blockers" className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4"><h3 className="font-semibold text-amber-100">Decision remains blocked</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/90">{packet.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></section>
          <p className="text-xs text-muted-foreground">No receipt ID, decision, approval, provider action, or production mutation was created by this packet.</p>
        </article>}
      </div>
    </>}
  </main>
}
