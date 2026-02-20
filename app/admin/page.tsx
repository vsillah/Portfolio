'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Send, DollarSign, TrendingUp, FolderKanban, BarChart3, Settings, RefreshCw } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import AdminPieChart from '@/components/admin/AdminPieChart'
import AdminBarChart from '@/components/admin/AdminBarChart'

export default function AdminDashboard() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminDashboardContent />
    </ProtectedRoute>
  )
}

// --- Feed types (minimal shapes from APIs) ---
type FunnelStats = { total: number; contacted: number; replied: number; booked: number }
type OutreachDashboard = {
  funnel?: FunnelStats
  funnelByTemperature?: { cold?: FunnelStats; warm?: FunnelStats }
  queueStats?: { total: number; draft: number; approved?: number; sent: number; replied: number; bounced?: number }
  channelStats?: { email?: { total: number }; linkedin?: { total: number } }
  recentActivity?: Array<{
    channel?: string
    subject?: string
    status?: string
    contact_submissions?: { name?: string } | null
    sent_at?: string | null
    replied_at?: string | null
  }>
}
type ValueEvidenceDashboard = {
  overview?: {
    totalReports?: number
    totalEvidence?: number
    totalCalculations?: number
    totalPainPoints?: number
    totalMarketIntel?: number
  }
}
type ValueReportsRes = { reports?: Array<{ title?: string; industry?: string; company_size_range?: string; total_annual_value?: number; created_at?: string }> }
type SalesRes = { stats?: { total_audits: number; pending_follow_up: number; converted: number; high_urgency: number }; audits?: Array<{ id: string; contact_submissions?: { name?: string } | null; urgency_score?: number; opportunity_score?: number }> }
type CampaignsRes = { data?: Array<{ id: string; name?: string; status?: string; enrollment_count?: number; created_at?: string }> }
type ClientProjectsRes = { projects?: Array<{ client_name?: string; project_status?: string; current_phase?: string; created_at?: string }>; stats?: unknown }
type MeetingTasksRes = { tasks?: Array<{ id: string; title?: string; status?: string; due_date?: string | null; client_name?: string }> }
type GuaranteesRes = { data?: Array<{ id: string; status?: string; client_email?: string; created_at?: string; guarantee_templates?: { name?: string } }> }
type ChatEvalStats = { overview?: { total_sessions?: number; evaluated_sessions?: number; success_rate?: number } }
type ChatEvalSessionsRes = { sessions?: Array<{ session_id?: string; visitor_email?: string; created_at?: string }> }
type AnalyticsStats = {
  totalSessions?: number
  totalPageViews?: number
  totalClicks?: number
  totalFormSubmits?: number
  eventsByType?: Record<string, number>
}

