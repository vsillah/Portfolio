'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronUp,
  Users,
  DollarSign,
  TrendingUp,
  Target,
  ExternalLink,
  Loader2,
  Inbox,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import Link from 'next/link'
import type {
  FunnelStageData,
  AttentionItem,
  LossReasonBreakdown,
  SelfBenchmarkDelta,
  FunnelAnalyticsResponse,
  ChannelFilter,
} from '@/lib/funnel-analytics'

// Use FunnelAnalyticsResponse as the data shape
type FunnelAnalyticsData = FunnelAnalyticsResponse

// ============================================================================
// Page wrapper
// ============================================================================

export default function FunnelAnalyticsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <FunnelAnalyticsContent />
    </ProtectedRoute>
  )
}

// ============================================================================
// Main content
// ============================================================================

function FunnelAnalyticsContent() {
  const [data, setData] = useState<FunnelAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const [lossReasonsExpanded, setLossReasonsExpanded] = useState(false)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      const res = await fetch(`/api/admin/analytics/funnel?days=${days}&channel=${channel}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (err) {
      console.error('Failed to fetch funnel analytics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [days, channel])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const isEmptyFunnel = data && data.stages.every((s) => s.count === 0)

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales Funnel Analytics' },
          ]}
        />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-1">Sales Funnel Analytics</h1>
          <p className="text-gray-400">Track conversion rates, pipeline value, and deal flow</p>
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Time range */}
          <div className="flex items-center gap-1 bg-gray-900 rounded-lg border border-gray-800 p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Channel filter */}
          <div className="flex items-center gap-1 bg-gray-900 rounded-lg border border-gray-800 p-1">
            {(['all', 'warm', 'cold'] as ChannelFilter[]).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                  channel === ch
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {ch === 'all' ? 'All Channels' : ch}
              </button>
            ))}
          </div>

          {loading && (
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          )}
        </div>

        {/* ── Error state ──────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 mb-6">
            Failed to load analytics: {error}
          </div>
        )}

        {/* ── Day-1 empty state ────────────────────────────────────── */}
        {!loading && isEmptyFunnel && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="w-16 h-16 text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No funnel data yet</h2>
            <p className="text-gray-500 max-w-md">
              Once contacts enter your pipeline and progress through outreach, diagnostics, and sales,
              you&apos;ll see conversion rates, pipeline value, and deal flow here.
            </p>
            <Link
              href="/admin/outreach"
              className="mt-6 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Go to Lead Pipeline
            </Link>
          </div>
        )}

        {/* ── Dashboard content ────────────────────────────────────── */}
        {data && !isEmptyFunnel && (
          <div className="space-y-6">
            {/* Row 1: Attention Items */}
            <AttentionItemsCard items={data.attentionItems} />

            {/* Row 2: Summary Cards */}
            <SummaryCards
              summary={data.summary}
              benchmark={data.selfBenchmark}
            />

            {/* Row 3: Funnel Visualization */}
            <FunnelVisualization
              stages={data.stages}
              expandedStage={expandedStage}
              onToggleStage={(key) =>
                setExpandedStage(expandedStage === key ? null : key)
              }
            />

            {/* Row 4: Loss Reasons (collapsible) */}
            {data.summary.lossReasons.length > 0 && (
              <LossReasonsCard
                reasons={data.summary.lossReasons}
                expanded={lossReasonsExpanded}
                onToggle={() => setLossReasonsExpanded(!lossReasonsExpanded)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Attention Items Card
// ============================================================================

function AttentionItemsCard({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-700/30 text-emerald-400 text-sm flex items-center gap-2">
        <Target className="w-4 h-4" />
        All clear — no urgent items right now.
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-gradient-to-r from-amber-900/30 to-orange-900/20 border border-amber-700/40 p-4 md:p-5">
      <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Needs Attention ({items.length})
      </h2>
      <ol className="space-y-2" aria-label="Items requiring attention">
        {items.map((item, i) => (
          <li key={i}>
            <Link
              href={item.link}
              className="flex items-start gap-3 p-3 rounded-lg bg-black/30 hover:bg-black/50 transition-colors group"
            >
              <span
                className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  item.severity === 'critical'
                    ? 'bg-red-500'
                    : item.severity === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {item.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.detail}
                  {item.timeContext && (
                    <span className="ml-2 text-gray-500">· {item.timeContext}</span>
                  )}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 shrink-0 mt-1" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ============================================================================
// Summary Cards
// ============================================================================

function SummaryCards({
  summary,
  benchmark,
}: {
  summary: FunnelAnalyticsData['summary']
  benchmark: FunnelAnalyticsData['selfBenchmark']
}) {
  const cards = [
    {
      label: 'Total Leads',
      value: summary.totalLeads.toLocaleString(),
      icon: <Users className="w-5 h-5" />,
      delta: benchmark.deltas.total_leads,
    },
    {
      label: 'Pipeline Value',
      value: `$${summary.totalPipelineValue.toLocaleString()}`,
      icon: <TrendingUp className="w-5 h-5" />,
      delta: null as SelfBenchmarkDelta | null,
    },
    {
      label: 'Closed Revenue',
      value: `$${summary.totalClosedValue.toLocaleString()}`,
      icon: <DollarSign className="w-5 h-5" />,
      delta: benchmark.deltas.closed_value,
    },
    {
      label: 'Win/Loss',
      value: summary.winLossRatio,
      icon: <Target className="w-5 h-5" />,
      delta: null as SelfBenchmarkDelta | null,
      subtitle:
        summary.avgDealSize > 0
          ? `Avg deal: $${summary.avgDealSize.toLocaleString()}`
          : summary.medianCycleTimeDays != null
            ? `Cycle: ${summary.medianCycleTimeDays}d`
            : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-gray-900 rounded-xl border border-gray-800 p-4"
        >
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            {card.icon}
            <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl md:text-3xl font-bold text-white">{card.value}</span>
            {card.delta && <DeltaBadge delta={card.delta} />}
          </div>
          {card.subtitle && (
            <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function DeltaBadge({ delta }: { delta: SelfBenchmarkDelta }) {
  if (delta.changePct === null) return null

  const isUp = delta.changePct > 0
  const isFlat = delta.changePct === 0

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md ${
        isFlat
          ? 'text-gray-400 bg-gray-800'
          : isUp
            ? 'text-emerald-400 bg-emerald-900/40'
            : 'text-red-400 bg-red-900/40'
      }`}
      title={`${delta.previous} → ${delta.current}`}
    >
      {isFlat ? (
        <Minus className="w-3 h-3" />
      ) : isUp ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {Math.abs(delta.changePct)}%
    </span>
  )
}

