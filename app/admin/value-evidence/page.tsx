'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  FileText,
  BarChart3,
  RefreshCw,
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
  ExternalLink,
  Pencil,
  Trash2,
  Save,
  X,
  Square,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { parseReturnTo, buildLinkWithReturn } from '@/lib/admin-return-context'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import Pagination from '@/components/admin/Pagination'
import { ExtractionStatusChip, type ScopeType } from '@/components/admin/ExtractionStatusChip'
import { useWorkflowStatus } from '@/lib/hooks/useWorkflowStatus'
import { useDevTunnel } from '@/lib/hooks/useDevTunnel'
import { getCurrentSession } from '@/lib/auth'
import { getIndustryDisplayName, INDUSTRY_SLUGS } from '@/lib/constants/industry'

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
    evidence_count: number
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
}

type TabName = 'dashboard' | 'pain-points' | 'market-intel' | 'benchmarks' | 'calculations' | 'reports'

const VALID_TAB_QUERY_VALUES: TabName[] = [
  'dashboard',
  'pain-points',
  'market-intel',
  'benchmarks',
  'calculations',
  'reports',
]

function isTabName(v: string): v is TabName {
  return (VALID_TAB_QUERY_VALUES as string[]).includes(v)
}

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
  low: 'text-muted-foreground bg-silicon-slate/50',
}

/**
 * Strip the "Cost of Doing Nothing" section from the markdown since the
 * structured opportunity-area cards already cover the same content.
 */
function stripDuplicateCostSection(md: string): string {
  return md.replace(
    /## The Cost of Doing Nothing\n[\s\S]*?(?=\n---|\n## |\n$)/,
    ''
  )
}

const reportMarkdownComponents: Record<string, React.ComponentType<{ children?: React.ReactNode; [key: string]: unknown }>> = {
  h1: ({ children, ...props }) => <h1 className="text-xl font-bold text-foreground mb-3 mt-4" {...props}>{children}</h1>,
  h2: ({ children, ...props }) => <h2 className="text-lg font-semibold text-foreground mb-2 mt-4 border-b border-silicon-slate/50 pb-1" {...props}>{children}</h2>,
  h3: ({ children, ...props }) => <h3 className="text-base font-semibold text-foreground mb-1 mt-3" {...props}>{children}</h3>,
  p: ({ children, ...props }) => <p className="text-sm text-foreground mb-2 leading-relaxed" {...props}>{children}</p>,
  strong: ({ children, ...props }) => <strong className="text-foreground font-semibold" {...props}>{children}</strong>,
  em: ({ children, ...props }) => <em className="text-muted-foreground" {...props}>{children}</em>,
  ul: ({ children, ...props }) => <ul className="list-disc list-inside text-sm text-foreground mb-2 space-y-0.5" {...props}>{children}</ul>,
  ol: ({ children, ...props }) => <ol className="list-decimal list-inside text-sm text-foreground mb-2 space-y-0.5" {...props}>{children}</ol>,
  table: ({ children, ...props }) => <div className="overflow-x-auto my-3"><table className="min-w-full text-sm" {...props}>{children}</table></div>,
  thead: ({ children, ...props }) => <thead className="border-b border-silicon-slate" {...props}>{children}</thead>,
  th: ({ children, ...props }) => <th className="px-3 py-1.5 text-left text-muted-foreground font-medium text-xs" {...props}>{children}</th>,
  td: ({ children, ...props }) => <td className="px-3 py-1.5 text-foreground border-t border-silicon-slate/50" {...props}>{children}</td>,
  hr: () => <hr className="border-silicon-slate my-4" />,
  blockquote: ({ children, ...props }) => <blockquote className="border-l-2 border-emerald-500/40 pl-3 my-2 text-muted-foreground italic text-sm" {...props}>{children}</blockquote>,
}

function normalizeStatementForTab(vs: Record<string, unknown>) {
  return {
    painPoint: (vs.pain_point ?? vs.painPoint ?? 'Unnamed opportunity') as string,
    annualValue: (vs.annual_value ?? vs.annualValue ?? 0) as number,
    calculationMethod: (vs.calculation_method ?? vs.calculationMethod) as string | undefined,
    formulaReadable: (vs.formula_readable ?? vs.formulaReadable) as string | undefined,
    evidenceSummary: (vs.evidence_summary ?? vs.evidenceSummary) as string | undefined,
    confidence: vs.confidence as string | undefined,
  }
}

// ============================================================================
// Component
// ============================================================================