function AdminDashboardContent() {
  const [pipeline, setPipeline] = useState<{ outreach: OutreachDashboard | null; valueEvidence: ValueEvidenceDashboard | null; reports: ValueReportsRes['reports'] | null }>({ outreach: null, valueEvidence: null, reports: null })
  const [sales, setSales] = useState<{ stats: SalesRes['stats'] | null; campaigns: CampaignsRes['data'] | null }>({ stats: null, campaigns: null })
  const [postSale, setPostSale] = useState<{ projects: ClientProjectsRes['projects'] | null; tasks: MeetingTasksRes['tasks'] | null; guarantees: GuaranteesRes['data'] | null }>({ projects: null, tasks: null, guarantees: null })
  const [quality, setQuality] = useState<{ chatStats: ChatEvalStats | null; chatSessions: ChatEvalSessionsRes['sessions'] | null; analytics: AnalyticsStats | null }>({ chatStats: null, chatSessions: null, analytics: null })
  const [pipelineError, setPipelineError] = useState(false)
  const [salesError, setSalesError] = useState(false)
  const [postSaleError, setPostSaleError] = useState(false)
  const [qualityError, setQualityError] = useState(false)

  const fetchPipeline = useCallback(async () => {
    setPipelineError(false)
    const session = await getCurrentSession()
    if (!session?.access_token) {
      setPipelineError(true)
      return
    }
    const headers = { Authorization: `Bearer ${session.access_token}` }
    Promise.all([
      fetch('/api/admin/outreach/dashboard', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/admin/value-evidence/dashboard', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/admin/value-evidence/reports?limit=5', { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([outreach, valueEvidence, reportsRes]) => {
        setPipeline({
          outreach: outreach ?? null,
          valueEvidence: valueEvidence ?? null,
          reports: (reportsRes as ValueReportsRes)?.reports ?? null,
        })
      })
      .catch(() => setPipelineError(true))
  }, [])

  const fetchSales = useCallback(async () => {
    setSalesError(false)
    const session = await getCurrentSession()
    if (!session?.access_token) {
      setSalesError(true)
      return
    }
    const headers = { Authorization: `Bearer ${session.access_token}` }
    Promise.all([
      fetch('/api/admin/sales', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/admin/campaigns?limit=5', { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([salesRes, campaignsRes]) => {
        setSales({
          stats: (salesRes as SalesRes)?.stats ?? null,
          campaigns: (campaignsRes as CampaignsRes)?.data ?? null,
        })
      })
      .catch(() => setSalesError(true))
  }, [])

  const fetchPostSale = useCallback(async () => {
    setPostSaleError(false)
    const session = await getCurrentSession()
    if (!session?.access_token) {
      setPostSaleError(true)
      return
    }
    const headers = { Authorization: `Bearer ${session.access_token}` }
    Promise.all([
      fetch('/api/admin/client-projects?limit=5', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/meeting-action-tasks', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/admin/guarantees?limit=3', { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([projectsRes, tasksRes, guaranteesRes]) => {
        const tasks = (tasksRes as MeetingTasksRes)?.tasks ?? []
        setPostSale({
          projects: (projectsRes as ClientProjectsRes)?.projects ?? null,
          tasks: Array.isArray(tasks) ? tasks.slice(0, 5) : null,
          guarantees: (guaranteesRes as GuaranteesRes)?.data ?? null,
        })
      })
      .catch(() => setPostSaleError(true))
  }, [])

  const fetchQuality = useCallback(async () => {
    setQualityError(false)
    const session = await getCurrentSession()
    if (!session?.access_token) {
      setQualityError(true)
      return
    }
    const headers = { Authorization: `Bearer ${session.access_token}` }
    Promise.all([
      fetch('/api/admin/chat-eval/stats?days=7', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/admin/chat-eval?limit=5', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/analytics/stats?days=7', { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([chatStats, chatSessionsRes, analytics]) => {
        const sess = (chatSessionsRes as ChatEvalSessionsRes)?.sessions ?? null
        setQuality({
          chatStats: chatStats ?? null,
          chatSessions: sess ?? null,
          analytics: analytics ?? null,
        })
      })
      .catch(() => setQualityError(true))
  }, [])

  useEffect(() => { fetchPipeline() }, [fetchPipeline])
  useEffect(() => { fetchSales() }, [fetchSales])
  useEffect(() => { fetchPostSale() }, [fetchPostSale])
  useEffect(() => { fetchQuality() }, [fetchQuality])

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[{ label: 'Admin Dashboard' }]} />
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Admin Dashboard</h1>
          <p className="text-platinum-white/80 text-sm">Snapshot by category — use the sidebar or links below for details.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline: Lead Pipeline */}
          <CategoryCard
            title="Lead Pipeline"
            icon={<Send size={24} />}
            href="/admin/outreach"
            linkLabel="View Lead Pipeline"
            error={pipelineError}
            onRetry={fetchPipeline}
          >
            {pipelineError ? (
              <FeedError onRetry={fetchPipeline} />
            ) : pipeline.outreach ? (
              <>
                <div className="flex flex-wrap gap-3 text-sm text-platinum-white/80 mb-3">
                  <span>Leads: {pipeline.outreach.funnel?.total ?? 0}</span>
                  <span>Contacted: {pipeline.outreach.funnel?.contacted ?? 0}</span>
                  <span>Replied: {pipeline.outreach.funnel?.replied ?? 0}</span>
                  <span>Queue: {pipeline.outreach.queueStats?.sent ?? 0} sent / {pipeline.outreach.queueStats?.replied ?? 0} replied</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <AdminPieChart
                    data={[
                      { name: 'Cold', value: pipeline.outreach.funnelByTemperature?.cold?.total ?? 0 },
                      { name: 'Warm', value: pipeline.outreach.funnelByTemperature?.warm?.total ?? 0 },
                    ].filter((d) => d.value > 0)}
                    ariaLabel="Lead temperature breakdown: cold vs warm"
                    height={120}
                    title="Cold vs Warm Leads"
                  />
                  <AdminBarChart
                    data={[
                      { name: 'Draft', value: pipeline.outreach.queueStats?.draft ?? 0 },
                      { name: 'Sent', value: pipeline.outreach.queueStats?.sent ?? 0 },
                      { name: 'Replied', value: pipeline.outreach.queueStats?.replied ?? 0 },
                    ].filter((d) => d.value > 0)}
                    ariaLabel="Outreach queue status breakdown"
                    height={120}
                    title="Queue Status"
                  />
                </div>
                <ul className="space-y-1.5 text-sm">
                  {(pipeline.outreach.recentActivity ?? []).slice(0, 5).map((a, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{a.contact_submissions?.name ?? a.subject ?? a.channel ?? '—'}</span>
                      <span className="text-platinum-white/60 shrink-0">{a.status}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-platinum-white/60">Loading…</p>
            )}
          </CategoryCard>

          {/* Pipeline: Value Evidence */}
          <CategoryCard
            title="Value Evidence"
            icon={<DollarSign size={24} />}
            href="/admin/value-evidence"
            linkLabel="View Value Evidence"
            error={pipelineError}
            onRetry={fetchPipeline}
          >
            {pipelineError ? (
              <FeedError onRetry={fetchPipeline} />
            ) : pipeline.valueEvidence != null || pipeline.reports != null ? (
              <>
                <div className="flex flex-wrap gap-3 text-sm text-platinum-white/80 mb-3">
                  <span>Reports: {pipeline.valueEvidence?.overview?.totalReports ?? 0}</span>
                  <span>Evidence: {pipeline.valueEvidence?.overview?.totalEvidence ?? 0}</span>
                  <span>Calculations: {pipeline.valueEvidence?.overview?.totalCalculations ?? 0}</span>
                </div>
                <div className="mb-3">
                  <AdminPieChart
                    data={[
                      { name: 'Reports', value: pipeline.valueEvidence?.overview?.totalReports ?? 0 },
                      { name: 'Evidence', value: pipeline.valueEvidence?.overview?.totalEvidence ?? 0 },
                      { name: 'Calculations', value: pipeline.valueEvidence?.overview?.totalCalculations ?? 0 },
                    ].filter((d) => d.value > 0)}
                    ariaLabel="Value evidence breakdown: reports, evidence, calculations"
                    height={120}
                    title="Value Evidence Breakdown"
                  />
                </div>
                <ul className="space-y-1.5 text-sm">
                  {(pipeline.reports ?? []).slice(0, 5).map((r, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{r.title ?? r.industry ?? '—'}</span>
                      {r.total_annual_value != null && <span className="text-platinum-white/60 shrink-0">${(r.total_annual_value / 1000).toFixed(0)}k</span>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-platinum-white/60">Loading…</p>
            )}
          </CategoryCard>

          {/* Sales */}
          <CategoryCard
            title="Sales"
            icon={<TrendingUp size={24} />}
            href="/admin/sales"
            linkLabel="Sales Dashboard"
            secondaryLinks={[{ label: 'Campaigns', href: '/admin/campaigns' }]}
            error={salesError}
            onRetry={fetchSales}
          >
            {salesError ? (
              <FeedError onRetry={fetchSales} />
            ) : sales.stats != null || (sales.campaigns && sales.campaigns.length > 0) ? (
              <>
                <div className="flex flex-wrap gap-3 text-sm text-platinum-white/80 mb-3">
                  <span>Audits: {sales.stats?.total_audits ?? 0}</span>
                  <span>Pending follow-up: {sales.stats?.pending_follow_up ?? 0}</span>
                  <span>Converted: {sales.stats?.converted ?? 0}</span>
                  <span>High urgency: {sales.stats?.high_urgency ?? 0}</span>
                </div>
                <div className="mb-3">
                  <AdminBarChart
                    data={[
                      { name: 'Total', value: sales.stats?.total_audits ?? 0 },
                      { name: 'Pending', value: sales.stats?.pending_follow_up ?? 0 },
                      { name: 'Converted', value: sales.stats?.converted ?? 0 },
                      { name: 'High urgency', value: sales.stats?.high_urgency ?? 0 },
                    ].filter((d) => d.value > 0)}
                    ariaLabel="Sales audits by status"
                    height={120}
                    title="Sales Pipeline"
                  />
                </div>
                <ul className="space-y-1.5 text-sm">
                  {(sales.campaigns ?? []).slice(0, 5).map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="truncate">{c.name ?? c.id}</span>
                      <span className="text-platinum-white/60 shrink-0">{c.enrollment_count ?? 0} enrollments</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-platinum-white/60">Loading…</p>
            )}
          </CategoryCard>

          {/* Post-sale */}
          <CategoryCard
            title="Post-sale"
            icon={<FolderKanban size={24} />}
            href="/admin/client-projects"
            linkLabel="Client Projects"
            secondaryLinks={[
              { label: 'Meeting Tasks', href: '/admin/meeting-tasks' },
              { label: 'Guarantees', href: '/admin/guarantees' },
            ]}
            error={postSaleError}
            onRetry={fetchPostSale}
          >
            {postSaleError ? (
              <FeedError onRetry={fetchPostSale} />
            ) : postSale.projects != null || postSale.tasks != null || postSale.guarantees != null ? (
              <>
                <div className="space-y-2 mb-3">
                  <p className="text-sm font-medium text-platinum-white/90">Recent projects</p>
                  <ul className="space-y-1 text-sm text-platinum-white/80">
                    {(postSale.projects ?? []).slice(0, 5).map((p, i) => (
                      <li key={i} className="truncate">{p.client_name ?? p.project_status ?? '—'}</li>
                    ))}
                  </ul>
                </div>
                <div className="mb-3">
                  <AdminPieChart
                    data={[
                      { name: 'Projects', value: postSale.projects?.length ?? 0 },
                      { name: 'Pending tasks', value: Array.isArray(postSale.tasks) ? postSale.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length : 0 },
                      { name: 'Guarantees', value: postSale.guarantees?.length ?? 0 },
                    ].filter((d) => d.value > 0)}
                    ariaLabel="Post-sale breakdown: projects, pending tasks, guarantees"
                    height={120}
                    title="Post-sale Overview"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-platinum-white/70">
                  {Array.isArray(postSale.tasks) && <span>{postSale.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length} pending tasks</span>}
                  {(postSale.guarantees?.length ?? 0) > 0 && <span>{postSale.guarantees!.length} recent guarantees</span>}
                </div>
              </>
            ) : (
              <p className="text-sm text-platinum-white/60">Loading…</p>
            )}
          </CategoryCard>

          {/* Quality & insights */}
          <CategoryCard
            title="Quality & insights"
            icon={<BarChart3 size={24} />}
            href="/admin/chat-eval"
            linkLabel="Chat Eval"
            secondaryLinks={[
              { label: 'Analytics', href: '/admin/analytics' },
              { label: 'E2E Testing', href: '/admin/testing' },
            ]}
            error={qualityError}
            onRetry={fetchQuality}
          >
            {qualityError ? (
              <FeedError onRetry={fetchQuality} />
            ) : quality.chatStats != null || quality.analytics != null ? (
              <>
                <div className="flex flex-wrap gap-3 text-sm text-platinum-white/80 mb-3">
                  <span>Chat sessions (7d): {quality.chatStats?.overview?.total_sessions ?? 0}</span>
                  <span>Evaluated: {quality.chatStats?.overview?.evaluated_sessions ?? 0}</span>
                  <span>Success rate: {quality.chatStats?.overview?.success_rate ?? 0}%</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <AdminPieChart
                    data={[
                      { name: 'Evaluated', value: quality.chatStats?.overview?.evaluated_sessions ?? 0 },
                      { name: 'Not evaluated', value: Math.max(0, (quality.chatStats?.overview?.total_sessions ?? 0) - (quality.chatStats?.overview?.evaluated_sessions ?? 0)) },
                    ].filter((d) => d.value > 0)}
                    ariaLabel="Chat sessions: evaluated vs not evaluated"
                    height={120}
                    title="Chat Evaluation"
                  />
                  <AdminBarChart
                    data={[
                      { name: 'Sessions', value: quality.analytics?.totalSessions ?? 0 },
                      { name: 'Page views', value: quality.analytics?.totalPageViews ?? 0 },
                      { name: 'Clicks', value: quality.analytics?.totalClicks ?? 0 },
                      { name: 'Form submits', value: quality.analytics?.totalFormSubmits ?? 0 },
                    ].filter((d) => d.value > 0)}
                    ariaLabel="Analytics events by type (7 days)"
                    height={120}
                    title="Analytics (7d)"
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-platinum-white/70 mb-2">
                  <span>Analytics (7d): {quality.analytics?.totalSessions ?? 0} sessions</span>
                  <span>{quality.analytics?.totalPageViews ?? 0} page views</span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {(quality.chatSessions ?? []).slice(0, 5).map((s, i) => (
                    <li key={i} className="truncate text-platinum-white/80">{s?.visitor_email ?? s?.session_id ?? '—'}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-platinum-white/60">Loading…</p>
            )}
          </CategoryCard>

          {/* Configuration */}
          <CategoryCard
            title="Configuration"
            icon={<Settings size={24} />}
            href="/admin/content"
            linkLabel="Content Hub"
            secondaryLinks={[
              { label: 'User Management', href: '/admin/users' },
              { label: 'System Prompts', href: '/admin/prompts' },
            ]}
          >
            <p className="text-sm text-platinum-white/80">Content hub, users, and system prompts. Use the links below or the sidebar.</p>
          </CategoryCard>
        </div>
      </div>
    </div>
  )
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-platinum-white/70">Unable to load.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 text-sm font-medium text-radiant-gold hover:text-amber-400 transition-colors"
      >
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  )
}

function CategoryCard({
  title,
  icon,
  href,
  linkLabel,
  secondaryLinks,
  error,
  onRetry,
  children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  linkLabel: string
  secondaryLinks?: Array<{ label: string; href: string }>
  error?: boolean
  onRetry?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="p-5 rounded-xl border border-silicon-slate bg-silicon-slate/30 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-radiant-gold/20 flex items-center justify-center text-radiant-gold">
          {icon}
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex-1 min-h-[80px] mb-4">{children}</div>
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-silicon-slate">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-radiant-gold hover:text-amber-400 transition-colors"
        >
          {linkLabel}
          <ArrowRight size={14} />
        </Link>
        {secondaryLinks?.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="text-sm text-platinum-white/70 hover:text-foreground transition-colors"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
