'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, TrendingDown, Percent } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import AdminPieChart from '@/components/admin/AdminPieChart'

type DatePreset = 'mtd' | 'qtd' | 'ytd'

interface CostRevenueSummary {
  from: string
  to: string
  revenue: {
    total: number
    orders: number
    subscriptions: number
    proposals: number
  }
  cost: {
    total: number
    bySource: Array<{ source: string; amount: number }>
  }
  grossProfit: number
  grossMarginPercent: number | null
  profitCostRatio: number | null
}

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  let from: string

  switch (preset) {
    case 'mtd': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      from = start.toISOString().split('T')[0]
      break
    }
    case 'qtd': {
      const q = Math.floor(now.getMonth() / 3) + 1
      const start = new Date(now.getFullYear(), (q - 1) * 3, 1)
      from = start.toISOString().split('T')[0]
      break
    }
    case 'ytd': {
      from = `${now.getFullYear()}-01-01`
      break
    }
    default:
      from = to
  }

  return { from, to }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

export default function CostRevenuePage() {
  return (
    <ProtectedRoute requireAdmin>
      <CostRevenuePageContent />
    </ProtectedRoute>
  )
}

function CostRevenuePageContent() {
  const [preset, setPreset] = useState<DatePreset>('mtd')
  const [data, setData] = useState<CostRevenueSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { from, to } = getDateRange(preset)
    try {
      const res = await fetch(`/api/admin/cost-revenue/summary?from=${from}&to=${to}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [preset])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const presetLabels: Record<DatePreset, string> = {
    mtd: 'Month to date',
    qtd: 'Quarter to date',
    ytd: 'Year to date',
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Cost & Revenue' },
        ]} />

        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">Cost & Revenue</h1>
            <p className="text-muted-foreground text-sm">Portfolio cost and revenue summary by period.</p>
          </div>

          <div className="flex gap-2">
            {(['mtd', 'qtd', 'ytd'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  preset === p
                    ? 'bg-radiant-gold/20 text-radiant-gold border border-radiant-gold/50'
                    : 'bg-silicon-slate/40 text-muted-foreground border border-silicon-slate/60 hover:border-silicon-slate/80'
                }`}
              >
                {presetLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-red-400">
            <p className="font-medium">Failed to load summary</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchSummary}
              className="mt-4 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <SummaryCard
                icon={<DollarSign size={24} />}
                label="Total Revenue"
                value={formatCurrency(data.revenue.total)}
                accent="radiant-gold"
              />
              <SummaryCard
                icon={<TrendingDown size={24} />}
                label="Total Cost"
                value={formatCurrency(data.cost.total)}
                accent="amber"
              />
              <SummaryCard
                icon={<TrendingUp size={24} />}
                label="Gross Profit"
                value={formatCurrency(data.grossProfit)}
                accent={data.grossProfit >= 0 ? 'emerald' : 'rose'}
              />
              <SummaryCard
                icon={<Percent size={24} />}
                label="Profit:Cost"
                value={data.profitCostRatio != null ? `${data.profitCostRatio.toFixed(1)}x` : '—'}
                sub={data.grossMarginPercent != null ? `Margin ${formatPercent(data.grossMarginPercent)}` : undefined}
                accent="cyan"
              />
            </div>

            {/* Period label */}
            <p className="text-sm text-muted-foreground mb-4">
              Period: {data.from} → {data.to}
            </p>

            {/* Revenue breakdown */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3 text-foreground/90">Revenue breakdown</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg bg-silicon-slate/40 border border-silicon-slate/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Orders</p>
                  <p className="text-xl font-bold tabular-nums text-radiant-gold">{formatCurrency(data.revenue.orders)}</p>
                </div>
                <div className="rounded-lg bg-silicon-slate/40 border border-silicon-slate/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Proposals (no order)</p>
                  <p className="text-xl font-bold tabular-nums text-radiant-gold">{formatCurrency(data.revenue.proposals)}</p>
                </div>
                <div className="rounded-lg bg-silicon-slate/40 border border-silicon-slate/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Subscriptions</p>
                  <p className="text-xl font-bold tabular-nums text-radiant-gold">{formatCurrency(data.revenue.subscriptions)}</p>
                </div>
              </div>
            </div>

            {/* Cost by source */}
            <div>
              <h2 className="text-lg font-semibold mb-3 text-foreground/90">Cost by source</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/20 p-4">
                  <AdminPieChart
                    data={data.cost.bySource.map(({ source, amount }) => ({
                      name: source,
                      value: amount,
                    }))}
                    ariaLabel="Cost breakdown by source"
                    height={220}
                    title="Cost by source"
                  />
                </div>
                <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/20 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Cost by source (list)</p>
                  <ul className="space-y-2">
                    {data.cost.bySource.length > 0 ? (
                      data.cost.bySource.map(({ source, amount }) => (
                        <li key={source} className="flex justify-between items-center">
                          <span className="text-foreground/90 capitalize">{source.replace(/_/g, ' ')}</span>
                          <span className="font-mono text-radiant-gold tabular-nums">{formatCurrency(amount)}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground/90 text-sm">No cost events in this period</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent: 'radiant-gold' | 'amber' | 'emerald' | 'rose' | 'cyan'
}) {
  const accentClasses: Record<string, string> = {
    'radiant-gold': 'text-radiant-gold',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg bg-silicon-slate/40 border border-silicon-slate/60 p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`${accentClasses[accent]} opacity-90`}>{icon}</div>
      </div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-2 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accentClasses[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/90 mt-1">{sub}</p>}
    </motion.div>
  )
}
