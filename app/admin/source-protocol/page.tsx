'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  CircleDollarSign,
  Database,
  FileText,
  ShieldCheck,
  Users,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type SourceProtocolOverview = {
  available: boolean
  generatedAt: string
  reason?: string
  migration?: string
  summary?: {
    creators: number
    works: number
    activeGrants: number
    retrievableChunks: number
    answerReceipts: number
    monthlyPayouts: number
    openDisputes: number
    heldPayouts: number
    accruedPayoutUsd: number
  }
  creators?: any[]
  works?: any[]
  licenseGrants?: any[]
  chunks?: any[]
  receipts?: any[]
  receiptChunks?: any[]
  monthlyPayouts?: any[]
  disputes?: any[]
  modelReviews?: any[]
}

type TabKey = 'creators' | 'works' | 'grants' | 'chunks' | 'receipts' | 'payouts' | 'reviews'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'creators', label: 'Creators' },
  { key: 'works', label: 'Works' },
  { key: 'grants', label: 'Grants' },
  { key: 'chunks', label: 'Chunks' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'reviews', label: 'Model Reviews' },
]

export default function SourceProtocolPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SourceProtocolContent />
    </ProtectedRoute>
  )
}

function SourceProtocolContent() {
  const [overview, setOverview] = useState<SourceProtocolOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('receipts')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/source-protocol/overview', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setOverview(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load source protocol overview')
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const summary = overview?.summary
  const hasOpenRightsIssue = Boolean(summary && (summary.openDisputes > 0 || summary.heldPayouts > 0))
  const tabCounts = useMemo(
    () => ({
      creators: overview?.creators?.length ?? 0,
      works: overview?.works?.length ?? 0,
      grants: overview?.licenseGrants?.length ?? 0,
      chunks: overview?.chunks?.length ?? 0,
      receipts: overview?.receipts?.length ?? 0,
      payouts: overview?.monthlyPayouts?.length ?? 0,
      reviews: overview?.modelReviews?.length ?? 0,
    }),
    [overview]
  )

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Source Protocol' },
        ]} />

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Source Protocol</h1>
            <p className="text-muted-foreground text-sm max-w-3xl">
              Read-only operating view for opt-in creator content, active license grants, cited answer receipts, and monthly payout settlement.
            </p>
          </div>
          <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 px-4 py-3 text-xs text-muted-foreground">
            Source docs:{' '}
            <span className="font-mono text-foreground">docs/source-respecting-llm-protocol.md</span>
            {' / '}
            <span className="font-mono text-foreground">docs/creator-rights-model-review-monitor.md</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : error ? (
          <Notice tone="red" title="Failed to load source protocol overview" body={error} />
        ) : overview && !overview.available ? (
          <Notice
            tone="amber"
            title="Source protocol schema is not available here"
            body={`${overview.reason ?? 'Apply the migration before live receipts can be shown.'} Migration: ${overview.migration ?? 'source protocol migration'}.`}
          />
        ) : overview && summary ? (
          <>
            <section className="mb-6 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldCheck size={20} className="text-radiant-gold" />
                    <h2 className="text-xl font-semibold">Protocol stance</h2>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-3xl">
                    Retrieval remains permission-aware. Payouts accrue per answer receipt, then settle monthly to avoid high transaction costs.
                  </p>
                </div>
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${hasOpenRightsIssue ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
                  {hasOpenRightsIssue ? 'Review needed' : 'No open holds'}
                </div>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={<Users size={18} />} label="Creators" value={summary.creators} />
              <Stat icon={<BookOpenCheck size={18} />} label="Works" value={summary.works} />
              <Stat icon={<Database size={18} />} label="Retrievable chunks" value={summary.retrievableChunks} />
              <Stat icon={<FileText size={18} />} label="Answer receipts" value={summary.answerReceipts} />
              <Stat icon={<ShieldCheck size={18} />} label="Active grants" value={summary.activeGrants} />
              <Stat icon={<CircleDollarSign size={18} />} label="Monthly payouts" value={summary.monthlyPayouts} />
              <Stat icon={<AlertTriangle size={18} />} label="Open disputes" value={summary.openDisputes} />
              <Stat icon={<CircleDollarSign size={18} />} label="Accrued payout" value={formatMoney(summary.accruedPayoutUsd)} />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="Current payout model">
                <KeyValue label="Usage calculation" value="Per answer receipt" />
                <KeyValue label="Settlement cadence" value="Monthly" />
                <KeyValue label="Default split" value="60% creators / 25% ops / 15% reserve" />
                <KeyValue label="Held payouts" value={String(summary.heldPayouts)} />
              </Panel>
              <Panel title="Rights controls">
                <KeyValue label="Active grants" value={String(summary.activeGrants)} />
                <KeyValue label="Open disputes" value={String(summary.openDisputes)} />
                <KeyValue label="Review basis" value="License grant inherited by chunk" />
                <KeyValue label="Fine-tuning" value="Disabled unless explicitly granted" />
              </Panel>
              <Panel title="Review loop">
                <KeyValue label="Model reviews shown" value={String(tabCounts.reviews)} />
                <KeyValue label="Promotion policy" value="Quality and license gates" />
                <KeyValue label="Last generated" value={formatDate(overview.generatedAt)} />
                <KeyValue label="Mode" value="Read-only admin visibility" />
              </Panel>
            </section>

            <section className="mb-4 flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-lg border px-3 py-2 text-sm ${tab === item.key ? 'border-radiant-gold bg-radiant-gold/10 text-radiant-gold' : 'border-silicon-slate text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label} <span className="ml-1 font-mono text-xs">{tabCounts[item.key]}</span>
                </button>
              ))}
            </section>

            <section className="overflow-hidden rounded-lg border border-silicon-slate">
              {tab === 'creators' && <CreatorsTable rows={overview.creators ?? []} />}
              {tab === 'works' && <WorksTable rows={overview.works ?? []} />}
              {tab === 'grants' && <GrantsTable rows={overview.licenseGrants ?? []} />}
              {tab === 'chunks' && <ChunksTable rows={overview.chunks ?? []} />}
              {tab === 'receipts' && <ReceiptsTable receipts={overview.receipts ?? []} chunks={overview.receiptChunks ?? []} />}
              {tab === 'payouts' && <PayoutsTable rows={overview.monthlyPayouts ?? []} disputes={overview.disputes ?? []} />}
              {tab === 'reviews' && <ModelReviewsTable rows={overview.modelReviews ?? []} />}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Notice({ tone, title, body }: { tone: 'amber' | 'red'; title: string; body: string }) {
  const classes = tone === 'amber'
    ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
    : 'border-red-500/50 bg-red-500/10 text-red-300'
  return (
    <div className={`rounded-lg border p-6 ${classes}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-radiant-gold">{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-silicon-slate/70 pb-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-xs text-foreground">{value}</dd>
    </div>
  )
}

function TableFrame({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <>
      <div className="hidden grid-cols-5 gap-4 bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      <div className="divide-y divide-silicon-slate">
        {empty ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">No records yet.</div> : children}
      </div>
    </>
  )
}

function CreatorsTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Creator', 'Categories', 'Rights holders', 'Verification', 'Created']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          row.protected_identity ? 'Protected identity' : row.display_name,
          list(row.categories),
          list(row.rights_holder_types),
          row.verification_status,
          formatDate(row.created_at),
        ]} />
      ))}
    </TableFrame>
  )
}

function WorksTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Work', 'Rights holder', 'Ban status', 'Review', 'Consent']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          row.title,
          row.rights_holder_type,
          row.ban_status,
          row.review_status,
          row.community_consent_required ? consentLabel(row.community_consent_verified) : chainLabel(row.chain_of_title_verified),
        ]} />
      ))}
    </TableFrame>
  )
}

function GrantsTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Grant', 'Status', 'Allowed uses', 'Blocked topics', 'Expires']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          shortId(row.id),
          row.status,
          list(row.allowed_uses),
          list(row.blocked_topics),
          row.expires_at ? formatDate(row.expires_at) : 'No expiry',
        ]} />
      ))}
    </TableFrame>
  )
}

function ChunksTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Citation', 'Location', 'Retrievable', 'Sensitive topics', 'Created']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          row.citation_label,
          row.source_location || 'Unspecified',
          row.is_retrievable ? 'Yes' : 'No',
          list(row.sensitive_topics),
          formatDate(row.created_at),
        ]} />
      ))}
    </TableFrame>
  )
}

function ReceiptsTable({ receipts, chunks }: { receipts: any[]; chunks: any[] }) {
  const chunksByReceipt = useMemo(() => {
    return chunks.reduce<Record<string, any[]>>((acc, chunk) => {
      const id = chunk.answer_receipt_id
      acc[id] = [...(acc[id] ?? []), chunk]
      return acc
    }, {})
  }, [chunks])

  return (
    <TableFrame headers={['Receipt', 'Model', 'Cited chunks', 'Creator pool', 'Generated']} empty={receipts.length === 0}>
      {receipts.map((receipt) => {
        const attributed = chunksByReceipt[receipt.id] ?? []
        return (
          <Row key={receipt.id} cells={[
            shortId(receipt.id),
            receipt.model_id,
            `${receipt.cited_chunk_ids?.length ?? 0} cited / ${attributed.length} attributed`,
            formatMoney(receipt.creator_pool_usd),
            formatDate(receipt.generated_at),
          ]} />
        )
      })}
    </TableFrame>
  )
}

function PayoutsTable({ rows, disputes }: { rows: any[]; disputes: any[] }) {
  return (
    <TableFrame headers={['Creator', 'Period', 'Tokens', 'Accrued', 'Status']} empty={rows.length === 0 && disputes.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          shortId(row.creator_external_id),
          row.settlement_period,
          String(row.attributed_token_count ?? 0),
          formatMoney(row.accrued_payout_usd),
          row.hold_reason ? `${row.settlement_status}: ${row.hold_reason}` : row.settlement_status,
        ]} />
      ))}
      {disputes.map((row) => (
        <Row key={row.id} cells={[
          shortId(row.id),
          'Dispute',
          row.dispute_type,
          row.status,
          row.summary,
        ]} />
      ))}
    </TableFrame>
  )
}

function ModelReviewsTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Reviewed', 'Incumbent', 'Recommended', 'Recommendation', 'Gates']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          formatDate(row.reviewed_at),
          row.incumbent_model_id,
          row.recommended_model_id,
          row.recommendation,
          `${row.quality_gate_passed ? 'quality' : 'quality pending'} / ${row.license_governance_gate_passed ? 'license' : 'license pending'}`,
        ]} />
      ))}
    </TableFrame>
  )
}

function Row({ cells }: { cells: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-4 py-4 text-sm lg:grid-cols-5 lg:gap-4">
      {cells.map((cell, index) => (
        <div key={`${cell}-${index}`} className={index === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
          <span className="break-words">{cell}</span>
        </div>
      ))}
    </div>
  )
}

function list(value: unknown): string {
  return Array.isArray(value) && value.length > 0 ? value.join(', ') : 'None'
}

function shortId(value: string): string {
  if (!value) return 'Unknown'
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function chainLabel(value: boolean): string {
  return value ? 'Chain verified' : 'Chain pending'
}

function consentLabel(value: boolean): string {
  return value ? 'Consent verified' : 'Consent pending'
}

function formatDate(value: string): string {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(amount)
}
