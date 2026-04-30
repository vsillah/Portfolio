'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Bot, DollarSign, FileText, RefreshCw } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type AnyRow = Record<string, unknown>

type RunDetail = {
  run: AnyRow
  steps: AnyRow[]
  events: AnyRow[]
  artifacts: AnyRow[]
  approvals: AnyRow[]
  handoffs: AnyRow[]
  costs: AnyRow[]
  cost_total: number
}

export default function AgentRunDetailPage({ params }: { params: { runId: string } }) {
  return (
    <ProtectedRoute requireAdmin>
      <AgentRunDetailContent runId={params.runId} />
    </ProtectedRoute>
  )
}

function AgentRunDetailContent({ runId }: { runId: string }) {
  const [data, setData] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/agents/runs/${runId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Runs', href: '/admin/agents/runs' },
          { label: 'Run Detail' },
        ]} />
        <Link href="/admin/agents/runs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5">
          <ArrowLeft size={16} />
          Back to runs
        </Link>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading run detail...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-5 text-red-300">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} /> Failed to load run</div>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : data ? (
          <>
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold mb-1">{String(data.run.title ?? 'Agent run')}</h1>
                <p className="text-sm text-muted-foreground">{String(data.run.kind ?? 'run')} · {String(data.run.id)}</p>
              </div>
              <button
                onClick={fetchDetail}
                className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Metric icon={<Bot size={18} />} label="Runtime" value={String(data.run.runtime ?? '-')} />
              <Metric icon={<RefreshCw size={18} />} label="Status" value={String(data.run.status ?? '-')} />
              <Metric icon={<DollarSign size={18} />} label="Cost" value={`$${data.cost_total.toFixed(4)}`} />
              <Metric icon={<FileText size={18} />} label="Artifacts" value={String(data.artifacts.length)} />
            </div>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Steps</h2>
              <Timeline rows={data.steps} timeKey="started_at" titleKey="name" detailKey="output_summary" fallback="No steps recorded yet." />
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5 mb-6">
              <h2 className="text-lg font-semibold mb-4">Events</h2>
              <Timeline rows={data.events} timeKey="occurred_at" titleKey="event_type" detailKey="message" fallback="No events recorded yet." />
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5">
              <h2 className="text-lg font-semibold mb-4">Artifacts & Approvals</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <List rows={data.artifacts} titleKey="title" fallbackTitle="Artifact" detailKey="artifact_type" empty="No artifacts attached." />
                <List rows={data.approvals} titleKey="approval_type" fallbackTitle="Approval" detailKey="status" empty="No approvals recorded." />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-black/10 p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function Timeline({ rows, timeKey, titleKey, detailKey, fallback }: { rows: AnyRow[]; timeKey: string; titleKey: string; detailKey: string; fallback: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{fallback}</p>
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={String(row.id)} className="rounded-lg border border-silicon-slate/50 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{String(row[titleKey] ?? '-')}</p>
            <p className="text-xs text-muted-foreground">{formatDate(asString(row[timeKey]))}</p>
          </div>
          {row[detailKey] ? <p className="text-sm text-muted-foreground mt-1">{String(row[detailKey])}</p> : null}
          {row.status ? <p className="text-xs text-muted-foreground mt-1">Status: {String(row.status)}</p> : null}
        </div>
      ))}
    </div>
  )
}

function List({ rows, titleKey, fallbackTitle, detailKey, empty }: { rows: AnyRow[]; titleKey: string; fallbackTitle: string; detailKey: string; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={String(row.id)} className="rounded-lg border border-silicon-slate/50 bg-background/40 p-3">
          <p className="font-medium">{String(row[titleKey] || fallbackTitle)}</p>
          <p className="text-sm text-muted-foreground">{String(row[detailKey] ?? '')}</p>
          {row.url ? <a className="text-sm text-radiant-gold hover:underline" href={String(row.url)}>Open</a> : null}
        </div>
      ))}
    </div>
  )
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
