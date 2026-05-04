'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  CircleDollarSign,
  Database,
  FileText,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import SiteThemeCorner from '@/components/SiteThemeCorner'

type CreatorStatement = {
  available: boolean
  linked: boolean
  generatedAt: string
  reason?: string
  migration?: string
  portal?: {
    status: string
    can_view_earnings: boolean
    can_view_receipts: boolean
    accepted_at: string | null
  }
  creator?: {
    display_name: string
    categories: string[]
    rights_holder_types: string[]
    verification_status: string
    protected_identity: boolean
    public_bio: string | null
  }
  summary?: {
    works: number
    activeGrants: number
    retrievableChunks: number
    attributedReceipts: number
    monthlyPayouts: number
    accruedPayoutUsd: number
    attributedTokenCount: number
    heldPayouts: number
    openDisputes: number
  }
  works?: any[]
  licenseGrants?: any[]
  chunks?: any[]
  payouts?: any[]
  attributedChunks?: any[]
  disputes?: any[]
}

type TabKey = 'rights' | 'earnings' | 'receipts' | 'support'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'rights', label: 'Rights' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'support', label: 'Support' },
]

export default function CreatorSourceProtocolPage() {
  return (
    <ProtectedRoute>
      <CreatorSourceProtocolContent />
    </ProtectedRoute>
  )
}

