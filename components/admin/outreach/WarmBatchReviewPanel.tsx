'use client'

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react'
import type {
  WarmBatchReview,
  WarmBatchReviewRecipient,
} from '@/lib/warm-outreach-batch-review'

interface WarmBatchReviewPanelProps {
  data: WarmBatchReview | null
  loading: boolean
  error: string | null
  selectedCount: number
  onReview: () => void
}

function statusLabel(status: WarmBatchReviewRecipient['status']) {
  if (status === 'ready_for_review') return 'Ready'
  if (status === 'existing_draft') return 'Existing draft'
  return 'Blocked'
}

function statusClasses(status: WarmBatchReviewRecipient['status']) {
  if (status === 'ready_for_review') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  if (status === 'existing_draft') return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  return 'border-red-500/35 bg-red-500/10 text-red-100'
}

function BoundaryFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs ${
        active
          ? 'border-red-500/30 bg-red-500/10 text-red-100'
          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
      }`}
    >
      {label}: {active ? 'enabled' : 'off'}
    </span>
  )
}

function RecipientRow({ recipient }: { recipient: WarmBatchReviewRecipient }) {
  const primaryBlocker = recipient.blockers[0]

  return (
    <li className="grid gap-3 border-t border-silicon-slate/70 py-3 first:border-t-0 md:grid-cols-[minmax(10rem,0.9fr)_minmax(0,1.35fr)_minmax(9rem,0.7fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{recipient.contactName}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(recipient.status)}`}>
            {statusLabel(recipient.status)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {recipient.company ?? 'No company recorded'}
        </p>
      </div>

      <div className="min-w-0 text-sm leading-5">
        <p className="text-foreground">{recipient.relationshipBasis}</p>
        <p className="mt-1 text-muted-foreground">
          {recipient.selectedChannel ?? 'no channel'} / {recipient.selectedTemplate.replace(/_/g, ' ')}
          {recipient.promptTemplateKey ? ` / ${recipient.promptTemplateKey}` : ''}
        </p>
        {primaryBlocker && (
          <p className="mt-1 flex items-start gap-2 text-red-100">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>{primaryBlocker}</span>
          </p>
        )}
      </div>

      <div className="min-w-0 text-xs leading-5 text-muted-foreground">
        <p>Signals: {recipient.relationshipSignalCount}</p>
        <p>Suppression: {recipient.suppressionStatus}</p>
        {recipient.existingQueueId && <p className="truncate">Queue: {recipient.existingQueueId}</p>}
      </div>
    </li>
  )
}

export default function WarmBatchReviewPanel({
  data,
  loading,
  error,
  selectedCount,
  onReview,
}: WarmBatchReviewPanelProps) {
  const sample = data?.samplePreview
  const hasSelection = selectedCount > 0

  return (
    <section
      className="mb-6 rounded-xl border border-sky-500/30 bg-sky-950/10 p-3 sm:p-4"
      aria-label="Warm batch review"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-sky-100">
            <Users size={16} className="text-radiant-gold" aria-hidden />
            Warm batch review
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review selected warm leads as individualized recipients before any draft or send authority.
          </p>
        </div>
        <button
          type="button"
          onClick={onReview}
          disabled={!hasSelection || loading}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" aria-hidden /> : <FileText size={15} aria-hidden />}
          {loading ? 'Reviewing...' : `Review ${selectedCount} selected`}
        </button>
      </div>

      {!hasSelection && (
        <p className="mt-3 rounded-md border border-silicon-slate bg-silicon-slate/25 p-3 text-sm text-muted-foreground">
          Select warm leads from the list to assemble a batch review.
        </p>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.55fr)]">
            <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Cohort provenance
              </p>
              <p className="mt-1 text-sm leading-5 text-foreground">{data.cohort.provenance}</p>
              <p className="mt-2 break-all text-xs text-muted-foreground">
                {data.batchIdempotencyKey}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Ready</p>
                <p className="text-lg font-semibold text-emerald-100">{data.summary.readyCount}</p>
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Blocked</p>
                <p className="text-lg font-semibold text-red-100">{data.summary.blockedCount}</p>
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Existing</p>
                <p className="text-lg font-semibold text-sky-100">{data.summary.existingDraftCount}</p>
              </div>
              <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
                <p className="text-muted-foreground">Weak basis</p>
                <p className="text-lg font-semibold text-amber-100">{data.summary.weakBasisCount}</p>
              </div>
            </div>
          </div>

          {sample && (
            <div className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {sample.status === 'blocked' ? (
                  <AlertTriangle size={15} className="text-amber-200" aria-hidden />
                ) : (
                  <CheckCircle2 size={15} className="text-emerald-200" aria-hidden />
                )}
                <p className="text-sm font-medium text-foreground">Sample individualized preview</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(sample.status)}`}>
                  {statusLabel(sample.status)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">{sample.individualizedDraftPreview}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <BoundaryFlag label="Provider calls" active={data.executionBoundary.providerCalls} />
            <BoundaryFlag label="Draft creation" active={data.executionBoundary.createsDraft} />
            <BoundaryFlag label="External send" active={data.executionBoundary.externalSend} />
            <BoundaryFlag label="Gmail draft" active={data.executionBoundary.gmailDraft} />
            <BoundaryFlag label="n8n" active={data.executionBoundary.n8nDispatch} />
            <BoundaryFlag label="Slack" active={data.executionBoundary.slackAction} />
          </div>

          <details className="rounded-lg border border-silicon-slate/70 bg-background/45 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
              <span>Full recipient list ({data.recipients.length})</span>
              <ChevronDown size={16} aria-hidden />
            </summary>
            <ul className="mt-3">
              {data.recipients.map((recipient) => (
                <RecipientRow key={recipient.contactId} recipient={recipient} />
              ))}
            </ul>
          </details>

          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <LockKeyhole size={14} className="mt-0.5 shrink-0" aria-hidden />
            Every row remains review-only. Suppressed, removed, unsubscribed, weak-basis, Facebook, and phone-only rows are blocked before draft generation or send authority.
          </p>
        </div>
      )}
    </section>
  )
}
