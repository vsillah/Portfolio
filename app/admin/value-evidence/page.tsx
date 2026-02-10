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
  Filter,
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
    { id: 'calculations', label: 'Calculations', icon: DollarSign },
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

          {/* Other tabs - placeholder for now */}
          {activeTab === 'market-intel' && (
            <ComingSoonTab name="Market Intelligence" description="View and manage raw scraped data from social media, review sites, and forums." />
          )}
          {activeTab === 'benchmarks' && (
            <ComingSoonTab name="Industry Benchmarks" description="View and manage benchmark data used for monetary calculations." />
          )}
          {activeTab === 'calculations' && (
            <ComingSoonTab name="Value Calculations" description="View generated monetary calculations with full formula traceability." />
          )}
          {activeTab === 'reports' && (
            <ComingSoonTab name="Value Reports" description="View and generate value assessment reports for leads." />
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

function ComingSoonTab({ name, description }: { name: string; description: string }) {
  return (
    <div className="text-center py-16 bg-gray-800/30 border border-gray-700/50 rounded-xl">
      <Layers size={48} className="mx-auto mb-4 text-gray-500" />
      <h2 className="text-xl font-semibold text-gray-300">{name}</h2>
      <p className="text-gray-500 mt-2 max-w-md mx-auto">{description}</p>
      <p className="text-sm text-gray-600 mt-4">
        Data is available via API. Full UI coming soon.
      </p>
    </div>
  )
}
