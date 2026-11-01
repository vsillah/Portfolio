'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fetchWithSessionRecovery } from '@/lib/authenticated-fetch'
import { DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'
import type { ReceiptReviewPacket } from '@/lib/dark-castle-receipt-review-packets'

const endpoint = `/api/admin/social-content/${DARK_CASTLE_COPY_CONTENT_ID}/dark-castle-receipt-review`
type Report = { packets: ReceiptReviewPacket[]; fixture: boolean; record_verified: boolean; recorded: boolean; can_record: boolean; persisted_receipt_ids?: string[]; persistence_error?: string | null; external_execution: false }

export default function DarkCastleReceiptReviewPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(0)
  const [reviewed, setReviewed] = useState<string[]>([])
  const [recording, setRecording] = useState(false)
  const [recordResult, setRecordResult] = useState('')
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
  const recordReceipts = async () => {
    if (!report?.can_record || reviewed.length !== 6 || recording) return
    setRecording(true); setError('')
    try {
      const response = await fetchWithSessionRecovery(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_packet_ids: reviewed }) })
      if (!response) throw new Error('Sign in to record the reviewed receipts.')
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Atomic receipt recording failed.')
      setRecordResult(`Six receipts recorded at ${body.result.content_updated_at}. Copy review remains unprepared.`)
      setReport({ ...report, recorded: true, can_record: false })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Receipt recording failed.') }
    finally { setRecording(false) }
  }
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6" data-testid="dark-castle-receipt-review">
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-amber-100">{report?.recorded ? 'Six prerequisites recorded' : 'Review candidates · Prerequisites pending'}</span>
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
        <p className="mt-1 text-muted-foreground">{report.recorded ? 'A persisted receipt bundle exists. Inspect canonical state before any subsequent step.' : 'Review all six exact packets before recording one atomic bundle.'}</p>
      </div>
      <section aria-label="Receipt recording" className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">Atomic prerequisite receipt recording</h2>
        <p className="mt-1 text-sm text-muted-foreground">Persistence: six immutable receipt rows and the canonical copy_review_evidence_receipts bundle. Each receipt binds its packet ID, fingerprint, source timestamp, reviewer, and approved artifact hashes. This action does not prepare copy review or contact a provider.</p>
        <p className="mt-2 text-sm">State: <strong>{report.fixture ? 'Local fixture · recording disabled' : report.recorded ? 'Recorded; inspect persisted identities' : report.can_record ? 'Ready for six reviewer acknowledgments' : 'Blocked by packet evidence'}</strong></p>
        {report.persistence_error && <p role="alert" className="mt-2 text-sm text-amber-200">{report.persistence_error}</p>}
        {report.recorded && <ul className="mt-2 space-y-1 text-xs font-mono">{report.persisted_receipt_ids?.map(id => <li key={id} className="break-all">{id}</li>)}</ul>}
        <p className="mt-1 text-xs text-muted-foreground">Replay uses the same six identities and returns the persisted result without a second insert. Any different identity or lineage is rejected.</p>
        {recordResult && <p role="status" className="mt-3 rounded border border-green-400/40 p-3 text-sm">{recordResult}</p>}
        <button type="button" onClick={recordReceipts} disabled={!report.can_record || reviewed.length !== 6 || recording}
          className="mt-3 min-h-11 rounded border border-amber-300 bg-amber-300 px-4 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
          {recording ? 'Recording six receipts…' : 'Record six approved prerequisite receipts'}
        </button>
        {!report.can_record && <p className="mt-2 text-xs text-amber-200">Recording stays disabled until the exact canonical record and all six packet bindings pass.</p>}
      </section>
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
            <p className="mt-1 break-all text-xs text-muted-foreground">Planned receipt ID: {packet.packet_id}:approved</p>
            <p className="mt-1 text-xs text-muted-foreground">Evidence fingerprint: {packet.packet_id.split(':').at(-1)}</p>
          </div>
          <section aria-label="Evidence"><h3 className="font-semibold">Evidence to inspect</h3>
            <dl className="mt-2 divide-y divide-border rounded-lg border border-border">
              {packet.evidence.map((entry) => <div key={`${entry.label}:${entry.value}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]"><dt className="text-muted-foreground">{entry.label}</dt><dd className="min-w-0 break-all font-mono text-xs">{entry.value.startsWith('https://') ? <a href={entry.value} target="_blank" rel="noreferrer" className="text-primary underline">{entry.value}</a> : entry.value}</dd></div>)}
            </dl>
          </section>
          <section aria-label="Review questions"><h3 className="font-semibold">Reviewer checks</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{packet.review_questions.map(question => <li key={question}>{question}</li>)}</ol></section>
          <section aria-label="Blockers" className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4"><h3 className="font-semibold text-amber-100">Decision remains blocked</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/90">{packet.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></section>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" className="mt-1" disabled={!report.can_record}
            checked={reviewed.includes(packet.packet_id)} onChange={event => setReviewed(previous => event.target.checked ? [...previous, packet.packet_id] : previous.filter(id => id !== packet.packet_id))} />
            <span>I reviewed this exact packet and approve its prerequisite receipt for the listed artifact bindings.</span></label>
          <p className="text-xs text-muted-foreground">No receipt ID, decision, approval, provider action, or production mutation was created by this packet.</p>
        </article>}
      </div>
    </>}
  </main>
}