// ============================================================================
// Funnel Visualization — Connected Step Indicator
// ============================================================================

function FunnelVisualization({
  stages,
  expandedStage,
  onToggleStage,
}: {
  stages: FunnelStageData[]
  expandedStage: string | null
  onToggleStage: (key: string) => void
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 md:p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Funnel Stages
      </h2>

      {/* Desktop: horizontal connected steps */}
      <ol
        className="hidden md:flex items-start gap-0"
        aria-label="Sales funnel stages"
      >
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1
          const isExpanded = expandedStage === stage.key
          const convPct = stage.conversionFromPrevious

          return (
            <li key={stage.key} className="flex items-start flex-1 min-w-0">
              {/* Stage node */}
              <button
                onClick={() => onToggleStage(stage.key)}
                className={`flex flex-col items-center text-center w-full p-3 rounded-lg transition-colors ${
                  isExpanded
                    ? 'bg-indigo-900/30 border border-indigo-700/40'
                    : 'hover:bg-gray-800/50'
                } ${stage.count === 0 ? 'opacity-50' : ''}`}
                aria-expanded={isExpanded}
                aria-label={`${stage.label}: ${stage.count} records`}
              >
                <span className="text-2xl font-bold text-white">
                  {stage.count.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 mt-1 truncate w-full">
                  {stage.shortLabel}
                </span>
                {stage.conversionFromTop != null && i > 0 && (
                  <span className="text-[10px] text-gray-500 mt-0.5">
                    {stage.conversionFromTop}% of top
                  </span>
                )}
                {stage.lostCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-red-400 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    -{stage.lostCount} lost
                  </span>
                )}
                {stage.pipelineValue != null && stage.pipelineValue > 0 && (
                  <span className="text-[10px] text-emerald-400 mt-0.5">
                    ${stage.pipelineValue.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Connector */}
              {!isLast && (
                <div className="flex flex-col items-center justify-center pt-5 px-1 shrink-0">
                  <div
                    className={`w-8 h-0.5 ${
                      convPct != null && convPct > 0
                        ? convPct >= 50
                          ? 'bg-emerald-500'
                          : convPct >= 20
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        : 'bg-gray-700'
                    }`}
                  />
                  {convPct != null && i < stages.length - 1 && (
                    <span
                      className={`text-[10px] mt-0.5 ${
                        convPct >= 50
                          ? 'text-emerald-500'
                          : convPct >= 20
                            ? 'text-amber-500'
                            : convPct > 0
                              ? 'text-red-500'
                              : 'text-gray-600'
                      }`}
                    >
                      {convPct}%
                    </span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* Mobile: vertical step list */}
      <ol className="md:hidden space-y-2" aria-label="Sales funnel stages">
        {stages.map((stage, i) => {
          const isExpanded = expandedStage === stage.key
          const convPct = stages[i + 1]?.conversionFromPrevious

          return (
            <li key={stage.key}>
              <button
                onClick={() => onToggleStage(stage.key)}
                className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors ${
                  isExpanded
                    ? 'bg-indigo-900/30 border border-indigo-700/40'
                    : 'bg-gray-800/30 hover:bg-gray-800/60'
                } ${stage.count === 0 ? 'opacity-50' : ''}`}
                aria-expanded={isExpanded}
              >
                <span className="text-xl font-bold text-white w-16 text-right shrink-0">
                  {stage.count.toLocaleString()}
                </span>
                <div className="flex-1 text-left min-w-0">
                  <span className="text-sm font-medium text-gray-200">{stage.label}</span>
                  {stage.conversionFromTop != null && i > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      {stage.conversionFromTop}% of top
                    </span>
                  )}
                </div>
                {stage.lostCount > 0 && (
                  <span className="text-xs text-red-400 flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3 h-3" />-{stage.lostCount}
                  </span>
                )}
                {stage.pipelineValue != null && stage.pipelineValue > 0 && (
                  <span className="text-xs text-emerald-400 shrink-0">
                    ${stage.pipelineValue.toLocaleString()}
                  </span>
                )}
              </button>

              {/* Conversion connector to next stage */}
              {i < stages.length - 1 && (
                <div className="flex items-center gap-2 pl-20 py-1">
                  <div
                    className={`h-4 w-0.5 ${
                      convPct != null && convPct > 0
                        ? convPct >= 50
                          ? 'bg-emerald-500'
                          : convPct >= 20
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        : 'bg-gray-700'
                    }`}
                  />
                  {convPct != null && (
                    <span className="text-[10px] text-gray-500">
                      {convPct}% convert
                    </span>
                  )}
                </div>
              )}

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <StageDetail stage={stage} />
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ol>

      {/* Expanded detail (desktop) */}
      <AnimatePresence>
        {expandedStage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden hidden md:block mt-4"
          >
            <StageDetail
              stage={stages.find((s) => s.key === expandedStage)!}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StageDetail({ stage }: { stage: FunnelStageData }) {
  return (
    <div className="bg-gray-800/40 rounded-lg p-4 mt-2 text-sm space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <span className="text-gray-500 text-xs">Count</span>
          <p className="text-white font-semibold">{stage.count.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">From Previous</span>
          <p className="text-white font-semibold">
            {stage.conversionFromPrevious != null ? `${stage.conversionFromPrevious}%` : '—'}
          </p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">From Top</span>
          <p className="text-white font-semibold">
            {stage.conversionFromTop != null ? `${stage.conversionFromTop}%` : '—'}
          </p>
        </div>
        {stage.pipelineValue != null && (
          <div>
            <span className="text-gray-500 text-xs">Value</span>
            <p className="text-emerald-400 font-semibold">
              ${stage.pipelineValue.toLocaleString()}
            </p>
          </div>
        )}
      </div>
      {stage.unattributed > 0 && (
        <p className="text-xs text-gray-500">
          {stage.unattributed} record{stage.unattributed !== 1 ? 's' : ''} not linked to a contact
        </p>
      )}
    </div>
  )
}

// ============================================================================
// Loss Reasons Card
// ============================================================================

function LossReasonsCard({
  reasons,
  expanded,
  onToggle,
}: {
  reasons: LossReasonBreakdown[]
  expanded: boolean
  onToggle: () => void
}) {
  const maxPct = Math.max(...reasons.map((r) => r.percentage), 1)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-gray-800/30 transition-colors"
      >
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          Loss Reasons
          <span className="text-xs font-normal text-gray-500 lowercase">
            ({reasons.reduce((s, r) => s + r.count, 0)} total)
          </span>
        </h2>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-5 pb-4 md:pb-5 space-y-3">
              {reasons.map((r) => (
                <div key={r.reason}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-300">{r.label}</span>
                    <span className="text-gray-400 text-xs">
                      {r.count} ({r.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500/70 rounded-full transition-all duration-500"
                      style={{ width: `${(r.percentage / maxPct) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
