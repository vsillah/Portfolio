'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3, FileText, ShieldCheck } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

type StatusKey = 'keep' | 'watch' | 'unresolved' | 'resolved_canceled'
type StatusColor = 'green' | 'yellow' | 'red'

interface VendorStatus {
  name: string
  status: StatusKey
  statusColor: StatusColor
  billingSignal: string
  usageSignal: string
  portfolioDependency: string
  recommendation: string
  nextAction: string
  decisionRequired: boolean
  links: Array<{ label: string; href: string }>
}

interface SubscriptionStatusRegistry {
  generatedAt: string
  sourceDocument: string
  weeklyReportAutomationId: string
  dailyMonitorAutomationId: string
  approvalPhrasePattern: string
  summary: {
    status: StatusColor
    headline: string
    nextReviewFocus: string[]
  }
  buckets: {
    keep: string[]
    watch: string[]
    unresolved: string[]
    resolvedCanceled: string[]
    needsDecision: string[]
  }
  vendors: VendorStatus[]
}

const statusLabels: Record<StatusKey, string> = {
  keep: 'Keep',
  watch: 'Watch',
  unresolved: 'Unresolved',
  resolved_canceled: 'Resolved',
}

const statusStyles: Record<StatusColor, string> = {
  green: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  yellow: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  red: 'border-red-500/40 bg-red-500/10 text-red-300',
}

export default function AdminSubscriptionsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminSubscriptionsPageContent />
    </ProtectedRoute>
  )
}

function AdminSubscriptionsPageContent() {
  const [data, setData] = useState<SubscriptionStatusRegistry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadStatus() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/subscriptions/status')
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load subscription status')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadStatus()
    return () => {
      cancelled = true
    }
  }, [])

  const decisionItems = useMemo(
    () => data?.vendors.filter((vendor) => vendor.decisionRequired) ?? [],
    [data]
  )

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Subscription Watch' },
        ]} />

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Subscription Watch</h1>
            <p className="text-muted-foreground text-sm">Read-only view of paid tools, watch items, unresolved vendors, and cancellation gates.</p>
          </div>
          <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 px-4 py-3 text-sm text-muted-foreground">
            Approval phrase: <span className="text-foreground font-medium">Cancel &lt;tool/vendor&gt; for Portfolio</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-red-300">
            <p className="font-medium">Failed to load subscription status</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : data ? (
          <>
            <section className="mb-6 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CircleDollarSign size={20} className="text-radiant-gold" />
                    <h2 className="text-xl font-semibold">Current stance</h2>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-3xl">{data.summary.headline}</p>
                </div>
                <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[data.summary.status]}`}>
                  {data.summary.status}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <BucketStat icon={<CheckCircle2 size={18} />} label="Keep" count={data.buckets.keep.length} />
              <BucketStat icon={<Clock3 size={18} />} label="Watch" count={data.buckets.watch.length} />
              <BucketStat icon={<AlertTriangle size={18} />} label="Unresolved" count={data.buckets.unresolved.length} />
              <BucketStat icon={<ShieldCheck size={18} />} label="Resolved" count={data.buckets.resolvedCanceled.length} />
              <BucketStat icon={<FileText size={18} />} label="Needs decision" count={data.buckets.needsDecision.length} />
            </section>

            {decisionItems.length > 0 && (
              <section className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-5">
                <h2 className="text-lg font-semibold text-amber-200 mb-3">Needs attention</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {decisionItems.map((vendor) => (
                    <div key={vendor.name} className="rounded-lg border border-amber-500/30 bg-background/40 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <h3 className="font-semibold">{vendor.name}</h3>
                        <StatusPill status={vendor.status} color={vendor.statusColor} />
                      </div>
                      <p className="text-sm text-muted-foreground">{vendor.nextAction}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Vendor status</h2>
              <div className="overflow-hidden rounded-lg border border-silicon-slate">
                <div className="hidden lg:grid grid-cols-[160px_130px_1fr_1fr_1fr] gap-4 bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Vendor</span>
                  <span>Status</span>
                  <span>Billing signal</span>
                  <span>Dependency</span>
                  <span>Next action</span>
                </div>
                <div className="divide-y divide-silicon-slate">
                  {data.vendors.map((vendor) => (
                    <div key={vendor.name} className="grid grid-cols-1 lg:grid-cols-[160px_130px_1fr_1fr_1fr] gap-3 lg:gap-4 px-4 py-4">
                      <div>
                        <p className="font-semibold">{vendor.name}</p>
                        {vendor.links.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {vendor.links.map((link) => (
                              <Link key={link.href} href={link.href} className="text-xs text-radiant-gold hover:text-amber-400">
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <StatusPill status={vendor.status} color={vendor.statusColor} />
                      </div>
                      <SignalBlock label="Billing" value={vendor.billingSignal} />
                      <SignalBlock label="Dependency" value={vendor.portfolioDependency} />
                      <SignalBlock label="Next action" value={vendor.nextAction} />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
                <h2 className="text-lg font-semibold mb-3">Next review focus</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {data.summary.nextReviewFocus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
                <h2 className="text-lg font-semibold mb-3">Automation</h2>
                <dl className="space-y-2 text-sm">
                  <KeyValue label="Daily monitor" value={data.dailyMonitorAutomationId} />
                  <KeyValue label="Weekly report" value={data.weeklyReportAutomationId} />
                  <KeyValue label="Source" value={data.sourceDocument} />
                  <KeyValue label="Last generated" value={data.generatedAt} />
                </dl>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function BucketStat({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-radiant-gold">{count}</p>
    </div>
  )
}

function StatusPill({ status, color }: { status: StatusKey; color: StatusColor }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[color]}`}>
      {statusLabels[status]}
    </span>
  )
}

function SignalBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="lg:hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{value}</p>
    </div>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-silicon-slate/70 pb-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs text-foreground">{value}</dd>
    </div>
  )
}
