/**
 * Funnel Analytics Library
 * Defines stage model, data fetching, and business logic for the sales funnel dashboard.
 *
 * Stage model maps the plumbing diagram to existing database tables:
 *   Opt-in       → contact_submissions (all records)
 *   Outreach     → outreach_queue (status = sent/replied/booked)
 *   Diagnostic   → diagnostic_audits (status = completed)
 *   Sales        → sales_sessions (all records)
 *   Proposal     → proposals (sent_at IS NOT NULL)
 *   Paid         → proposals (paid_at IS NOT NULL)
 *   Acquired     → client_projects (all records)
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  isWarmLeadSource,
  isColdLeadSource,
} from '@/lib/constants/lead-source'

// ============================================================================
// Types
// ============================================================================

export interface FunnelStageData {
  key: string
  label: string
  shortLabel: string
  count: number
  conversionFromPrevious: number | null
  conversionFromTop: number | null
  pipelineValue: number | null
  unattributed: number
  lostCount: number
}

export interface AttentionItem {
  type: 'overdue_followup' | 'stale_proposal' | 'conversion_drop' | 'viewed_not_accepted'
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  link: string
  timeContext?: string
}

export interface LossReasonBreakdown {
  reason: string
  label: string
  count: number
  percentage: number
}

export interface FunnelSummary {
  totalLeads: number
  totalPipelineValue: number
  totalClosedValue: number
  avgDealSize: number
  winLossRatio: string
  lossReasons: LossReasonBreakdown[]
  medianCycleTimeDays: number | null
}

export interface SelfBenchmarkDelta {
  current: number
  previous: number
  changePct: number | null
}

export interface SelfBenchmark {
  periodLabel: string
  previousPeriodLabel: string
  deltas: Record<string, SelfBenchmarkDelta>
}

export interface FunnelAnalyticsResponse {
  stages: FunnelStageData[]
  summary: FunnelSummary
  attentionItems: AttentionItem[]
  selfBenchmark: SelfBenchmark
}

// ============================================================================
// Stage Definitions
// ============================================================================

export const FUNNEL_STAGES = [
  { key: 'opt_in', label: 'Opt-in', shortLabel: 'Opt-in' },
  { key: 'outreach', label: 'Outreach', shortLabel: 'Outreach' },
  { key: 'diagnostic', label: 'Diagnostic', shortLabel: 'Diag.' },
  { key: 'sales', label: 'Sales Conversation', shortLabel: 'Sales' },
  { key: 'proposal', label: 'Proposal Sent', shortLabel: 'Proposal' },
  { key: 'paid', label: 'Paid', shortLabel: 'Paid' },
  { key: 'acquired', label: 'Client Acquired', shortLabel: 'Acquired' },
] as const

export const LOSS_REASONS = [
  { value: 'price', label: 'Price Too High' },
  { value: 'timing', label: 'Bad Timing' },
  { value: 'feature_gap', label: 'Feature Gap' },
  { value: 'competitor', label: 'Chose Competitor' },
  { value: 'no_budget', label: 'No Budget' },
  { value: 'no_need', label: 'No Need' },
  { value: 'ghosted', label: 'Ghosted' },
  { value: 'other', label: 'Other' },
] as const

// ============================================================================
// DB row shapes (for type safety on Supabase query results)
// ============================================================================

interface ContactRow { id: string; lead_source: string | null; created_at: string }
interface OutreachRow { id: string; contact_submission_id: string | null; created_at: string; status: string }
interface DiagnosticRow { id: string; contact_submission_id: string | null; session_id: string | null; status: string; created_at: string }
interface SessionRow { id: string; contact_submission_id: string | null; diagnostic_audit_id: string | null; outcome: string | null; funnel_stage: string; loss_reason: string | null; created_at: string; next_follow_up: string | null; client_name: string | null; client_email: string | null }
interface ProposalRow { id: string; sales_session_id: string | null; total_amount: number; status: string; sent_at: string | null; viewed_at: string | null; accepted_at: string | null; paid_at: string | null; created_at: string; client_name: string | null }
interface ProjectRow { id: string; contact_submission_id: string | null; status: string; total_budget: number | null; created_at: string }
interface OverdueRow { id: string; client_name: string | null; client_email: string | null; next_follow_up: string; outcome: string | null }

// ============================================================================
// Channel filter helpers
// ============================================================================

export type ChannelFilter = 'all' | 'warm' | 'cold'

function matchesChannel(leadSource: string | null, channel: ChannelFilter): boolean {
  if (channel === 'all') return true // filter === 'all' → no restriction on lead_source
  if (channel === 'warm') return isWarmLeadSource(leadSource)
  if (channel === 'cold') return isColdLeadSource(leadSource)
  return true
}

// ============================================================================
// Date range helpers
// ============================================================================

function getDateRanges(days: number) {
  const now = new Date()
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const previousStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000)
  return {
    currentStart: currentStart.toISOString(),
    currentEnd: now.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: currentStart.toISOString(),
  }
}

function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr < end
}

// ============================================================================
// Contact resolution for channel filtering
// ============================================================================

type LeadSourceMap = Map<string, string | null>

function buildLeadSourceMap(
  contacts: Array<{ id: string; lead_source: string | null }>
): LeadSourceMap {
  const m = new Map<string, string | null>()
  for (const c of contacts) m.set(c.id, c.lead_source)
  return m
}

// ============================================================================
// Self-benchmark delta helper
// ============================================================================

function calcDelta(current: number, previous: number): SelfBenchmarkDelta {
  if (previous === 0 && current === 0) return { current, previous, changePct: null }
  if (previous === 0) return { current, previous, changePct: 100 }
  return {
    current,
    previous,
    changePct: Math.round(((current - previous) / previous) * 1000) / 10,
  }
}

// ============================================================================
// Main fetch function
// ============================================================================

export async function fetchFunnelAnalytics(
  days: number = 30,
  channel: ChannelFilter = 'all'
): Promise<FunnelAnalyticsResponse> {
  const ranges = getDateRanges(days)
  const fetchStart = ranges.previousStart // widest range covers both periods

  // ── Parallel data fetch ────────────────────────────────────────────────
  const [
    contactsRes,
    outreachRes,
    diagnosticsRes,
    sessionsRes,
    proposalsRes,
    projectsRes,
    overdueRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('contact_submissions')
      .select('id, lead_source, created_at')
      .gte('created_at', fetchStart)
      .order('created_at', { ascending: false })
      .limit(5000),

    supabaseAdmin
      .from('outreach_queue')
      .select('id, contact_submission_id, created_at, status')
      .gte('created_at', fetchStart)
      .in('status', ['sent', 'replied', 'booked'])
      .limit(5000),

    supabaseAdmin
      .from('diagnostic_audits')
      .select('id, contact_submission_id, session_id, status, created_at')
      .gte('created_at', fetchStart)
      .eq('status', 'completed')
      .limit(5000),

    supabaseAdmin
      .from('sales_sessions')
      .select('id, contact_submission_id, diagnostic_audit_id, outcome, funnel_stage, loss_reason, created_at, next_follow_up, client_name, client_email')
      .gte('created_at', fetchStart)
      .limit(5000),

    supabaseAdmin
      .from('proposals')
      .select('id, sales_session_id, total_amount, status, sent_at, viewed_at, accepted_at, paid_at, created_at, client_name')
      .gte('created_at', fetchStart)
      .limit(5000),

    supabaseAdmin
      .from('client_projects')
      .select('id, contact_submission_id, status, total_budget, created_at')
      .gte('created_at', fetchStart)
      .limit(5000),

    // Attention: overdue follow-ups (any session with next_follow_up in the past)
    supabaseAdmin
      .from('sales_sessions')
      .select('id, client_name, client_email, next_follow_up, outcome')
      .lt('next_follow_up', new Date().toISOString())
      .neq('outcome', 'converted')
      .neq('outcome', 'lost')
      .limit(100),
  ])

  const contacts = (contactsRes.data || []) as ContactRow[]
  const outreach = (outreachRes.data || []) as OutreachRow[]
  const diagnostics = (diagnosticsRes.data || []) as DiagnosticRow[]
  const sessions = (sessionsRes.data || []) as SessionRow[]
  const proposals = (proposalsRes.data || []) as ProposalRow[]
  const projects = (projectsRes.data || []) as ProjectRow[]
  const overdueFollowups = (overdueRes.data || []) as OverdueRow[]

  const leadSourceMap = buildLeadSourceMap(contacts)

  // ── Period split + channel filter ─────────────────────────────────────

  function splitAndFilter<T extends { created_at: string; lead_source?: string | null; contact_submission_id?: string | null }>(
    records: T[]
  ): { current: T[]; previous: T[] } {
    const current: T[] = []
    const previous: T[] = []
    for (const r of records) {
      const ts = r.created_at
      if (!ts) continue

      // Channel filter
      if (channel !== 'all') {
        const ls =
          r.lead_source !== undefined
            ? r.lead_source
            : r.contact_submission_id
              ? leadSourceMap.get(r.contact_submission_id) ?? null
              : null
        // Include unattributed records (ls === null) unless we can prove they don't match
        if (ls !== null && !matchesChannel(ls, channel)) continue
      }

      if (inRange(ts, ranges.currentStart, ranges.currentEnd)) current.push(r)
      else if (inRange(ts, ranges.previousStart, ranges.previousEnd)) previous.push(r)
    }
    return { current, previous }
  }

  const cContacts = splitAndFilter(contacts)
  const cOutreach = splitAndFilter(outreach)
  const cDiagnostics = splitAndFilter(diagnostics)
  const cSessions = splitAndFilter(sessions)
  // Proposals don't have contact_submission_id; include all for v1
  const cProposals = {
    current: proposals.filter((p) => inRange(p.created_at, ranges.currentStart, ranges.currentEnd)),
    previous: proposals.filter((p) => inRange(p.created_at, ranges.previousStart, ranges.previousEnd)),
  }
  const cProjects = splitAndFilter(projects)

  // ── Stage counts ──────────────────────────────────────────────────────

  const curProposalsSent = cProposals.current.filter((p) => p.sent_at)
  const curProposalsPaid = cProposals.current.filter((p) => p.paid_at)
  const prevProposalsSent = cProposals.previous.filter((p) => p.sent_at)
  const prevProposalsPaid = cProposals.previous.filter((p) => p.paid_at)

  const stageCounts = [
    cContacts.current.length,
    cOutreach.current.length,
    cDiagnostics.current.length,
    cSessions.current.length,
    curProposalsSent.length,
    curProposalsPaid.length,
    cProjects.current.length,
  ]

  const prevStageCounts = [
    cContacts.previous.length,
    cOutreach.previous.length,
    cDiagnostics.previous.length,
    cSessions.previous.length,
    prevProposalsSent.length,
    prevProposalsPaid.length,
    cProjects.previous.length,
  ]

  // Unattributed counts (records without contact_submission_id)
  const countUnattr = (recs: Array<{ contact_submission_id?: string | null }>) =>
    recs.filter((r) => !r.contact_submission_id).length

  const stageUnattributed = [
    0, // contacts are the source themselves
    countUnattr(cOutreach.current),
    countUnattr(cDiagnostics.current),
    countUnattr(cSessions.current),
    0, // proposals link through sessions
    0,
    countUnattr(cProjects.current),
  ]

  // ── Dollar metrics ────────────────────────────────────────────────────

  const pipelineValue = cProposals.current
    .filter((p) => p.sent_at && !p.paid_at)
    .reduce((s, p) => s + (p.total_amount || 0), 0)

  const closedValue = curProposalsPaid.reduce((s, p) => s + (p.total_amount || 0), 0)

  const prevClosedValue = prevProposalsPaid.reduce((s, p) => s + (p.total_amount || 0), 0)

  // ── Lost / won breakdown ──────────────────────────────────────────────

  const lostSessions = cSessions.current.filter((s) => s.outcome === 'lost')
  const wonSessions = cSessions.current.filter((s) => s.outcome === 'converted')

  const lossReasonCounts: Record<string, number> = {}
  for (const s of lostSessions) {
    const reason = (s.loss_reason as string) || 'unspecified'
    lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1
  }
  const totalLost = lostSessions.length
  const lossReasons: LossReasonBreakdown[] = Object.entries(lossReasonCounts)
    .map(([reason, count]) => ({
      reason,
      label: LOSS_REASONS.find((lr) => lr.value === reason)?.label || reason,
      count,
      percentage: totalLost > 0 ? Math.round((count / totalLost) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const winLossRatio =
    totalLost > 0
      ? `${wonSessions.length}:${totalLost}`
      : wonSessions.length > 0
        ? `${wonSessions.length}:0`
        : '0:0'

  const avgDealSize =
    curProposalsPaid.length > 0
      ? Math.round((closedValue / curProposalsPaid.length) * 100) / 100
      : 0

  // ── Median cycle time ─────────────────────────────────────────────────

  let medianCycleTimeDays: number | null = null
  const cycleTimes: number[] = []
  for (const p of curProposalsPaid) {
    if (p.paid_at && p.created_at) {
      const diff = new Date(p.paid_at as string).getTime() - new Date(p.created_at).getTime()
      cycleTimes.push(diff / (1000 * 60 * 60 * 24))
    }
  }
  if (cycleTimes.length > 0) {
    cycleTimes.sort((a, b) => a - b)
    const mid = Math.floor(cycleTimes.length / 2)
    medianCycleTimeDays =
      cycleTimes.length % 2 !== 0
        ? Math.round(cycleTimes[mid])
        : Math.round((cycleTimes[mid - 1] + cycleTimes[mid]) / 2)
  }

  // ── Build stages ──────────────────────────────────────────────────────

  const stages: FunnelStageData[] = FUNNEL_STAGES.map((def, i) => {
    const count = stageCounts[i]
    const prevCount = i > 0 ? stageCounts[i - 1] : null
    const topCount = stageCounts[0]

    let lostCount = 0
    if (def.key === 'sales') lostCount = lostSessions.length

    let stageValue: number | null = null
    if (def.key === 'proposal') stageValue = pipelineValue
    if (def.key === 'paid') stageValue = closedValue

    return {
      key: def.key,
      label: def.label,
      shortLabel: def.shortLabel,
      count,
      conversionFromPrevious:
        prevCount != null && prevCount > 0
          ? Math.round((count / prevCount) * 1000) / 10
          : null,
      conversionFromTop:
        topCount > 0 ? Math.round((count / topCount) * 1000) / 10 : null,
      pipelineValue: stageValue,
      unattributed: stageUnattributed[i],
      lostCount,
    }
  })

  // ── Attention items ───────────────────────────────────────────────────

  const attentionItems: AttentionItem[] = []

  // Overdue follow-ups
  for (const s of overdueFollowups) {
    const followUp = s.next_follow_up as string
    const daysOverdue = Math.floor(
      (Date.now() - new Date(followUp).getTime()) / (1000 * 60 * 60 * 24)
    )
    attentionItems.push({
      type: 'overdue_followup',
      severity: daysOverdue > 7 ? 'critical' : 'warning',
      title: `Overdue follow-up: ${s.client_name || s.client_email || 'Unknown'}`,
      detail: `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
      link: `/admin/sales/${s.id}`,
      timeContext: `Due ${new Date(followUp).toLocaleDateString()}`,
    })
  }

  // Stale proposals (sent > 7 days ago, not viewed)
  const now = Date.now()
  for (const p of cProposals.current) {
    if (!p.sent_at || p.viewed_at || p.accepted_at) continue
    const daysSince = Math.floor(
      (now - new Date(p.sent_at as string).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSince >= 7) {
      attentionItems.push({
        type: 'stale_proposal',
        severity: daysSince > 14 ? 'critical' : 'warning',
        title: `Stale proposal: ${p.client_name || 'Unknown'}`,
        detail: `Sent ${daysSince} days ago, not viewed`,
        link: `/proposal/${p.id}`,
        timeContext: `Sent ${new Date(p.sent_at as string).toLocaleDateString()}`,
      })
    }
  }

  // Proposals viewed but not accepted (> 3 days since view)
  for (const p of cProposals.current) {
    if (!p.viewed_at || p.accepted_at || p.paid_at) continue
    const daysSinceView = Math.floor(
      (now - new Date(p.viewed_at as string).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceView >= 3) {
      attentionItems.push({
        type: 'viewed_not_accepted',
        severity: 'info',
        title: `Proposal viewed, not accepted: ${p.client_name || 'Unknown'}`,
        detail: `Viewed ${daysSinceView} days ago`,
        link: `/proposal/${p.id}`,
        timeContext: `Viewed ${new Date(p.viewed_at as string).toLocaleDateString()}`,
      })
    }
  }

  // Conversion drop alert
  if (cContacts.previous.length >= 5) {
    const prevSessionCount = cSessions.previous.length
    if (prevSessionCount > 0 && cSessions.current.length === 0) {
      attentionItems.push({
        type: 'conversion_drop',
        severity: 'warning',
        title: 'No new sales conversations',
        detail: `Previous period had ${prevSessionCount}, current period has 0`,
        link: '/admin/outreach',
      })
    }
  }

  // Sort by severity, limit to 5
  const sev = { critical: 0, warning: 1, info: 2 }
  attentionItems.sort((a, b) => sev[a.severity] - sev[b.severity])

  // ── Self-benchmark ────────────────────────────────────────────────────

  const selfBenchmark: SelfBenchmark = {
    periodLabel: `Last ${days} days`,
    previousPeriodLabel: `Prior ${days} days`,
    deltas: {
      total_leads: calcDelta(cContacts.current.length, cContacts.previous.length),
      total_sessions: calcDelta(cSessions.current.length, cSessions.previous.length),
      proposals_sent: calcDelta(curProposalsSent.length, prevProposalsSent.length),
      proposals_paid: calcDelta(curProposalsPaid.length, prevProposalsPaid.length),
      closed_value: calcDelta(closedValue, prevClosedValue),
    },
  }

  // ── Summary ───────────────────────────────────────────────────────────

  const summary: FunnelSummary = {
    totalLeads: cContacts.current.length,
    totalPipelineValue: pipelineValue,
    totalClosedValue: closedValue,
    avgDealSize,
    winLossRatio,
    lossReasons,
    medianCycleTimeDays,
  }

  return {
    stages,
    summary,
    attentionItems: attentionItems.slice(0, 5),
    selfBenchmark,
  }
}
