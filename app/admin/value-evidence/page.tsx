'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  Database,
  FileText,
  BarChart3,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Target,
  ShieldCheck,
  Clock,
  Users,
  Zap,
  ArrowRight,
  Globe,
  BookOpen,
  Layers,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

// ============================================================================
// Types
// ============================================================================

interface DashboardData {
  overview: {
    totalPainPoints: number
    totalEvidence: number
    totalMarketIntel: number
    unprocessedMarketIntel: number
    totalCalculations: number
    totalReports: number
    totalBenchmarks: number
    totalContentMappings: number
  }
  topPainPoints: Array<{
    id: string
    name: string
    display_name: string
    frequency_count: number
    avg_monetary_impact: number | null
    industry_tags: string[]
  }>
  topCalculations: Array<{
    id: string
    industry: string
    company_size_range: string
    calculation_method: string
    formula_expression: string
    annual_value: number
    confidence_level: string
    evidence_count: number
    pain_point_categories: { display_name: string }
  }>
  evidenceBySource: Record<string, number>
  industryBreakdown: Record<string, { count: number; totalValue: number }>
  marketIntelByPlatform?: Record<string, { count: number; lastScraped: string | null }>
  workflowRuns?: {
    vep001: { workflow_id: string; triggered_at: string; completed_at?: string; status: string; stages?: Record<string, string>; items_inserted?: number; error_message?: string } | null
    vep002: { workflow_id: string; triggered_at: string; completed_at?: string; status: string; stages?: Record<string, string>; items_inserted?: number; error_message?: string } | null
  }
}

type TabName = 'dashboard' | 'pain-points' | 'market-intel' | 'benchmarks' | 'calculations' | 'reports'

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const METHOD_ICONS: Record<string, typeof Clock> = {
  time_saved: Clock,
  error_reduction: ShieldCheck,
  revenue_acceleration: TrendingUp,
  opportunity_cost: Target,
  replacement_cost: Users,
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-green-400 bg-green-500/20',
  medium: 'text-yellow-400 bg-yellow-500/20',
  low: 'text-gray-400 bg-gray-500/20',
}

// ============================================================================
// Component
// ============================================================================