function CreatorSourceProtocolContent() {
  const [statement, setStatement] = useState<CreatorStatement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('rights')

  const loadStatement = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing creator session')
      const res = await fetch('/api/source-protocol/creator/statement', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setStatement(body)
    } catch (err) {
      setStatement(null)
      setError(err instanceof Error ? err.message : 'Failed to load creator statement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatement()
  }, [loadStatement])

  const summary = statement?.summary
  const tabCounts = useMemo(
    () => ({
      rights: (statement?.works?.length ?? 0) + (statement?.licenseGrants?.length ?? 0),
      earnings: statement?.payouts?.length ?? 0,
      receipts: statement?.attributedChunks?.length ?? 0,
      support: statement?.disputes?.length ?? 0,
    }),
    [statement]
  )

  if (loading) {
    return (
      <>
        <SiteThemeCorner />
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-radiant-gold mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Loading your source statement...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteThemeCorner />
      <div className="min-h-screen bg-gray-950 text-white">
        <header className="border-b border-gray-800 bg-gray-900/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">Source Protocol</p>
              <h1 className="text-2xl font-bold">Creator Statement</h1>
              <p className="text-sm text-gray-400 max-w-3xl">
                Read-only visibility into approved works, source use, monthly payout accruals, and rights review status.
              </p>
            </div>
            {statement?.creator && (
              <div className="text-left lg:text-right">
                <p className="font-semibold">{statement.creator.protected_identity ? 'Protected identity' : statement.creator.display_name}</p>
                <p className="text-xs text-gray-500">{statement.creator.verification_status}</p>
              </div>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {error ? (
            <Notice tone="red" title="Statement unavailable" body={error} />
          ) : statement && !statement.available ? (
            <Notice
              tone="amber"
              title="Creator portal schema is not available yet"
              body={`${statement.reason ?? 'The migration must be applied before creator statements can load.'} Migration: ${statement.migration ?? 'creator portal migration'}.`}
            />
          ) : statement && !statement.linked ? (
            <Notice
              tone="amber"
              title="Your login is not linked to a creator account yet"
              body={statement.reason ?? 'A protocol admin must link your signed-in account to your creator profile before this statement can show private rights and earnings data.'}
            />
          ) : statement && summary ? (
            <>
              <section className="rounded-lg border border-gray-800 bg-gray-900/70 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <ShieldCheck size={20} className="text-radiant-gold" />
                      <h2 className="text-xl font-semibold">Current statement</h2>
                    </div>
                    <p className="text-sm text-gray-400 max-w-3xl">
                      Usage is calculated per approved answer receipt. Money movement is grouped into monthly settlements so review, holds, and payout costs stay manageable.
                    </p>
                  </div>
                  <StatusPill reviewNeeded={summary.openDisputes > 0 || summary.heldPayouts > 0} />
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat icon={<BookOpenCheck size={18} />} label="Works" value={summary.works} />
                <Stat icon={<ShieldCheck size={18} />} label="Active grants" value={summary.activeGrants} />
                <Stat icon={<Database size={18} />} label="Retrievable chunks" value={summary.retrievableChunks} />
                <Stat icon={<FileText size={18} />} label="Attributed receipts" value={summary.attributedReceipts} />
                <Stat icon={<CircleDollarSign size={18} />} label="Accrued payout" value={formatMoney(summary.accruedPayoutUsd)} />
                <Stat icon={<FileText size={18} />} label="Attributed tokens" value={summary.attributedTokenCount} />
                <Stat icon={<CircleDollarSign size={18} />} label="Monthly statements" value={summary.monthlyPayouts} />
                <Stat icon={<AlertTriangle size={18} />} label="Open support items" value={summary.openDisputes} />
              </section>

              <section className="flex flex-wrap gap-2">
                {TABS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`rounded-lg border px-3 py-2 text-sm ${tab === item.key ? 'border-radiant-gold bg-radiant-gold/10 text-radiant-gold' : 'border-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    {item.label} <span className="ml-1 font-mono text-xs">{tabCounts[item.key]}</span>
                  </button>
                ))}
              </section>

              <section className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50">
                {tab === 'rights' && <RightsTable works={statement.works ?? []} grants={statement.licenseGrants ?? []} chunks={statement.chunks ?? []} />}
                {tab === 'earnings' && <PayoutTable rows={statement.payouts ?? []} canView={statement.portal?.can_view_earnings ?? false} />}
                {tab === 'receipts' && <ReceiptTable rows={statement.attributedChunks ?? []} canView={statement.portal?.can_view_receipts ?? false} />}
                {tab === 'support' && <SupportTable rows={statement.disputes ?? []} />}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </>
  )
}

function Notice({ tone, title, body }: { tone: 'amber' | 'red'; title: string; body: string }) {
  const classes = tone === 'amber'
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
    : 'border-red-500/40 bg-red-500/10 text-red-200'
  return (
    <div className={`rounded-lg border p-6 ${classes}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  )
}

function StatusPill({ reviewNeeded }: { reviewNeeded: boolean }) {
  return (
    <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${reviewNeeded ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
      {reviewNeeded ? 'Review needed' : 'Current'}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-radiant-gold">{value}</p>
    </div>
  )
}

function TableFrame({ headers, empty, children }: { headers: string[]; empty: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className="hidden grid-cols-5 gap-4 bg-gray-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid">
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      <div className="divide-y divide-gray-800">
        {empty ? <div className="px-4 py-8 text-center text-sm text-gray-500">No records yet.</div> : children}
      </div>
    </>
  )
}

function RightsTable({ works, grants, chunks }: { works: any[]; grants: any[]; chunks: any[] }) {
  const grantsByWork = useMemo(() => groupBy(grants, 'work_id'), [grants])
  const chunksByWork = useMemo(() => groupBy(chunks, 'work_id'), [chunks])

  return (
    <TableFrame headers={['Work', 'Rights status', 'Uses', 'Retrieval', 'Consent']} empty={works.length === 0}>
      {works.map((work) => {
        const activeGrants = (grantsByWork[work.id] ?? []).filter((grant: any) => grant.status === 'active')
        const workChunks = chunksByWork[work.id] ?? []
        return (
          <Row key={work.id} cells={[
            work.title,
            `${work.review_status} / ${work.ban_status}`,
            activeGrants.length > 0 ? list(activeGrants[0].allowed_uses) : 'No active grant',
            `${workChunks.filter((chunk: any) => chunk.is_retrievable).length} of ${workChunks.length} chunks`,
            work.community_consent_required ? consentLabel(work.community_consent_verified) : chainLabel(work.chain_of_title_verified),
          ]} />
        )
      })}
    </TableFrame>
  )
}

function PayoutTable({ rows, canView }: { rows: any[]; canView: boolean }) {
  if (!canView) {
    return <div className="px-4 py-8 text-center text-sm text-gray-500">Earnings visibility is disabled for this portal account.</div>
  }

  return (
    <TableFrame headers={['Period', 'Status', 'Tokens', 'Accrued', 'Settlement']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          row.settlement_period,
          row.settlement_status,
          String(row.attributed_token_count ?? 0),
          formatMoney(row.accrued_payout_usd),
          row.hold_reason || (row.paid_at ? `Paid ${formatDate(row.paid_at)}` : 'Pending monthly review'),
        ]} />
      ))}
    </TableFrame>
  )
}

function ReceiptTable({ rows, canView }: { rows: any[]; canView: boolean }) {
  if (!canView) {
    return <div className="px-4 py-8 text-center text-sm text-gray-500">Receipt visibility is disabled for this portal account.</div>
  }

  return (
    <TableFrame headers={['Receipt', 'Citation', 'Tokens', 'Weight', 'Accrued']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={`${row.answer_receipt_id}-${row.source_chunk_external_id}`} cells={[
          shortId(row.answer_receipt_id),
          row.citation_label,
          String(row.supported_output_tokens ?? 0),
          Number(row.attribution_weight ?? 0).toFixed(4),
          formatMoney(row.accrued_payout_usd),
        ]} />
      ))}
    </TableFrame>
  )
}

function SupportTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Item', 'Type', 'Status', 'Opened', 'Summary']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          shortId(row.id),
          row.dispute_type,
          row.status,
          formatDate(row.created_at),
          row.resolution_notes || row.summary,
        ]} />
      ))}
    </TableFrame>
  )
}

function Row({ cells }: { cells: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-4 py-4 text-sm lg:grid-cols-5 lg:gap-4">
      {cells.map((cell, index) => (
        <div key={`${cell}-${index}`} className={index === 0 ? 'font-medium text-white' : 'text-gray-400'}>
          <span className="break-words">{cell}</span>
        </div>
      ))}
    </div>
  )
}

function groupBy(rows: any[], key: string): Record<string, any[]> {
  return rows.reduce<Record<string, any[]>>((acc, row) => {
    const value = row[key]
    acc[value] = [...(acc[value] ?? []), row]
    return acc
  }, {})
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