export default function ValueEvidencePage() {
  const searchParams = useSearchParams()
  const returnUrl = parseReturnTo(searchParams)
  const [activeTab, setActiveTab] = useState<TabName>('dashboard')
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [focusPainPointId, setFocusPainPointId] = useState<string | null>(null)
  const [focusCalculationPainPointId, setFocusCalculationPainPointId] = useState<string | null>(null)
  const [triggerAllLoading, setTriggerAllLoading] = useState(false)
  const [socialMaxResults, setSocialMaxResults] = useState(10)
  const [socialSources, setSocialSources] = useState<string[]>(['reddit', 'google_maps', 'linkedin', 'g2', 'capterra'])
  const [scopeType, setScopeType] = useState<ScopeType | null>(null)
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [scopeLabel, setScopeLabel] = useState<string | null>(null)
  const tunnel = useDevTunnel()

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && isTabName(t)) setActiveTab(t)
  }, [searchParams])

  /** Deep-link from Lead Pipeline: ?tab=dashboard&highlight=vep001 (or pipeline | internal) */
  useEffect(() => {
    const h = searchParams.get('highlight')
    if (!h || !['vep001', 'pipeline', 'internal'].includes(h)) return
    if (activeTab !== 'dashboard') return
    const t = window.setTimeout(() => {
      document.getElementById('vep-dashboard-pipeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(t)
  }, [searchParams, activeTab])

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

  /** Bumps when the header refresh runs so tab-local lists (Market Intel, etc.) reload too. */
  const [pageRefreshNonce, setPageRefreshNonce] = useState(0)

  const handleHeaderRefresh = useCallback(async () => {
    await fetchDashboard()
    setPageRefreshNonce(n => n + 1)
  }, [fetchDashboard])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const vep001Status = useWorkflowStatus(
    { apiBase: '/api/admin/value-evidence/workflow-status', workflowId: 'vep001' },
    () => fetchDashboard(),
  )
  const vep002Status = useWorkflowStatus(
    { apiBase: '/api/admin/value-evidence/workflow-status', workflowId: 'vep002' },
    () => fetchDashboard(),
  )

  const eitherRunning =
    vep001Status.state === 'running' || vep001Status.state === 'stale' ||
    vep002Status.state === 'running' || vep002Status.state === 'stale'

  /** Internal → Social → (dev) Cloudflare tunnel readiness — not the same as admin nav tabs. */
  const pipelinePhaseTotal = tunnel.isDev ? 3 : 2

  const handleScopeChange = useCallback((type: ScopeType | null, id: string | null, label: string | null) => {
    setScopeType(type)
    setScopeId(id)
    setScopeLabel(label)
  }, [])

  const triggerWorkflow = async (
    workflow: 'internal_extraction' | 'social_listening',
    statusHook: ReturnType<typeof useWorkflowStatus>,
    maxResults?: number,
    sources?: string[],
  ) => {
    try {
      if (tunnel.isDev) {
        const tunnelOk = await tunnel.ensureTunnel()
        if (!tunnelOk) {
          console.warn('[VEP] Tunnel not available — triggering anyway, but callback may not reach dev')
        }
      }

      const session = await getCurrentSession()
      if (!session?.access_token) return
      const body: Record<string, unknown> = { workflow }
      if (workflow === 'social_listening' && maxResults) {
        body.maxResults = maxResults
      }
      if (workflow === 'social_listening' && sources && sources.length > 0) {
        body.sources = sources
      }
      if (scopeType && scopeId) {
        body.scope_type = scopeType
        body.scope_id = scopeId
        const phases: string[] = []
        if (workflow === 'internal_extraction') phases.push('internal')
        if (workflow === 'social_listening') phases.push('social')
        body.phases = phases
      }
      const res = await fetch('/api/admin/value-evidence/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.triggered) {
        statusHook.onTriggerStarted(data.run_id)
      }
    } catch {
      // Silent — chip will show stale/idle
    }
  }

  const handleTriggerAll = async () => {
    setTriggerAllLoading(true)
    await Promise.allSettled([
      triggerWorkflow('internal_extraction', vep001Status),
      triggerWorkflow('social_listening', vep002Status, socialMaxResults, socialSources),
    ])
    setTriggerAllLoading(false)
  }

  const handleCancelAll = () => {
    if (vep001Status.currentRun && (vep001Status.state === 'running' || vep001Status.state === 'stale')) {
      vep001Status.markRunFailed(vep001Status.currentRun.id, 'Cancelled by user')
    }
    if (vep002Status.currentRun && (vep002Status.state === 'running' || vep002Status.state === 'stale')) {
      vep002Status.markRunFailed(vep002Status.currentRun.id, 'Cancelled by user')
    }
  }

  const tabs: { id: TabName; label: string; icon: typeof DollarSign; count?: number; accentClass?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'pain-points', label: 'Pain Points', icon: Target, count: dashData?.overview.totalPainPoints, accentClass: 'bg-purple-500/30 text-purple-300' },
    { id: 'market-intel', label: 'Market Intel', icon: Globe, count: dashData?.overview.totalMarketIntel, accentClass: 'bg-cyan-500/30 text-cyan-300' },
    { id: 'benchmarks', label: 'Benchmarks', icon: BookOpen, count: dashData?.overview.totalBenchmarks, accentClass: 'bg-teal-500/30 text-teal-300' },
    { id: 'calculations', label: 'Calculations', icon: DollarSign, count: dashData?.overview.totalCalculations, accentClass: 'bg-green-500/30 text-green-300' },
    { id: 'reports', label: 'Reports', icon: FileText, count: dashData?.overview.totalReports, accentClass: 'bg-amber-500/30 text-amber-300' },
  ]

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-6 pb-24">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Value Evidence Pipeline', href: '/admin/value-evidence' },
        ]} />

        {returnUrl && (
          <Link href={returnUrl} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mt-2">
            <ArrowLeft size={16} /> Back
          </Link>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold gradient-text">
                Value Evidence Pipeline
              </h1>
              <p className="text-muted-foreground mt-1">
                Pain point tracking, monetary calculations, and value reporting
              </p>
            </div>
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleHeaderRefresh}
                title="Refresh dashboard and the current tab’s data"
                className="p-2 bg-silicon-slate border border-silicon-slate rounded-lg hover:bg-silicon-slate/80"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </motion.button>
            </div>
          </div>

          {/* Tab Navigation with count badges */}
          <div className="flex gap-1 bg-silicon-slate/50 border border-silicon-slate rounded-xl p-1 mb-2 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-green-600/30 text-green-300 border border-green-500/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-silicon-slate/50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`ml-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                      isActive
                        ? (tab.accentClass || 'bg-green-500/30 text-green-300')
                        : 'bg-silicon-slate/80 text-muted-foreground'
                    }`}>
                      {tab.count.toLocaleString()}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Secondary metrics bar */}
          {activeTab === 'dashboard' && dashData && (
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-6 px-1">
              <span>Evidence: <span className="text-foreground/90 font-medium">{dashData.overview.totalEvidence.toLocaleString()}</span>
                {dashData.evidenceBySource && Object.keys(dashData.evidenceBySource).length > 0 && (
                  <span className="text-muted-foreground/90 ml-1">
                    ({Object.entries(dashData.evidenceBySource).map(([src, cnt], i) => (
                      <span key={src}>
                        {i > 0 && ', '}
                        <span className="capitalize">{src.replace(/_/g, ' ')}</span> {cnt}
                      </span>
                    ))})
                  </span>
                )}
              </span>
              <span className="text-silicon-slate">·</span>
              <span>Industries: <span className="text-foreground/90 font-medium">{Object.keys(dashData.industryBreakdown || {}).filter(k => k !== '_default').length}</span></span>
              <span className="text-silicon-slate">·</span>
              <span>Content Mapped: <span className="text-foreground/90 font-medium">{dashData.overview.totalContentMappings}</span></span>
              {(dashData.overview.unprocessedMarketIntel || 0) > 0 && (
                <>
                  <span className="text-silicon-slate">·</span>
                  <span className="text-amber-400">{dashData.overview.unprocessedMarketIntel} unprocessed intel</span>
                </>
              )}
            </div>
          )}
          {activeTab !== 'dashboard' && <div className="mb-6" />}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Pipeline Trigger Bar */}
              <div
                id="vep-dashboard-pipeline"
                className="flex items-center gap-3 flex-wrap scroll-mt-24"
              >
                {eitherRunning ? (
                  <button
                    onClick={handleCancelAll}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Cancel Pipeline
                  </button>
                ) : (
                  <button
                    onClick={handleTriggerAll}
                    disabled={triggerAllLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 transition-all"
                  >
                    {triggerAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Run Full Pipeline
                  </button>
                )}
                <ExtractionStatusChip
                  label="Internal"
                  pipelinePhase={{ current: 1, total: pipelinePhaseTotal }}
                  state={vep001Status.state}
                  currentRun={vep001Status.currentRun}
                  recentRuns={vep001Status.recentRuns}
                  elapsedMs={vep001Status.elapsedMs}
                  isDrawerOpen={vep001Status.isDrawerOpen}
                  isHistoryOpen={vep001Status.isHistoryOpen}
                  toggleDrawer={vep001Status.toggleDrawer}
                  toggleHistory={vep001Status.toggleHistory}
                  markRunFailed={vep001Status.markRunFailed}
                  onRetry={() => triggerWorkflow('internal_extraction', vep001Status)}
                  scopeEntitySelector={{
                    scopeType,
                    scopeId,
                    scopeLabel,
                    onScopeChange: handleScopeChange,
                  }}
                />
                <ExtractionStatusChip
                  label="Social"
                  pipelinePhase={{ current: 2, total: pipelinePhaseTotal }}
                  state={vep002Status.state}
                  currentRun={vep002Status.currentRun}
                  recentRuns={vep002Status.recentRuns}
                  elapsedMs={vep002Status.elapsedMs}
                  isDrawerOpen={vep002Status.isDrawerOpen}
                  isHistoryOpen={vep002Status.isHistoryOpen}
                  toggleDrawer={vep002Status.toggleDrawer}
                  toggleHistory={vep002Status.toggleHistory}
                  markRunFailed={vep002Status.markRunFailed}
                  onRetry={(maxResults) => triggerWorkflow('social_listening', vep002Status, maxResults, socialSources)}
                  scopeSelector={{
                    selected: socialMaxResults,
                    onChange: setSocialMaxResults,
                  }}
                  sourceSelector={{
                    selected: socialSources,
                    onChange: setSocialSources,
                  }}
                  scopeEntitySelector={{
                    scopeType,
                    scopeId,
                    scopeLabel,
                    onScopeChange: handleScopeChange,
                  }}
                />
                {tunnel.isDev && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      tunnel.status === 'connected'
                        ? 'bg-green-500/20 text-green-400'
                        : tunnel.status === 'connecting' || tunnel.status === 'checking'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                    title={
                      tunnel.message ||
                      `Phase 3 of ${pipelinePhaseTotal} · Dev tunnel (${tunnel.status})`
                    }
                  >
                    <span className="text-gray-600 tabular-nums">{pipelinePhaseTotal}/{pipelinePhaseTotal}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      tunnel.status === 'connected' ? 'bg-green-400' :
                      tunnel.status === 'connecting' || tunnel.status === 'checking' ? 'bg-yellow-400 animate-pulse' :
                      'bg-red-400'
                    }`} />
                    {tunnel.status === 'connected' ? 'Tunnel' :
                     tunnel.status === 'connecting' ? 'Connecting...' :
                     tunnel.status === 'checking' ? 'Checking...' :
                     'Tunnel Off'}
                  </span>
                )}
              </div>

              {/* 2-column layout for lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-6">
                  {/* Top Pain Points — clickable */}
                  <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Target size={18} className="text-purple-400" />
                        Top Pain Points
                      </h3>
                      <button
                        onClick={() => setActiveTab('pain-points')}
                        className="text-xs text-radiant-gold hover:underline flex items-center gap-1"
                      >
                        View all <ArrowRight size={12} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(dashData?.topPainPoints || []).slice(0, 8).map(pp => (
                        <button
                          key={pp.id}
                          onClick={() => { setFocusPainPointId(pp.id); setActiveTab('pain-points') }}
                          className="w-full flex items-center justify-between p-3 bg-silicon-slate/30 rounded-lg cursor-pointer hover:bg-silicon-slate/60 transition-colors group focus-visible:ring-2 focus-visible:ring-radiant-gold/50 focus-visible:outline-none text-left"
                        >
                          <div className="min-w-0">
                            <span className="font-medium block truncate">{pp.display_name}</span>
                            <div className="flex gap-2 mt-1">
                              {pp.industry_tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 bg-silicon-slate/80 rounded-full text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <div className="text-right">
                              <span className={`text-sm ${pp.evidence_count > 0 ? 'text-green-400 font-medium' : 'text-muted-foreground/90'}`}>{pp.evidence_count} evidence</span>
                              {pp.avg_monetary_impact && (
                                <div className="text-green-400 text-sm font-medium">
                                  {formatCurrency(pp.avg_monetary_impact)}/yr
                                </div>
                              )}
                            </div>
                            <ArrowRight size={14} className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                          </div>
                        </button>
                      ))}
                      {(!dashData?.topPainPoints || dashData.topPainPoints.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">
                          No pain points yet. Run Internal Extraction to populate.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  {/* Top Calculations — clickable */}
                  <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <DollarSign size={18} className="text-green-400" />
                        Top Value Calculations
                      </h3>
                      <button
                        onClick={() => setActiveTab('calculations')}
                        className="text-xs text-radiant-gold hover:underline flex items-center gap-1"
                      >
                        View all <ArrowRight size={12} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(dashData?.topCalculations || []).map(calc => {
                        const Icon = METHOD_ICONS[calc.calculation_method] || DollarSign
                        const ppName = (calc.pain_point_categories as any)?.display_name
                        return (
                          <button
                            key={calc.id}
                            onClick={() => {
                              if (ppName) setFocusCalculationPainPointId(ppName)
                              setActiveTab('calculations')
                            }}
                            className="w-full flex items-center justify-between p-3 bg-silicon-slate/30 rounded-lg cursor-pointer hover:bg-silicon-slate/60 transition-colors group focus-visible:ring-2 focus-visible:ring-radiant-gold/50 focus-visible:outline-none text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded bg-green-600/20 flex items-center justify-center flex-shrink-0">
                                <Icon size={16} className="text-green-400" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium block truncate">{ppName}</span>
                                <div className="text-xs text-muted-foreground">
                                  {calc.industry} &middot; {calc.company_size_range} emp
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                              <div className="text-right">
                                <span className="text-green-400 font-semibold">
                                  {formatCurrency(calc.annual_value)}/yr
                                </span>
                                <div className="flex items-center gap-1 justify-end mt-0.5">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_COLORS[calc.confidence_level] || ''}`}>
                                    {calc.confidence_level}
                                  </span>
                                  <span className="text-xs text-muted-foreground/90">
                                    {calc.evidence_count} ev.
                                  </span>
                                </div>
                              </div>
                              <ArrowRight size={14} className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                            </div>
                          </button>
                        )
                      })}
                      {(!dashData?.topCalculations || dashData.topCalculations.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">
                          No calculations yet. Generate from the Calculations tab.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pain Points Tab */}
          {activeTab === 'pain-points' && (
            <PainPointsTab pageRefreshNonce={pageRefreshNonce} focusId={focusPainPointId} onFocusConsumed={() => setFocusPainPointId(null)} />
          )}

          {/* Market Intel Tab */}
          {activeTab === 'market-intel' && (
            <MarketIntelTab pageRefreshNonce={pageRefreshNonce} />
          )}
          {/* Benchmarks Tab */}
          {activeTab === 'benchmarks' && (
            <BenchmarksTab pageRefreshNonce={pageRefreshNonce} />
          )}
          {/* Calculations Tab */}
          {activeTab === 'calculations' && (
            <CalculationsTab pageRefreshNonce={pageRefreshNonce} />
          )}
          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <ReportsTab pageRefreshNonce={pageRefreshNonce} />
          )}
        </motion.div>
      </div>
    </ProtectedRoute>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================


const PAGE_SIZE = 50

function PainPointsTab({ pageRefreshNonce, focusId, onFocusConsumed }: { pageRefreshNonce: number; focusId?: string | null; onFocusConsumed?: () => void }) {
  const [painPoints, setPainPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [evidenceMap, setEvidenceMap] = useState<Record<string, any[]>>({})
  const [calcsMap, setCalcsMap] = useState<Record<string, any[]>>({})
  const [evidenceLoading, setEvidenceLoading] = useState<string | null>(null)

  const [sortBy, setSortBy] = useState<'evidence' | 'calculations' | 'name' | 'impact'>('evidence')
  const [filterIndustry, setFilterIndustry] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function fetch_pp() {
      setLoading(true)
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
  }, [pageRefreshNonce])

  useEffect(() => {
    if (focusId && !loading && painPoints.length > 0) {
      setExpandedId(focusId)
      onFocusConsumed?.()
      setTimeout(() => {
        document.getElementById(`pp-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [focusId, loading, painPoints.length, onFocusConsumed])

  const allIndustryTags = React.useMemo(() => {
    const tags = new Set<string>()
    for (const pp of painPoints) {
      for (const tag of pp.industry_tags || []) tags.add(tag)
    }
    return Array.from(tags).sort()
  }, [painPoints])

  const painPointsWithData = React.useMemo(
    () => painPoints.filter(pp => (pp.evidence_count || 0) > 0 || (pp.calculation_count || 0) > 0).length,
    [painPoints]
  )

  const [ppPage, setPpPage] = useState(1)

  const filteredAndSorted = React.useMemo(() => {
    let list = [...painPoints].filter(pp => (pp.evidence_count || 0) > 0 || (pp.calculation_count || 0) > 0)

    if (filterIndustry !== 'all') {
      list = list.filter(pp => pp.industry_tags?.includes(filterIndustry))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(pp =>
        pp.display_name?.toLowerCase().includes(q) ||
        pp.description?.toLowerCase().includes(q) ||
        pp.name?.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'evidence': return (b.evidence_count || 0) - (a.evidence_count || 0)
        case 'calculations': return (b.calculation_count || 0) - (a.calculation_count || 0)
        case 'impact': return (parseFloat(b.avg_monetary_impact) || 0) - (parseFloat(a.avg_monetary_impact) || 0)
        case 'name': return (a.display_name || '').localeCompare(b.display_name || '')
        default: return 0
      }
    })

    return list
  }, [painPoints, filterIndustry, searchQuery, sortBy])

  useEffect(() => { setPpPage(1) }, [filterIndustry, searchQuery, sortBy])

  const ppTotalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))
  const ppPageItems = filteredAndSorted.slice((ppPage - 1) * PAGE_SIZE, ppPage * PAGE_SIZE)

  const toggleExpand = async (ppId: string) => {
    if (expandedId === ppId) {
      setExpandedId(null)
      return
    }
    setExpandedId(ppId)

    const needsEvidence = !evidenceMap[ppId]
    const needsCalcs = !calcsMap[ppId]

    if (needsEvidence || needsCalcs) {
      setEvidenceLoading(ppId)
      try {
        const session = await getCurrentSession()
        if (!session?.access_token) return

        const fetches: Promise<void>[] = []

        if (needsEvidence) {
          fetches.push(
            fetch(`/api/admin/value-evidence/pain-points/${ppId}/evidence`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).then(async res => {
              if (res.ok) {
                const data = await res.json()
                setEvidenceMap(prev => ({ ...prev, [ppId]: data.evidence || [] }))
              }
            })
          )
        }

        if (needsCalcs) {
          fetches.push(
            fetch(`/api/admin/value-evidence/calculations?pain_point_id=${ppId}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).then(async res => {
              if (res.ok) {
                const data = await res.json()
                setCalcsMap(prev => ({ ...prev, [ppId]: data.calculations || [] }))
              }
            })
          )
        }

        await Promise.all(fetches)
      } catch (error) {
        console.error('Expand fetch error:', error)
      } finally {
        setEvidenceLoading(null)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pain Point Categories ({filteredAndSorted.length}{filteredAndSorted.length !== painPointsWithData ? ` of ${painPointsWithData}` : ''})</h2>
      </div>

      {/* Sort / Filter / Search toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/80" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search pain points…"
            className="w-full pl-9 pr-3 py-2 bg-silicon-slate/60 border border-silicon-slate rounded-lg text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-radiant-gold/50"
          />
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 bg-silicon-slate/60 border border-silicon-slate rounded-lg text-sm text-foreground focus:outline-none focus:border-radiant-gold/50"
        >
          <option value="evidence">Sort: Most Evidence</option>
          <option value="calculations">Sort: Most Calculations</option>
          <option value="impact">Sort: Highest Impact</option>
          <option value="name">Sort: A → Z</option>
        </select>

        <select
          value={filterIndustry}
          onChange={e => setFilterIndustry(e.target.value)}
          className="px-3 py-2 bg-silicon-slate/60 border border-silicon-slate rounded-lg text-sm text-foreground focus:outline-none focus:border-radiant-gold/50"
        >
          <option value="all">All Industries</option>
          {allIndustryTags.map(tag => (
            <option key={tag} value={tag}>{tag.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {(filterIndustry !== 'all' || searchQuery.trim()) && (
          <button
            onClick={() => { setFilterIndustry('all'); setSearchQuery('') }}
            className="text-xs text-radiant-gold hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="space-y-3">
        {ppPageItems.map(pp => {
          const isExpanded = expandedId === pp.id
          const evidence = evidenceMap[pp.id]
          return (
            <motion.div
              key={pp.id}
              id={`pp-${pp.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-silicon-slate/50 border border-silicon-slate rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(pp.id)}
                className="w-full p-4 text-left hover:bg-silicon-slate/70 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{pp.display_name}</h3>
                      {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                    {pp.description && (
                      <p className="text-sm text-muted-foreground mt-1">{pp.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {pp.industry_tags?.slice(0, 5).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-silicon-slate/80 rounded-full text-muted-foreground"
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
                            className="text-xs px-2 py-0.5 bg-radiant-gold/20 rounded-full text-radiant-gold"
                          >
                            {svc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-1 ml-4 flex-shrink-0">
                    <div className="text-sm text-muted-foreground">
                      <span className={`font-medium ${pp.evidence_count > 0 ? 'text-radiant-gold' : 'text-muted-foreground/90'}`}>{pp.evidence_count}</span> evidence
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-green-400">{pp.calculation_count}</span> calculations
                      {pp.confidence_breakdown && pp.calculation_count > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {pp.confidence_breakdown.high > 0 && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-green-600/20 text-green-400">{pp.confidence_breakdown.high} high</span>
                          )}
                          {pp.confidence_breakdown.medium > 0 && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-600/20 text-yellow-400">{pp.confidence_breakdown.medium} med</span>
                          )}
                          {pp.confidence_breakdown.low > 0 && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-red-600/20 text-red-400">{pp.confidence_breakdown.low} low</span>
                          )}
                        </div>
                      )}
                    </div>
                    {pp.avg_monetary_impact && (
                      <div className="text-green-400 font-semibold text-sm">
                        {formatCurrency(pp.avg_monetary_impact)}/yr
                      </div>
                    )}
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-silicon-slate"
                  >
                    <div className="p-4 space-y-5">
                      {evidenceLoading === pp.id && (
                        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                          <RefreshCw size={14} className="animate-spin" /> Loading…
                        </div>
                      )}

                      {/* Evidence section */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Evidence ({pp.evidence_count})</h4>
                        {evidence && evidence.length === 0 && (
                          <p className="text-sm text-muted-foreground/90 py-2">No evidence collected yet for this pain point.</p>
                        )}
                        {evidence && evidence.map((ev: any) => (
                          <div key={ev.id} className="p-3 bg-silicon-slate/70 rounded-lg space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="px-1.5 py-0.5 bg-purple-600/20 rounded text-purple-300 capitalize">
                                {ev.source_type?.replace(/_/g, ' ')}
                              </span>
                              {ev.industry && (
                                <span className="px-1.5 py-0.5 bg-blue-600/20 rounded text-blue-300">
                                  {ev.industry}
                                </span>
                              )}
                              {ev.confidence_score != null && (
                                <span className="text-radiant-gold">
                                  {Math.round(ev.confidence_score * 100)}% confidence
                                </span>
                              )}
                              {ev.monetary_indicator != null && parseFloat(ev.monetary_indicator) > 0 && (
                                <span className="text-green-400 font-medium">
                                  {formatCurrency(parseFloat(ev.monetary_indicator))}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">
                              &ldquo;{ev.source_excerpt}&rdquo;
                            </p>
                            {ev.monetary_context && (
                              <p className="text-xs text-muted-foreground/90 italic">Cost context: {ev.monetary_context}</p>
                            )}
                            <div className="text-xs text-muted-foreground/80">
                              {ev.extracted_by && <span>Extracted by: {ev.extracted_by}</span>}
                              {ev.created_at && <span className="ml-3">{new Date(ev.created_at).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Calculations section */}
                      {calcsMap[pp.id] !== undefined && (
                        <div className="space-y-3 border-t border-silicon-slate pt-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                              <DollarSign size={14} className="text-green-400" />
                              Calculations ({calcsMap[pp.id].length})
                            </h4>
                          </div>
                          {calcsMap[pp.id].length === 0 && (
                            <p className="text-sm text-muted-foreground/90 py-2">No calculations generated for this pain point yet.</p>
                          )}
                          {calcsMap[pp.id].slice(0, 5).map((calc: any) => (
                            <div key={calc.id} className="p-3 bg-green-950/30 border border-green-900/40 rounded-lg space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-1.5 py-0.5 bg-green-600/20 rounded text-green-300 font-medium">
                                    {formatCurrency(calc.annual_value)}/yr
                                  </span>
                                  <span className="text-muted-foreground">{calc.industry?.replace(/_/g, ' ')}</span>
                                  <span className="text-muted-foreground/80">{calc.company_size_range} employees</span>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  calc.confidence_level === 'high' ? 'bg-green-600/20 text-green-300' :
                                  calc.confidence_level === 'medium' ? 'bg-yellow-600/20 text-yellow-300' :
                                  'bg-red-600/20 text-red-300'
                                }`}>
                                  {calc.confidence_level}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">
                                {calc.formula_expression}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
                                <span>{calc.calculation_method?.replace(/_/g, ' ')}</span>
                                {calc.evidence_count > 0 && (
                                  <span className="text-radiant-gold">{calc.evidence_count} evidence</span>
                                )}
                                {calc.generated_by === 'ai' && (
                                  <span className="px-1 py-0.5 bg-purple-600/20 rounded text-purple-300">evidence-adjusted</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {calcsMap[pp.id].length > 5 && (
                            <p className="text-xs text-muted-foreground/90">Showing top 5 of {calcsMap[pp.id].length} calculations</p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}

        <Pagination
          page={ppPage}
          totalPages={ppTotalPages}
          total={filteredAndSorted.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPpPage}
        />

        {filteredAndSorted.length === 0 && painPoints.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No matching pain points</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        )}
        {painPoints.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
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

function MarketIntelTab({ pageRefreshNonce }: { pageRefreshNonce: number }) {
  const [items, setItems] = useState<any[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [platform, setPlatform] = useState<string>('')
  const [processedFilter, setProcessedFilter] = useState<string>('')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchPage = useCallback(async (pageNum: number) => {
    setLoading(true)
    setLoadError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setLoadError('Sign in is required to load this list.')
        return
      }

      const params = new URLSearchParams()
      if (platform) params.set('platform', platform)
      if (processedFilter === 'processed') params.set('is_processed', 'true')
      else if (processedFilter === 'unprocessed') params.set('is_processed', 'false')
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String((pageNum - 1) * PAGE_SIZE))

      const res = await fetch(`/api/admin/value-evidence/market-intel?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setTotal(data.total ?? 0)
        setPage(pageNum)
        if (data.platforms) setPlatforms(data.platforms)
        return
      }

      if (res.status === 401 || res.status === 403) {
        setLoadError('Your session may have expired. Reload the page or sign in again.')
      } else {
        setLoadError('Could not load market intelligence. Try again in a moment.')
      }
    } catch (error) {
      console.error('Market intel fetch error:', error)
      setLoadError('Could not load market intelligence. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [platform, processedFilter])

  useEffect(() => {
    fetchPage(1)
  }, [fetchPage, pageRefreshNonce])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">
          Market Intelligence ({total})
        </h2>
        <div className="flex gap-2">
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            className="px-3 py-1.5 bg-silicon-slate border border-silicon-slate rounded-lg text-sm"
          >
            <option value="">All platforms</option>
            {platforms.map(p => (
              <option key={p} value={p}>
                {p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </select>
          <select
            value={processedFilter}
            onChange={e => setProcessedFilter(e.target.value)}
            className="px-3 py-1.5 bg-silicon-slate border border-silicon-slate rounded-lg text-sm"
          >
            <option value="">All</option>
            <option value="unprocessed">Unprocessed</option>
            <option value="processed">Processed</option>
          </select>
          <button
            onClick={() => fetchPage(1)}
            className="p-1.5 bg-silicon-slate/80 rounded-lg hover:bg-gray-600"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loadError && (
          <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-900/20 text-amber-200 text-sm">
            {loadError}
          </div>
        )}
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-silicon-slate/50 border border-silicon-slate rounded-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 flex-wrap mb-2">
                  <span className="text-xs px-2 py-0.5 bg-cyan-900/50 text-cyan-300 rounded capitalize">
                    {item.source_platform?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-silicon-slate/80/50 text-muted-foreground rounded capitalize">
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
                    <span className="text-xs text-muted-foreground">Relevance: {item.relevance_score}/10</span>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-3">{item.content_text}</p>
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
              <div className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(item.scraped_at || item.created_at).toLocaleDateString()}
              </div>
            </div>
          </motion.div>
        ))}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          loading={loading}
          onPageChange={fetchPage}
        />

        {items.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <Globe size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No market intelligence yet</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              Refresh only reloads data already stored in the database; it does not run scraping. Run the Social Listening workflow from the Dashboard tab. It scrapes Reddit, Google Maps, G2, Capterra and POSTs to <code className="text-xs bg-silicon-slate px-1 rounded">/api/admin/value-evidence/ingest-market</code>.
            </p>
            <div className="mt-6 text-left max-w-lg mx-auto p-4 bg-silicon-slate/70/50 rounded-lg border border-silicon-slate text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">If data still doesn&apos;t appear after running:</p>
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

const BENCHMARK_TYPES = [
  'avg_hourly_wage',
  'avg_employee_cost',
  'avg_error_cost',
  'avg_daily_revenue',
  'avg_deal_size',
  'avg_close_rate',
  'avg_lead_value',
]

const SIZE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001+']

function BenchmarkCard({ b, onUpdate, onDelete }: {
  b: any
  onUpdate: () => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editValue, setEditValue] = useState(String(b.value))
  const [editSource, setEditSource] = useState(b.source || '')
  const [editYear, setEditYear] = useState(String(b.year || ''))
  const [editNotes, setEditNotes] = useState(b.notes || '')

  const handleSave = async () => {
    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch('/api/admin/value-evidence/benchmarks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: b.id,
          value: parseFloat(editValue),
          source: editSource,
          year: parseInt(editYear),
          notes: editNotes || null,
        }),
      })

      if (res.ok) {
        setEditing(false)
        onUpdate()
      }
    } catch (error) {
      console.error('Save benchmark error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(String(b.value))
    setEditSource(b.source || '')
    setEditYear(String(b.year || ''))
    setEditNotes(b.notes || '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="p-3 bg-silicon-slate/70 rounded-lg border border-blue-500/40 space-y-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {b.benchmark_type?.replace(/_/g, ' ')}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground/90">Value</label>
            <input
              type="number"
              step="any"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="w-full px-2 py-1 bg-silicon-slate border border-silicon-slate rounded text-sm text-teal-400"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground/90">Year</label>
            <input
              type="number"
              value={editYear}
              onChange={e => setEditYear(e.target.value)}
              className="w-full px-2 py-1 bg-silicon-slate border border-silicon-slate rounded text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground/90">Source</label>
          <input
            type="text"
            value={editSource}
            onChange={e => setEditSource(e.target.value)}
            className="w-full px-2 py-1 bg-silicon-slate border border-silicon-slate rounded text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground/90">Notes</label>
          <input
            type="text"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            className="w-full px-2 py-1 bg-silicon-slate border border-silicon-slate rounded text-sm"
          />
        </div>
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1 text-green-400 hover:text-green-300"
            title="Save"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          </button>
          <button onClick={handleCancel} className="p-1 text-muted-foreground hover:text-foreground" title="Cancel">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 bg-silicon-slate/70 rounded-lg border border-silicon-slate/50 group relative">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {b.benchmark_type?.replace(/_/g, ' ')}
      </div>
      <div className="text-lg font-semibold text-teal-400 mt-0.5">
        {b.benchmark_type === 'avg_close_rate'
          ? `${(parseFloat(b.value) * 100).toFixed(1)}%`
          : formatCurrency(parseFloat(b.value))}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {b.company_size_range} emp · {b.source} ({b.year})
      </div>
      {b.notes && (
        <div className="text-xs text-muted-foreground mt-1 truncate" title={b.notes}>{b.notes}</div>
      )}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="p-1 text-muted-foreground/80 hover:text-blue-400 transition-colors" title="Edit">
          <Pencil size={12} />
        </button>
        <button onClick={() => onDelete(b.id)} className="p-1 text-muted-foreground/80 hover:text-red-400 transition-colors" title="Delete">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function AddBenchmarkForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    industry: '',
    company_size_range: '11-50',
    benchmark_type: 'avg_hourly_wage',
    value: '',
    source: 'BLS / Industry Report',
    year: String(new Date().getFullYear()),
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.industry || !form.value) return
    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch('/api/admin/value-evidence/benchmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          value: parseFloat(form.value),
          year: parseInt(form.year),
          notes: form.notes || null,
        }),
      })

      if (res.ok) {
        onCreated()
      }
    } catch (error) {
      console.error('Create benchmark error:', error)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-2 py-1.5 bg-silicon-slate border border-silicon-slate rounded text-sm'

  return (
    <form onSubmit={handleSubmit} className="bg-silicon-slate/50 border border-teal-500/30 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-teal-300">Add Benchmark</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground/90 uppercase">Industry</label>
          <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className={inputCls} required>
            <option value="">Select…</option>
            {INDUSTRY_SLUGS.map(s => (
              <option key={s} value={s}>{getIndustryDisplayName(s)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground/90 uppercase">Size Range</label>
          <select value={form.company_size_range} onChange={e => setForm(f => ({ ...f, company_size_range: e.target.value }))} className={inputCls}>
            {SIZE_RANGES.map(s => <option key={s} value={s}>{s} emp</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground/90 uppercase">Benchmark Type</label>
          <select value={form.benchmark_type} onChange={e => setForm(f => ({ ...f, benchmark_type: e.target.value }))} className={inputCls}>
            {BENCHMARK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground/90 uppercase">Value</label>
          <input type="number" step="any" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputCls} required placeholder="e.g. 45.00" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground/90 uppercase">Source</label>
          <input type="text" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={inputCls} required />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground/90 uppercase">Year</label>
          <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={inputCls} required />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground/90 uppercase">Notes (optional)</label>
        <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Optional context" />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.industry || !form.value}
          className="px-4 py-1.5 bg-teal-600/30 border border-teal-500/50 rounded-lg text-teal-300 hover:bg-teal-600/50 disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>
    </form>
  )
}

function BenchmarksTab({ pageRefreshNonce }: { pageRefreshNonce: number }) {
  const [benchmarks, setBenchmarks] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [industryFilter, setIndustryFilter] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

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
  }, [fetchBenchmarks, pageRefreshNonce])

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this benchmark? This cannot be undone.')) return
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch(`/api/admin/value-evidence/benchmarks?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        await fetchBenchmarks()
      }
    } catch (error) {
      console.error('Delete benchmark error:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
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
          className="px-3 py-1.5 bg-silicon-slate border border-silicon-slate rounded-lg text-sm"
        >
          <option value="">All industries</option>
          {industries.map(ind => (
            <option key={ind} value={ind}>{getIndustryDisplayName(ind)}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="px-4 py-1.5 bg-teal-600/30 border border-teal-500/50 rounded-lg text-teal-300 hover:bg-teal-600/50 flex items-center gap-2 text-sm"
        >
          <Plus size={14} />
          Add Benchmark
        </button>
        <button onClick={fetchBenchmarks} className="p-1.5 bg-silicon-slate/80 rounded-lg hover:bg-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      {showAddForm && (
        <AddBenchmarkForm
          onCreated={() => { setShowAddForm(false); fetchBenchmarks() }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="space-y-6">
        {industries.map(industry => {
          const list = grouped[industry] || []
          if (list.length === 0) return null
          return (
            <div key={industry} className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-5">
              <h3 className="text-lg font-medium mb-4 text-teal-300">
                {industry === '_default' ? 'Default (fallback)' : getIndustryDisplayName(industry)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((b: any) => (
                  <BenchmarkCard key={b.id} b={b} onUpdate={fetchBenchmarks} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )
        })}

        {benchmarks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">No benchmarks yet</p>
            <p className="text-sm mt-1">Click &quot;Add Benchmark&quot; above or seed data via scripts.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Calculations Tab
// ============================================================================

function CalculationCard({ calc, onUpdate, onDelete }: {
  calc: any
  onUpdate: () => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [editValue, setEditValue] = useState(String(calc.annual_value))
  const [editConfidence, setEditConfidence] = useState(calc.confidence_level || 'medium')
  const [evidence, setEvidence] = useState<any[] | null>(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)

  const Icon = METHOD_ICONS[calc.calculation_method] || DollarSign
  const formulaInputs = calc.formula_inputs || {}
  const inputEntries = Object.entries(formulaInputs).filter(([, v]) => v != null)

  const handleSave = async () => {
    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch('/api/admin/value-evidence/calculations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: calc.id,
          annual_value: parseFloat(editValue),
          confidence_level: editConfidence,
        }),
      })

      if (res.ok) {
        setEditing(false)
        onUpdate()
      }
    } catch (error) {
      console.error('Save calculation error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(String(calc.annual_value))
    setEditConfidence(calc.confidence_level || 'medium')
    setEditing(false)
  }

  const toggleExpanded = async () => {
    const willExpand = !expanded
    setExpanded(willExpand)
    if (willExpand && evidence === null && calc.evidence_count > 0) {
      setEvidenceLoading(true)
      try {
        const session = await getCurrentSession()
        if (!session?.access_token) return
        const ppId = calc.pain_point_category_id || calc.pain_point_categories?.id
        if (!ppId) return
        const res = await fetch(`/api/admin/value-evidence/pain-points/${ppId}/evidence`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setEvidence(data.evidence || [])
        }
      } catch (err) {
        console.error('Evidence fetch error:', err)
      } finally {
        setEvidenceLoading(false)
      }
    }
  }

  return (
    <motion.div
      key={calc.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-silicon-slate/50 border border-silicon-slate rounded-xl overflow-hidden"
    >
      <button
        onClick={toggleExpanded}
        className="w-full p-4 text-left hover:bg-silicon-slate/70 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded bg-green-600/20 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {(calc.pain_point_categories as any)?.display_name || 'Unknown'}
                </span>
                {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </div>
              <div className="text-sm text-muted-foreground">
                {getIndustryDisplayName(calc.industry)} · {calc.company_size_range} emp
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono" title={calc.formula_expression}>
                {calc.formula_expression?.slice(0, 80)}{calc.formula_expression?.length > 80 ? '…' : ''}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0" onClick={e => e.stopPropagation()}>
            {editing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">$/yr</span>
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-28 px-2 py-1 bg-silicon-slate border border-silicon-slate rounded text-sm text-right text-green-400"
                  />
                </div>
                <select
                  value={editConfidence}
                  onChange={e => setEditConfidence(e.target.value)}
                  className="w-full px-2 py-1 bg-silicon-slate border border-silicon-slate rounded text-xs"
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-1 text-green-400 hover:text-green-300"
                    title="Save"
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                  <button onClick={handleCancel} className="p-1 text-muted-foreground hover:text-foreground" title="Cancel">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-green-400 font-semibold">
                  {formatCurrency(parseFloat(calc.annual_value))}/yr
                </div>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_COLORS[calc.confidence_level] || ''}`}>
                    {calc.confidence_level}
                  </span>
                  <span className={`text-xs ${calc.evidence_count > 0 ? 'text-radiant-gold' : 'text-muted-foreground'}`}>
                    {calc.evidence_count} evidence
                  </span>
                </div>
                {calc.generated_by === 'ai' && (
                  <div className="text-[10px] text-purple-300 mt-0.5 text-right">evidence-adjusted</div>
                )}
                <div className="flex items-center gap-1 justify-end mt-1.5">
                  <button onClick={() => setEditing(true)} className="p-1 text-muted-foreground/80 hover:text-blue-400 transition-colors" title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => onDelete(calc.id)} className="p-1 text-muted-foreground/80 hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-silicon-slate"
          >
            <div className="p-4 space-y-4">
              {calc.formula_expression && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Formula</h4>
                  <p className="text-sm font-mono text-foreground bg-silicon-slate/70 rounded-lg p-3 break-all">
                    {calc.formula_expression}
                  </p>
                </div>
              )}

              {inputEntries.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Inputs</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {inputEntries.map(([key, val]) => (
                      <div key={key} className="p-2 bg-silicon-slate/70 rounded-lg">
                        <div className="text-xs text-muted-foreground/90 capitalize">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-foreground font-medium">
                          {typeof val === 'number' ? val.toLocaleString() : String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/90">
                <span>Method: <span className="text-muted-foreground capitalize">{calc.calculation_method?.replace(/_/g, ' ')}</span></span>
                <span>Generated by: <span className="text-muted-foreground">{calc.generated_by || 'unknown'}</span></span>
                {calc.benchmark_ids?.length > 0 && (
                  <span>Benchmarks used: <span className="text-muted-foreground">{calc.benchmark_ids.length}</span></span>
                )}
                {calc.created_at && (
                  <span>Created: <span className="text-muted-foreground">{new Date(calc.created_at).toLocaleDateString()}</span></span>
                )}
              </div>

              {/* Evidence section */}
              {calc.evidence_count > 0 && (
                <div className="border-t border-silicon-slate pt-3 space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={12} />
                    Supporting Evidence ({calc.evidence_count})
                  </h4>
                  {evidenceLoading && (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/90">
                      <RefreshCw size={12} className="animate-spin" /> Loading evidence…
                    </div>
                  )}
                  {evidence && evidence.length === 0 && (
                    <p className="text-xs text-muted-foreground/80 py-1">No evidence items found.</p>
                  )}
                  {evidence && evidence.map((ev: any) => (
                    <div key={ev.id} className="p-2.5 bg-silicon-slate/70 rounded-lg space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/90">
                        <span className="px-1.5 py-0.5 bg-purple-600/20 rounded text-purple-300 capitalize">
                          {ev.source_type?.replace(/_/g, ' ')}
                        </span>
                        {ev.industry && (
                          <span className="px-1.5 py-0.5 bg-blue-600/20 rounded text-blue-300">
                            {ev.industry}
                          </span>
                        )}
                        {ev.confidence_score != null && (
                          <span className="text-radiant-gold">
                            {Math.round(ev.confidence_score * 100)}% confidence
                          </span>
                        )}
                        {ev.monetary_indicator != null && parseFloat(ev.monetary_indicator) > 0 && (
                          <span className="text-green-400 font-medium">
                            {formatCurrency(parseFloat(ev.monetary_indicator))}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">
                        &ldquo;{ev.source_excerpt}&rdquo;
                      </p>
                      {ev.monetary_context && (
                        <p className="text-[10px] text-muted-foreground/80 italic">Cost context: {ev.monetary_context}</p>
                      )}
                      <div className="text-[10px] text-muted-foreground/70">
                        {ev.extracted_by && <span>Extracted by: {ev.extracted_by}</span>}
                        {ev.created_at && <span className="ml-2">{new Date(ev.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {calc.evidence_count === 0 && (
                <div className="border-t border-silicon-slate pt-3">
                  <p className="text-xs text-muted-foreground/80">No evidence linked to this calculation yet. Run the Social Listening workflow or click Recalculate to link existing evidence.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function CalculationsTab({ pageRefreshNonce }: { pageRefreshNonce: number }) {
  const [calculations, setCalculations] = useState<any[]>([])
  const [painPoints, setPainPoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [industryFilter, setIndustryFilter] = useState('')
  const [painPointFilter, setPainPointFilter] = useState('')
  const [calcPage, setCalcPage] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState<string | null>(null)

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
  }, [fetchCalculations, pageRefreshNonce])

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

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this calculation? It will be deactivated and hidden from lists.')) return
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch(`/api/admin/value-evidence/calculations?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        await fetchCalculations()
      }
    } catch (error) {
      console.error('Delete calculation error:', error)
    }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    setRecalcResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const body: Record<string, string> = {}
      if (painPointFilter) body.pain_point_category_id = painPointFilter
      if (industryFilter) body.industry = industryFilter

      const res = await fetch('/api/admin/value-evidence/calculations/recalculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        setRecalcResult(
          `Updated ${data.calculationsUpdated} calculations across ${data.categoriesProcessed} categories` +
          (data.calculationsRecalculated > 0
            ? `. ${data.calculationsRecalculated} recalculated with evidence-based values.`
            : '.')
        )
        await fetchCalculations()
      } else {
        setRecalcResult('Recalculation failed. Please try again.')
      }
    } catch (error) {
      console.error('Recalculate error:', error)
      setRecalcResult('Recalculation failed. Please try again.')
    } finally {
      setRecalculating(false)
    }
  }

  useEffect(() => { setCalcPage(1) }, [industryFilter, painPointFilter])

  const calcTotalPages = Math.max(1, Math.ceil(calculations.length / PAGE_SIZE))
  const calcPageItems = calculations.slice((calcPage - 1) * PAGE_SIZE, calcPage * PAGE_SIZE)
  const industries = [...new Set(calculations.map((c: any) => c.industry).filter(Boolean))].sort()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Value Calculations ({calculations.length})</h2>
        <select
          value={industryFilter}
          onChange={e => setIndustryFilter(e.target.value)}
          className="px-3 py-1.5 bg-silicon-slate border border-silicon-slate rounded-lg text-sm"
        >
          <option value="">All industries</option>
          {industries.map(ind => (
            <option key={ind} value={ind}>{getIndustryDisplayName(ind)}</option>
          ))}
          {industries.length === 0 && INDUSTRY_SLUGS.map(ind => (
            <option key={ind} value={ind}>{getIndustryDisplayName(ind)}</option>
          ))}
        </select>
        <select
          value={painPointFilter}
          onChange={e => setPainPointFilter(e.target.value)}
          className="px-3 py-1.5 bg-silicon-slate border border-silicon-slate rounded-lg text-sm"
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
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-1.5 bg-purple-600/30 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-600/50 disabled:opacity-50 flex items-center gap-2"
          title="Re-link evidence and recalculate confidence levels and values"
        >
          {recalculating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
          Recalculate
        </button>
        <button onClick={fetchCalculations} className="p-1.5 bg-silicon-slate/80 rounded-lg hover:bg-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      {recalcResult && (
        <div className="px-4 py-2.5 bg-purple-900/30 border border-purple-500/30 rounded-lg text-sm text-purple-200 flex items-center justify-between">
          <span>{recalcResult}</span>
          <button onClick={() => setRecalcResult(null)} className="text-purple-400 hover:text-purple-200 ml-3">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {calcPageItems.map(calc => (
          <CalculationCard
            key={calc.id}
            calc={calc}
            onUpdate={fetchCalculations}
            onDelete={handleDelete}
          />
        ))}

        <Pagination
          page={calcPage}
          totalPages={calcTotalPages}
          total={calculations.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCalcPage}
        />

        {calculations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
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

function ReportsTab({ pageRefreshNonce }: { pageRefreshNonce: number }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [reportPage, setReportPage] = useState(1)
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [reportDetail, setReportDetail] = useState<{ report: any; contact: any } | null>(null)

  // Generate for Contact state
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [contacts, setContacts] = useState<{ id: number; name: string; email: string; company: string | null }[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateToast, setGenerateToast] = useState<{
    contactName: string
    company?: string
    totalAnnualValue: number
    reportId: string
    contactId: number
  } | null>(null)

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
  }, [fetchReports, pageRefreshNonce])

  useEffect(() => { setReportPage(1) }, [typeFilter])

  const reportTotalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE))
  const reportPageItems = reports.slice((reportPage - 1) * PAGE_SIZE, reportPage * PAGE_SIZE)

  const fetchContacts = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      const res = await fetch('/api/admin/contact-submissions?limit=200', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setContacts(data.submissions || data.contacts || [])
      }
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    if (showContactPicker && contacts.length === 0) {
      fetchContacts()
    }
  }, [showContactPicker, contacts.length, fetchContacts])

  const handleGenerate = async (contactId: number, contactName: string, company?: string) => {
    setGenerating(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch('/api/admin/value-evidence/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contact_submission_id: contactId, report_type: 'client_facing' }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Generation failed')
      }

      const data = await res.json()
      const report = data.report
      setGenerateToast({
        contactName,
        company,
        totalAnnualValue: report.totalAnnualValue ?? 0,
        reportId: report.id,
        contactId,
      })
      setShowContactPicker(false)
      setContactSearch('')
      fetchReports()
    } catch (err) {
      console.error('Generate error:', err)
    } finally {
      setGenerating(false)
    }
  }

  const filteredContacts = contactSearch
    ? contacts.filter(
        c =>
          c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
          c.company?.toLowerCase().includes(contactSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(contactSearch.toLowerCase())
      )
    : contacts.slice(0, 20)

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
        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
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
          className="px-3 py-1.5 bg-silicon-slate border border-silicon-slate rounded-lg text-sm"
        >
          <option value="">All types</option>
          <option value="internal_audit">Internal audit</option>
          <option value="client_facing">Client facing</option>
        </select>
        <button onClick={fetchReports} className="p-1.5 bg-silicon-slate/80 rounded-lg hover:bg-gray-600">
          <RefreshCw size={16} />
        </button>
        <button
          onClick={() => setShowContactPicker(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm hover:bg-emerald-600/30 transition-colors"
        >
          <Plus size={14} />
          Generate for Contact
        </button>
      </div>

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Generate Report for Contact</h3>
              <button
                onClick={() => { setShowContactPicker(false); setContactSearch('') }}
                className="p-1 text-gray-400 hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No contacts found</p>
              ) : (
                filteredContacts.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleGenerate(c.id, c.name || 'Unknown', c.company || undefined)}
                    disabled={generating}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <div className="text-sm font-medium text-white">{c.name || 'Unknown'}</div>
                    <div className="text-xs text-gray-400">
                      {c.email}{c.company ? ` · ${c.company}` : ''}
                    </div>
                  </button>
                ))
              )}
            </div>
            {generating && (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <RefreshCw size={14} className="animate-spin" />
                Generating report...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate Toast */}
      {generateToast && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 border-t border-emerald-500/30 backdrop-blur-sm px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  Report generated for {generateToast.contactName}
                  {generateToast.company ? ` (${generateToast.company})` : ''}
                </p>
                <p className="text-xs text-gray-400">
                  {formatCurrency(generateToast.totalAnnualValue)}/yr
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href={buildLinkWithReturn(`/admin/value-evidence/reports/${generateToast.reportId}`, '/admin/value-evidence')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-silicon-slate/80 border border-silicon-slate rounded-lg text-sm text-foreground hover:bg-silicon-slate transition-colors"
              >
                <ExternalLink size={14} />
                View Report
              </Link>
              <Link
                href={`/admin/reports/gamma?type=value_quantification&contactId=${generateToast.contactId}&valueReportId=${generateToast.reportId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
              >
                Generate Gamma Deck
              </Link>
              <button onClick={() => setGenerateToast(null)} className="p-1 text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {reportPageItems.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => openReport(r.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                selectedReport?.id === r.id
                  ? 'bg-green-900/20 border-green-500/50'
                  : 'bg-silicon-slate/50 border-silicon-slate hover:border-silicon-slate'
              }`}
            >
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {r.industry?.replace(/_/g, ' ')} · {r.company_size_range}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-green-400 font-semibold">
                  {formatCurrency(parseFloat(r.total_annual_value))}/yr
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-silicon-slate/80 rounded">{r.report_type}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </motion.div>
          ))}

          <Pagination
            page={reportPage}
            totalPages={reportTotalPages}
            total={reports.length}
            pageSize={PAGE_SIZE}
            onPageChange={setReportPage}
          />

          {reports.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No reports yet</p>
              <p className="text-sm mt-1">Generate reports from the Outreach queue or sales walkthrough when viewing a lead.</p>
            </div>
          )}
        </div>

        {selectedReport && reportDetail && (
          <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl max-h-[65vh] overflow-y-auto">
            {/* Header */}
            <div className="p-5 border-b border-silicon-slate/80">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedReport.title}</h3>
                  {reportDetail.contact && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {reportDetail.contact.name} · {reportDetail.contact.company} · {reportDetail.contact.industry}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-emerald-400 font-bold text-lg">
                      {formatCurrency(parseFloat(selectedReport.total_annual_value))}/yr
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-silicon-slate/80 rounded capitalize">
                      {selectedReport.report_type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <Link
                  href={buildLinkWithReturn(`/admin/value-evidence/reports/${selectedReport.id}`, '/admin/value-evidence')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-sm hover:bg-emerald-600/30 transition-colors whitespace-nowrap"
                >
                  <ExternalLink size={14} />
                  Full Report
                </Link>
              </div>
            </div>

            {/* Rendered markdown (without Cost of Doing Nothing) */}
            <div className="p-5">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={reportMarkdownComponents}
              >
                {stripDuplicateCostSection(selectedReport.summary_markdown)}
              </ReactMarkdown>
            </div>

            {/* Value statements - structured cards */}
            {(selectedReport.value_statements as Record<string, unknown>[])?.length > 0 && (
              <div className="px-5 pb-5">
                <h4 className="font-medium text-amber-300 mb-3 flex items-center gap-2">
                  <DollarSign size={16} />
                  Opportunity Areas ({(selectedReport.value_statements as Record<string, unknown>[]).length})
                </h4>
                <div className="space-y-2">
                  {(selectedReport.value_statements as Record<string, unknown>[]).map((vs, i) => {
                    const s = normalizeStatementForTab(vs)
                    const Icon = METHOD_ICONS[s.calculationMethod ?? ''] || DollarSign
                    return (
                      <div key={i} className="p-3 bg-silicon-slate/70/50 rounded-lg border border-silicon-slate/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded bg-emerald-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Icon size={14} className="text-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground text-sm">
                                {i + 1}. {s.painPoint}
                              </div>
                              {s.formulaReadable && (
                                <div className="text-xs text-muted-foreground mt-0.5 truncate" title={s.formulaReadable}>
                                  {s.formulaReadable}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-emerald-400 font-semibold text-sm">
                              {formatCurrency(s.annualValue)}/yr
                            </div>
                            {s.confidence && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_COLORS[s.confidence] || 'text-muted-foreground bg-silicon-slate/50'}`}>
                                {s.confidence}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