export default function ValueEvidencePage() {
  const [activeTab, setActiveTab] = useState<TabName>('dashboard')
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch('/api/admin/value-evidence/dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setDashData(data)
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleTrigger = async (workflow: 'internal_extraction' | 'social_listening') => {
    setTriggering(workflow)
    setTriggerResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch('/api/admin/value-evidence/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ workflow }),
      })

      const data = await res.json()
      setTriggerResult({
        type: data.triggered ? 'success' : 'error',
        message: data.message,
      })
    } catch (error: any) {
      setTriggerResult({ type: 'error', message: error.message })
    } finally {
      setTriggering(null)
    }
  }

  const tabs: { id: TabName; label: string; icon: typeof DollarSign }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'pain-points', label: 'Pain Points', icon: Target },
    { id: 'market-intel', label: 'Market Intel', icon: Globe },
    { id: 'benchmarks', label: 'Benchmarks', icon: BookOpen },
    { id: 'calculations', label: '$ Calculations', icon: DollarSign },
    { id: 'reports', label: 'Reports', icon: FileText },
  ]

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white p-6 pb-24">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Value Evidence Pipeline', href: '/admin/value-evidence' },
        ]} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Value Evidence Pipeline
              </h1>
              <p className="text-gray-400 mt-1">
                Pain point tracking, monetary calculations, and value reporting
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchDashboard}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </motion.button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-gray-800/50 border border-gray-700 rounded-xl p-1 mb-8 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-green-600/30 text-green-300 border border-green-500/50'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Alert for trigger results */}
          <AnimatePresence>
            {triggerResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
                  triggerResult.type === 'success'
                    ? 'bg-green-900/30 border-green-500/50 text-green-300'
                    : 'bg-red-900/30 border-red-500/50 text-red-300'
                }`}
              >
                {triggerResult.type === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
                <span>{triggerResult.message}</span>
                <button
                  onClick={() => setTriggerResult(null)}
                  className="ml-auto text-gray-400 hover:text-white"
                >
                  &times;
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Pain Points"
                  value={dashData?.overview.totalPainPoints || 0}
                  icon={Target}
                  color="text-purple-400"
                />
                <StatCard
                  label="Evidence"
                  value={dashData?.overview.totalEvidence || 0}
                  icon={Database}
                  color="text-blue-400"
                />
                <StatCard
                  label="Calculations"
                  value={dashData?.overview.totalCalculations || 0}
                  icon={DollarSign}
                  color="text-green-400"
                />
                <StatCard
                  label="Reports"
                  value={dashData?.overview.totalReports || 0}
                  icon={FileText}
                  color="text-amber-400"
                />
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Market Intel"
                  value={dashData?.overview.totalMarketIntel || 0}
                  icon={Globe}
                  color="text-cyan-400"
                  subtitle={dashData?.overview.unprocessedMarketIntel
                    ? `${dashData.overview.unprocessedMarketIntel} unprocessed`
                    : undefined}
                />
                <StatCard
                  label="Benchmarks"
                  value={dashData?.overview.totalBenchmarks || 0}
                  icon={BookOpen}
                  color="text-teal-400"
                />
                <StatCard
                  label="Content Mapped"
                  value={dashData?.overview.totalContentMappings || 0}
                  icon={Layers}
                  color="text-pink-400"
                />
                <StatCard
                  label="Industries"
                  value={Object.keys(dashData?.industryBreakdown || {}).filter(k => k !== '_default').length}
                  icon={BarChart3}
                  color="text-orange-400"
                />
              </div>

              {/* Trigger Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="p-5 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center">
                        <Database size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Internal Extraction</h3>
                        <p className="text-xs text-gray-400">Extract pain points from diagnostics, quick wins, reports</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleTrigger('internal_extraction')}
                      disabled={triggering !== null}
                      className="p-2 bg-blue-600/30 border border-blue-500/50 rounded-lg hover:bg-blue-600/50 disabled:opacity-50"
                    >
                      {triggering === 'internal_extraction' ? (
                        <RefreshCw size={18} className="animate-spin text-blue-400" />
                      ) : (
                        <Play size={18} className="text-blue-400" />
                      )}
                    </motion.button>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="p-5 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-600/30 flex items-center justify-center">
                        <Globe size={20} className="text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Social Listening</h3>
                        <p className="text-xs text-gray-400">Scrape LinkedIn, Reddit, G2, Capterra for pain points</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleTrigger('social_listening')}
                      disabled={triggering !== null}
                      className="p-2 bg-purple-600/30 border border-purple-500/50 rounded-lg hover:bg-purple-600/50 disabled:opacity-50"
                    >
                      {triggering === 'social_listening' ? (
                        <RefreshCw size={18} className="animate-spin text-purple-400" />
                      ) : (
                        <Play size={18} className="text-purple-400" />
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              </div>

              {/* Workflow Progress & Last Run */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <WorkflowRunCard
                  label="Internal Extraction"
                  run={dashData?.workflowRuns?.vep001}
                  color="blue"
                />
                <WorkflowRunCard
                  label="Social Listening"
                  run={dashData?.workflowRuns?.vep002}
                  platformStats={dashData?.marketIntelByPlatform}
                  color="purple"
                />
              </div>

              {/* Top Pain Points */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target size={18} className="text-purple-400" />
                  Top Pain Points
                </h3>
                <div className="space-y-3">
                  {(dashData?.topPainPoints || []).slice(0, 8).map(pp => (
                    <div
                      key={pp.id}
                      className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{pp.display_name}</span>
                        <div className="flex gap-2 mt-1">
                          {pp.industry_tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 bg-gray-700/50 rounded-full text-gray-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-400">{pp.frequency_count} observations</span>
                        {pp.avg_monetary_impact && (
                          <div className="text-green-400 text-sm font-medium">
                            {formatCurrency(pp.avg_monetary_impact)}/yr avg
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!dashData?.topPainPoints || dashData.topPainPoints.length === 0) && (
                    <p className="text-gray-500 text-center py-4">
                      No pain points yet. Run the Internal Extraction workflow to populate.
                    </p>
                  )}
                </div>
              </div>

              {/* Top Calculations */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign size={18} className="text-green-400" />
                  Top Value Calculations
                </h3>
                <div className="space-y-3">
                  {(dashData?.topCalculations || []).map(calc => {
                    const Icon = METHOD_ICONS[calc.calculation_method] || DollarSign
                    return (
                      <div
                        key={calc.id}
                        className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-green-600/20 flex items-center justify-center">
                            <Icon size={16} className="text-green-400" />
                          </div>
                          <div>
                            <span className="font-medium">{(calc.pain_point_categories as any)?.display_name}</span>
                            <div className="text-xs text-gray-400">
                              {calc.industry} &middot; {calc.company_size_range} emp
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-green-400 font-semibold">
                            {formatCurrency(calc.annual_value)}/yr
                          </span>
                          <div className="flex items-center gap-1 justify-end mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_COLORS[calc.confidence_level] || ''}`}>
                              {calc.confidence_level}
                            </span>
                            <span className="text-xs text-gray-500">
                              {calc.evidence_count} evidence
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {(!dashData?.topCalculations || dashData.topCalculations.length === 0) && (
                    <p className="text-gray-500 text-center py-4">
                      No calculations yet. Generate calculations from the Calculations tab.
                    </p>
                  )}
                </div>
              </div>

              {/* Evidence by Source */}
              {dashData?.evidenceBySource && Object.keys(dashData.evidenceBySource).length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database size={18} className="text-blue-400" />
                    Evidence by Source
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(dashData.evidenceBySource).map(([source, count]) => (
                      <div key={source} className="p-3 bg-gray-900/50 rounded-lg text-center">
                        <div className="text-xl font-bold text-blue-400">{count}</div>
                        <div className="text-xs text-gray-400 capitalize">{source.replace(/_/g, ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pain Points Tab */}
          {activeTab === 'pain-points' && (
            <PainPointsTab />
          )}

          {/* Market Intel Tab */}
          {activeTab === 'market-intel' && (
            <MarketIntelTab />
          )}
          {/* Benchmarks Tab */}
          {activeTab === 'benchmarks' && (
            <BenchmarksTab />
          )}
          {/* Calculations Tab */}
          {activeTab === 'calculations' && (
            <CalculationsTab />
          )}
          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <ReportsTab />
          )}
        </motion.div>
      </div>
    </ProtectedRoute>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({ label, value, icon: Icon, color, subtitle }: {
  label: string
  value: number
  icon: typeof DollarSign
  color: string
  subtitle?: string
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Icon size={18} className={color} />
        <span className="text-2xl font-bold">{value.toLocaleString()}</span>
      </div>
      <div className="text-sm text-gray-400">{label}</div>
      {subtitle && <div className="text-xs text-amber-400 mt-0.5">{subtitle}</div>}
    </div>
  )
}

function WorkflowRunCard({
  label,
  run,
  platformStats,
  color,
}: {
  label: string
  run?: { triggered_at: string; completed_at?: string; status: string; stages?: Record<string, string>; items_inserted?: number; error_message?: string } | null
  platformStats?: Record<string, { count: number; lastScraped: string | null }>
  color: 'blue' | 'purple'
}) {
  const colorClasses = color === 'blue'
    ? 'from-blue-900/20 to-cyan-900/20 border-blue-500/30'
    : 'from-purple-900/20 to-pink-900/20 border-purple-500/30'
  const accentColor = color === 'blue' ? 'text-blue-400' : 'text-purple-400'

  const lastTriggered = run?.triggered_at ? new Date(run.triggered_at).toLocaleString() : null
  const lastCompleted = run?.completed_at ? new Date(run.completed_at).toLocaleString() : null
  const status = run?.status || 'idle'
  const stages = run?.stages || (platformStats && Object.fromEntries(
    Object.entries(platformStats).map(([p, s]) => [
      p,
      s.count > 0 ? (s.lastScraped ? 'complete' : 'complete') : 'pending',
    ])
  ))
  const stageEntries = stages ? Object.entries(stages).filter(([, v]) => v) : []
  const completeCount = stageEntries.filter(([, v]) => v === 'complete' || v === 'success').length
  const totalCount = stageEntries.length || (platformStats ? Object.keys(platformStats).length : 4)
  const progress = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0

  return (
    <div className={`p-5 bg-gradient-to-r ${colorClasses} border rounded-xl`}>
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <span className={accentColor}>{label}</span>
      </h3>
      <div className="space-y-2 text-sm">
        {lastTriggered && (
          <div className="text-gray-400">
            Last triggered: <span className="text-gray-200">{lastTriggered}</span>
          </div>
        )}
        {lastCompleted && status !== 'running' && (
          <div className="text-gray-400">
            Last completed: <span className="text-gray-200">{lastCompleted}</span>
          </div>
        )}
        {status === 'running' && (
          <div className="text-amber-400 flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Running…
          </div>
        )}
        {status === 'failed' && run?.error_message && (
          <div className="text-red-400 text-xs truncate" title={run.error_message}>{run.error_message}</div>
        )}
        {run?.items_inserted != null && run.items_inserted > 0 && (
          <div className="text-gray-400">
            Items inserted: <span className="text-green-400">{run.items_inserted}</span>
          </div>
        )}
        {(stageEntries.length > 0 || (platformStats && Object.keys(platformStats).length > 0)) && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Stages</span>
              <span>{completeCount}/{totalCount} complete</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'}`}
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(stageEntries.length ? stageEntries : Object.entries(platformStats || {}).map(([p, s]) => [p, s.count > 0 ? 'complete' : 'pending'] as const)).slice(0, 6).map(([stage, st]) => (
                <span
                  key={stage}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    st === 'complete' || st === 'success'
                      ? 'bg-green-900/50 text-green-400'
                      : st === 'running'
                        ? 'bg-amber-900/50 text-amber-400'
                        : 'bg-gray-700/50 text-gray-500'
                  }`}
                  title={typeof platformStats?.[stage] === 'object' ? `${platformStats[stage].count} items, last: ${platformStats[stage].lastScraped || 'never'}` : undefined}
                >
                  {stage.replace(/_/g, ' ')}
                  {typeof platformStats?.[stage] === 'object' && platformStats[stage].count > 0 && (
                    <span className="ml-0.5 opacity-75">({platformStats[stage].count})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        {!lastTriggered && !platformStats && (
          <p className="text-gray-500 text-xs">Click the play button above to trigger.</p>
        )}
      </div>
    </div>
  )
}

function PainPointsTab() {
  const [painPoints, setPainPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch_pp() {
      try {
        const session = await getCurrentSession()
        if (!session?.access_token) return

        const res = await fetch('/api/admin/value-evidence/pain-points', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (res.ok) {
          const data = await res.json()
          setPainPoints(data.painPoints || [])
        }
      } catch (error) {
        console.error('Pain points fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetch_pp()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pain Point Categories ({painPoints.length})</h2>
      </div>

      <div className="space-y-3">
        {painPoints.map(pp => (
          <motion.div
            key={pp.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-white">{pp.display_name}</h3>
                {pp.description && (
                  <p className="text-sm text-gray-400 mt-1">{pp.description}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {pp.industry_tags?.slice(0, 5).map((tag: string) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-gray-700/50 rounded-full text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {pp.related_services?.length > 0 && (
                  <div className="flex gap-2 mt-1">
                    {pp.related_services.map((svc: string) => (
                      <span
                        key={svc}
                        className="text-xs px-2 py-0.5 bg-blue-900/30 rounded-full text-blue-400"
                      >
                        {svc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right space-y-1 ml-4 flex-shrink-0">
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-white">{pp.frequency_count}</span> observations
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-blue-400">{pp.evidence_count}</span> evidence
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-green-400">{pp.calculation_count}</span> calculations
                </div>
                {pp.avg_monetary_impact && (
                  <div className="text-green-400 font-semibold text-sm">
                    {formatCurrency(pp.avg_monetary_impact)}/yr
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {painPoints.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Target size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No pain points yet</p>
            <p className="text-sm mt-1">Run the Internal Extraction or Social Listening workflows to populate pain point data.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Market Intel Tab
// ============================================================================

function MarketIntelTab() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState<string>('')
  const [processedFilter, setProcessedFilter] = useState<string>('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const params = new URLSearchParams()
      if (platform) params.set('platform', platform)
      if (processedFilter === 'processed') params.set('is_processed', 'true')
      else if (processedFilter === 'unprocessed') params.set('is_processed', 'false')

      const res = await fetch(`/api/admin/value-evidence/market-intel?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Market intel fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [platform, processedFilter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Market Intelligence ({items.length})</h2>
        <div className="flex gap-2">
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm"
          >
            <option value="">All platforms</option>
            <option value="reddit">Reddit</option>
            <option value="linkedin">LinkedIn</option>
            <option value="g2">G2</option>
            <option value="capterra">Capterra</option>
            <option value="google_maps">Google Maps</option>
            <option value="youtube">YouTube</option>
            <option value="quora">Quora</option>
            <option value="other">Other</option>
          </select>
          <select
            value={processedFilter}
            onChange={e => setProcessedFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm"
          >
            <option value="">All</option>
            <option value="unprocessed">Unprocessed</option>
            <option value="processed">Processed</option>
          </select>
          <button
            onClick={fetchItems}
            className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 flex-wrap mb-2">
                  <span className="text-xs px-2 py-0.5 bg-cyan-900/50 text-cyan-300 rounded capitalize">
                    {item.source_platform?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-700/50 text-gray-400 rounded capitalize">
                    {item.content_type}
                  </span>
                  {item.is_processed ? (
                    <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-400 rounded">Processed</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-amber-900/50 text-amber-400 rounded">Unprocessed</span>
                  )}
                  {item.industry_detected && (
                    <span className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded">
                      {item.industry_detected}
                    </span>
                  )}
                  {item.relevance_score != null && (
                    <span className="text-xs text-gray-500">Relevance: {item.relevance_score}/10</span>
                  )}
                </div>
                <p className="text-sm text-gray-300 line-clamp-3">{item.content_text}</p>
                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:underline mt-1 inline-block truncate max-w-full"
                  >
                    {item.source_url}
                  </a>
                )}
              </div>
              <div className="text-xs text-gray-500 flex-shrink-0">
                {new Date(item.scraped_at || item.created_at).toLocaleDateString()}
              </div>
            </div>
          </motion.div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Globe size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No market intelligence yet</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              Run the Social Listening workflow from the Dashboard tab. It scrapes Reddit, Google Maps, G2, Capterra and POSTs to <code className="text-xs bg-gray-800 px-1 rounded">/api/admin/value-evidence/ingest-market</code>.
            </p>
            <div className="mt-6 text-left max-w-lg mx-auto p-4 bg-gray-900/50 rounded-lg border border-gray-700 text-xs text-gray-400 space-y-2">
              <p className="font-medium text-gray-300">If data still doesn&apos;t appear after running:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Ensure <code>N8N_VEP002_WEBHOOK_URL</code> and <code>N8N_INGEST_SECRET</code> are set in <code>.env.local</code></li>
                <li>In n8n, the workflow must POST to <code>YourBaseURL/api/admin/value-evidence/ingest-market</code> with header <code>Authorization: Bearer N8N_INGEST_SECRET</code></li>
                <li>Check n8n execution logs for 401/400/500 from the ingest-market call</li>
                <li>Verify <code>docs/value-evidence-pipeline-setup.md</code> for full setup steps</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Benchmarks Tab
// ============================================================================

function BenchmarksTab() {
  const [benchmarks, setBenchmarks] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [industryFilter, setIndustryFilter] = useState('')

  const fetchBenchmarks = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const params = industryFilter ? `?industry=${encodeURIComponent(industryFilter)}` : ''
      const res = await fetch(`/api/admin/value-evidence/benchmarks${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setBenchmarks(data.benchmarks || [])
        setGrouped(data.grouped || {})
      }
    } catch (error) {
      console.error('Benchmarks fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [industryFilter])

  useEffect(() => {
    fetchBenchmarks()
  }, [fetchBenchmarks])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  const industries = Object.keys(grouped).sort((a, b) => (a === '_default' ? 1 : b === '_default' ? -1 : a.localeCompare(b)))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Industry Benchmarks ({benchmarks.length})</h2>
        <select
          value={industryFilter}
          onChange={e => setIndustryFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm"
        >
          <option value="">All industries</option>
          {industries.map(ind => (
            <option key={ind} value={ind}>{ind === '_default' ? 'Default (fallback)' : ind}</option>
          ))}
        </select>
        <button onClick={fetchBenchmarks} className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="space-y-6">
        {industries.map(industry => {
          const list = grouped[industry] || []
          if (list.length === 0) return null
          return (
            <div key={industry} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <h3 className="text-lg font-medium mb-4 text-teal-300">
                {industry === '_default' ? 'Default (fallback)' : industry.replace(/_/g, ' ')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((b: any) => (
                  <div
                    key={b.id}
                    className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50"
                  >
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      {b.benchmark_type?.replace(/_/g, ' ')}
                    </div>
                    <div className="text-lg font-semibold text-teal-400 mt-0.5">
                      {b.benchmark_type === 'avg_close_rate'
                        ? `${(parseFloat(b.value) * 100).toFixed(1)}%`
                        : formatCurrency(parseFloat(b.value))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {b.company_size_range} emp · {b.source} ({b.year})
                    </div>
                    {b.notes && (
                      <div className="text-xs text-gray-500 mt-1 truncate" title={b.notes}>{b.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {benchmarks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No benchmarks yet</p>
            <p className="text-sm mt-1">Add industry benchmarks via API or seed data. Used for monetary calculations.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Calculations Tab
// ============================================================================

function CalculationsTab() {
  const [calculations, setCalculations] = useState<any[]>([])
  const [painPoints, setPainPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [industryFilter, setIndustryFilter] = useState('')
  const [painPointFilter, setPainPointFilter] = useState('')
  const [generating, setGenerating] = useState(false)

  const fetchCalculations = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const params = new URLSearchParams()
      if (industryFilter) params.set('industry', industryFilter)
      if (painPointFilter) params.set('pain_point_id', painPointFilter)

      const [calcRes, ppRes] = await Promise.all([
        fetch(`/api/admin/value-evidence/calculations?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/admin/value-evidence/pain-points', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ])

      if (calcRes.ok) {
        const data = await calcRes.json()
        setCalculations(data.calculations || [])
      }
      if (ppRes.ok) {
        const data = await ppRes.json()
        setPainPoints(data.painPoints || [])
      }
    } catch (error) {
      console.error('Calculations fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [industryFilter, painPointFilter])

  useEffect(() => {
    fetchCalculations()
  }, [fetchCalculations])

  const handleGenerate = async () => {
    if (!painPoints.length || !industryFilter) return
    setGenerating(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const painPointId = painPointFilter || painPoints[0]?.id
      const res = await fetch('/api/admin/value-evidence/calculations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pain_point_category_id: painPointId,
          industry: industryFilter,
          company_size_range: '11-50',
        }),
      })

      if (res.ok) {
        await fetchCalculations()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to generate')
      }
    } catch (error) {
      console.error('Generate error:', error)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  const industries = [...new Set(calculations.map((c: any) => c.industry).filter(Boolean))].sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Value Calculations ({calculations.length})</h2>
        <select
          value={industryFilter}
          onChange={e => setIndustryFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm"
        >
          <option value="">All industries</option>
          {industries.map(ind => (
            <option key={ind} value={ind}>{ind.replace(/_/g, ' ')}</option>
          ))}
          {industries.length === 0 && ['professional_services', 'saas', 'ecommerce', 'healthcare'].map(ind => (
            <option key={ind} value={ind}>{ind.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={painPointFilter}
          onChange={e => setPainPointFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm"
        >
          <option value="">All pain points</option>
          {painPoints.map(pp => (
            <option key={pp.id} value={pp.id}>{pp.display_name}</option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating || !industryFilter}
          className="px-4 py-1.5 bg-green-600/30 border border-green-500/50 rounded-lg text-green-300 hover:bg-green-600/50 disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Generate
        </button>
        <button onClick={fetchCalculations} className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="space-y-3 max-h-[65vh] overflow-y-auto">
        {calculations.map(calc => {
          const Icon = METHOD_ICONS[calc.calculation_method] || DollarSign
          return (
            <motion.div
              key={calc.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded bg-green-600/20 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {(calc.pain_point_categories as any)?.display_name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {calc.industry?.replace(/_/g, ' ')} · {calc.company_size_range} emp
                    </div>
                    <div className="text-xs text-gray-500 mt-1 font-mono" title={calc.formula_expression}>
                      {calc.formula_expression?.slice(0, 80)}{calc.formula_expression?.length > 80 ? '…' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-green-400 font-semibold">
                    {formatCurrency(parseFloat(calc.annual_value))}/yr
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_COLORS[calc.confidence_level] || ''}`}>
                      {calc.confidence_level}
                    </span>
                    <span className="text-xs text-gray-500">{calc.evidence_count} evidence</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}

        {calculations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <DollarSign size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No calculations yet</p>
            <p className="text-sm mt-1">Select an industry and pain point, then click Generate to create value calculations from benchmarks.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Reports Tab
// ============================================================================

function ReportsTab() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [reportDetail, setReportDetail] = useState<{ report: any; contact: any } | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const params = typeFilter ? `?type=${encodeURIComponent(typeFilter)}` : ''
      const res = await fetch(`/api/admin/value-evidence/reports${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error('Reports fetch error:', error)
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const openReport = async (id: string) => {
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch(`/api/admin/value-evidence/reports/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setReportDetail(data)
        setSelectedReport(data.report)
      }
    } catch (error) {
      console.error('Report fetch error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Value Reports ({reports.length})</h2>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm"
        >
          <option value="">All types</option>
          <option value="internal_audit">Internal audit</option>
          <option value="client_facing">Client facing</option>
        </select>
        <button onClick={fetchReports} className="p-1.5 bg-gray-700 rounded-lg hover:bg-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3 max-h-[65vh] overflow-y-auto">
          {reports.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => openReport(r.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                selectedReport?.id === r.id
                  ? 'bg-green-900/20 border-green-500/50'
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-gray-400 mt-1">
                {r.industry?.replace(/_/g, ' ')} · {r.company_size_range}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-green-400 font-semibold">
                  {formatCurrency(parseFloat(r.total_annual_value))}/yr
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded">{r.report_type}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </motion.div>
          ))}

          {reports.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No reports yet</p>
              <p className="text-sm mt-1">Generate reports from the Outreach queue or sales walkthrough when viewing a lead.</p>
            </div>
          )}
        </div>

        {selectedReport && reportDetail && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 max-h-[65vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2">{selectedReport.title}</h3>
            {reportDetail.contact && (
              <div className="text-sm text-gray-400 mb-4">
                {reportDetail.contact.name} · {reportDetail.contact.company} · {reportDetail.contact.industry}
              </div>
            )}
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans bg-gray-900/50 p-4 rounded-lg overflow-x-auto">
                {selectedReport.summary_markdown}
              </pre>
            </div>
            {(selectedReport.value_statements as any[])?.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-amber-300">Value statements</h4>
                {(selectedReport.value_statements as any[]).map((vs: any, i: number) => (
                  <div key={i} className="p-2 bg-gray-900/50 rounded-lg text-sm">
                    <span className="font-medium text-green-400">{vs.pain_point}</span>
                    {' '}— {formatCurrency(vs.annual_value || 0)}/yr ({vs.calculation_method?.replace(/_/g, ' ')})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
