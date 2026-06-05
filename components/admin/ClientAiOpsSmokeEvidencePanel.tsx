import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, RefreshCw, ShieldCheck } from 'lucide-react'

export type ClientAiOpsSmokeEvidenceStatus = 'pending_capture' | 'ready_for_review' | 'needs_redaction' | 'blocked'

export type ClientAiOpsSmokeEvidenceReview = {
  clientProjectId: string
  source: string
  sideEffectsEnabled: boolean
  capturesAccepted: boolean
  nextAction: string
  approvalBoundary: {
    liveSetupActions: string
    evidencePersistence: string
    clientDataMutation: string
  }
  smokeEvidence: {
    summary: {
      totalTargets: number
      pendingCapture: number
      readyForReview: number
      needsRedaction: number
      blocked: number
    }
    items: Array<{
      surface: string
      path: string
      status: ClientAiOpsSmokeEvidenceStatus
      missingEvidence: string[]
      screenshotPath: string | null
      nextAction: string
      clientSafe: boolean
      sideEffectFree: boolean
    }>
    reviewerChecklist: string[]
    forbiddenActions: string[]
  }
}

type ClientAiOpsSmokeEvidencePanelProps = {
  review: ClientAiOpsSmokeEvidenceReview | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
}

const statusTone: Record<ClientAiOpsSmokeEvidenceStatus, string> = {
  pending_capture: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
  ready_for_review: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200',
  needs_redaction: 'border-red-500/35 bg-red-500/10 text-red-200',
  blocked: 'border-red-500/45 bg-red-500/15 text-red-100',
}

export default function ClientAiOpsSmokeEvidencePanel({
  review,
  loading = false,
  error = null,
  onRefresh,
}: ClientAiOpsSmokeEvidencePanelProps) {
  const summary = review?.smokeEvidence.summary
  const items = review?.smokeEvidence.items ?? []

  return (
    <div className="mb-4 rounded-lg border border-silicon-slate/60 bg-background/45 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">Smoke evidence review</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">Manual smoke packet</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            Review authenticated smoke evidence for synthetic or explicitly test-owned data before any live setup is approved.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-200">
            Live setup locked
          </span>
          <span className="rounded-full border border-silicon-slate/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
            {review?.capturesAccepted ? 'Capture intake enabled' : 'Review only'}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 px-2.5 py-1 text-xs font-medium text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
            >
              <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !review && (
        <div className="mt-3 rounded-lg border border-silicon-slate/60 bg-imperial-navy/45 p-3 text-sm text-muted-foreground">
          Loading smoke evidence template...
        </div>
      )}

      {summary && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Ready" value={summary.readyForReview} tone="text-emerald-300" />
          <Metric label="Pending" value={summary.pendingCapture} tone="text-amber-300" />
          <Metric label="Redaction" value={summary.needsRedaction} tone="text-red-200" />
          <Metric label="Blocked" value={summary.blocked} tone="text-red-300" />
        </div>
      )}

      {review && (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {items.map((item) => (
            <div key={`${item.surface}-${item.path}`} className="rounded-lg border border-silicon-slate/60 bg-imperial-navy/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.surface}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.path}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] capitalize ${statusTone[item.status]}`}>
                  {item.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-[11px] leading-5 text-muted-foreground">
                <div className="flex gap-2">
                  <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-radiant-gold" />
                  <span>{item.screenshotPath ?? 'Screenshot path pending'}</span>
                </div>
                <div className="flex gap-2">
                  <ClipboardCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-radiant-gold" />
                  <span>{item.nextAction}</span>
                </div>
              </div>
              {item.missingEvidence.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] leading-5 text-amber-100">
                  {item.missingEvidence.length} evidence item{item.missingEvidence.length === 1 ? '' : 's'} pending
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {review && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Review checklist
            </div>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-emerald-100/85">
              {review.smokeEvidence.reviewerChecklist.slice(0, 3).map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-200">
              <AlertTriangle className="h-4 w-4" />
              Approval boundary
            </div>
            <p className="mt-2 text-xs leading-5 text-red-100/85">{review.nextAction}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {review.smokeEvidence.forbiddenActions.slice(0, 5).map((action) => (
                <span key={action} className="rounded-full border border-red-500/25 bg-background/35 px-2 py-0.5 text-[10px] text-red-100">
                  {action}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/45 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  )
}
