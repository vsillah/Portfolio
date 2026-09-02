'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isWarmLeadSource } from '@/lib/constants/lead-source'
import {
  Mail,
  Linkedin,
  CheckCircle,
  ClipboardCheck,
  XCircle,
  Edit3,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Building2,
  User,
  Star,
  Clock,
  MessageSquare,
  Eye,
  AlertTriangle,
  Send,
  BarChart3,
  Users,
  Flame,
  Snowflake,
  X,
  Plus,
  Phone,
  Globe,
  Briefcase,
  ShieldOff,
  ShieldCheck,
  Trash2,
  RotateCcw,
  Cpu,
  Loader2,
  MoreHorizontal,
  Save,
  Unplug,
  Video,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import ReviewEnrichModal from '@/components/admin/outreach/ReviewEnrichModal'
import { formatQuickWinsForDisplay } from '@/lib/quick-wins-display'
import { collectQuickWinTitlesFromMeetingRows } from '@/lib/meeting-action-items-resolve'
import { buildLinkWithReturn } from '@/lib/admin-return-context'
import TechStackModal from '@/components/admin/outreach/TechStackModal'
import SocialIntelModal from '@/components/admin/outreach/SocialIntelModal'
import EvidenceDrawer from '@/components/admin/outreach/EvidenceDrawer'
import AddLeadModal from '@/components/admin/outreach/AddLeadModal'
import RelationshipPacketPanel, {
  type GmailDraftCanaryResult,
  type RelationshipPacketApiResponse,
  type SmsTelnyxNoSendCanaryResult,
} from '@/components/admin/outreach/RelationshipPacketPanel'
import {
  WARM_SLACK_SEND_APPROVAL_QA_CONTACT_ID,
  warmSlackSendApprovalQaLead,
  warmSlackSendApprovalQaRelationshipPacket,
} from '@/components/admin/outreach/warmSlackSendApprovalQaFixture'
import WarmBatchReviewPanel from '@/components/admin/outreach/WarmBatchReviewPanel'
import type { WarmGmailProviderDraftCanaryResult } from '@/components/admin/outreach/WarmBatchReviewPanel'
import WarmOfficeBatchQueuePanel from '@/components/admin/outreach/WarmOfficeBatchQueuePanel'
import { OutreachEmailGenerateRow } from '@/components/admin/OutreachEmailGenerateRow'
import MobileWorkflowSummary from '@/components/admin/MobileWorkflowSummary'
import { useRealtimeOutreach } from '@/lib/hooks/useRealtimeOutreach'
import { OUTREACH_MODE_GATING_NOTE, OUTREACH_MODE_POLICIES } from '@/lib/outreach-mode-gating'
import type { WarmBatchReview } from '@/lib/warm-outreach-batch-review'
import {
  buildWarmOutreachShortlist,
  type WarmOutreachOfficeBatchQueueCandidate,
  type WarmOutreachOfficeBatchQueueState,
  type WarmOutreachOfficeDigest,
  type WarmOutreachShortlistItem,
} from '@/lib/warm-outreach-shortlist'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

interface Lead {
  id: number
  name: string
  email: string
  company: string | null
  company_domain: string | null
  job_title: string | null
  industry: string | null
  phone_number: string | null
  lead_source: string
  lead_score: number | null
  outreach_status: string
  qualification_status: string | null
  created_at: string
  linkedin_url: string | null
  ai_readiness_score: number | null
  competitive_pressure_score: number | null
  quick_wins: string | null
  message: string | null
  full_report: string | null
  rep_pain_points: string | null
  messages_count: number
  messages_sent: number
  has_reply: boolean
  has_sales_conversation: boolean
  latest_session_id: string | null
  session_count: number
  evidence_count: number
  last_vep_triggered_at: string | null
  last_vep_status: string | null
  last_n8n_outreach_triggered_at: string | null
  last_n8n_outreach_status: 'pending' | 'success' | 'failed' | null
  last_n8n_outreach_template_key: string | null
  has_extractable_text: boolean
  do_not_contact?: boolean
  removed_at?: string | null
  website_tech_stack?: { domain?: string; technologies?: unknown[]; byTag?: Record<string, string[]>; creditsRemaining?: number | null } | null
  /** Last N email rows from outreach_queue (from batched leads GET) */
  recent_email_drafts?: {
    id: string
    subject: string | null
    status: string
    created_at: string
    email_message_id?: string | null
  }[]
}

interface LeadsResponse {
  leads: Lead[]
  total: number
  page: number
}

/** Deduplicate silent /api/admin/outreach/leads refetches (Realtime, poll) */
const MIN_SILENT_LEADS_FETCH_MS = 2000
/** n8n + VEP pending fallback when Supabase Realtime lags; keep slower than min silent gap */
const VEP_N8N_PENDING_POLL_MS = 10_000
/** Slightly coalesce burst UPDATE/INSERT events before refetching the list */
const OUTREACH_REALTIME_DEBOUNCE_MS = 1500
/**
 * "Active pending" windows. Rows whose `triggered_at` is older than this are
 * treated as stale (surfaced as "Stalled — retry" / reconciled to failed by
 * the GET handler) and no longer drive live polling / Realtime.
 * Kept in sync with `lib/n8n-outreach-contact-status.ts#STALE_N8N_PENDING_MS`
 * (20 min) and the existing VEP "Stalled — retry" chip threshold (10 min).
 */
const ACTIVE_N8N_PENDING_MS = 20 * 60 * 1000
const ACTIVE_VEP_PENDING_MS = 10 * 60 * 1000

function selectedLeadIdFromParams(searchParams: { get(name: string): string | null } | null): number | null {
  const id =
    searchParams?.get('id') ??
    searchParams?.get('contactId') ??
    searchParams?.get('contact')
  if (!id) return null
  const parsed = parseInt(id, 10)
  return Number.isFinite(parsed) ? parsed : null
}

type TabType = 'leads' | 'escalations'

function initialLeadStatusFilter(searchParams: { get(name: string): string | null } | null) {
  const status = searchParams?.get('status') || 'all'
  return status === 'contacted' ? 'sequence_active' : status
}

interface ChatEscalationRow {
  id: number
  session_id: string
  escalated_at: string
  source: string
  reason: string | null
  visitor_name: string | null
  visitor_email: string | null
  transcript: string | null
  contact_submission_id: number | null
  slack_sent_at: string | null
  created_at: string
  updated_at: string
  contact_submissions: { name: string | null; email: string | null } | null
}

function shortlistStatusClasses(status: WarmOutreachShortlistItem['status']) {
  if (status === 'ready') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
  if (status === 'submitted') return 'border-sky-500/35 bg-sky-500/10 text-sky-100'
  if (status === 'blocked') return 'border-red-500/35 bg-red-500/10 text-red-100'
  return 'border-amber-500/35 bg-amber-500/10 text-amber-100'
}

function channelReadinessClasses(state: WarmOutreachShortlistItem['channelReadiness'][number]['state']) {
  if (state === 'ready') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (state === 'manual') return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  if (state === 'gated') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-silicon-slate/70 bg-background/45 text-muted-foreground'
}

function responseDigestClasses(classification: WarmOutreachOfficeDigest['responseStates'][number]['classification']) {
  if (classification === 'reply_detected') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
  if (classification === 'sent_waiting' || classification === 'draft_ready') {
    return 'border-sky-500/25 bg-sky-500/10 text-sky-100'
  }
  if (classification === 'blocked') return 'border-red-500/25 bg-red-500/10 text-red-100'
  return 'border-silicon-slate/70 bg-background/45 text-muted-foreground'
}

function shortlistStatusLabel(status: WarmOutreachShortlistItem['status']) {
  if (status === 'ready') return 'Ready'
  if (status === 'submitted') return 'Submitted'
  if (status === 'blocked') return 'Blocked'
  return 'Needs review'
}

function DigestPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-silicon-slate/70 bg-background/40 px-2.5 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}


export default function OutreachAdminPage() {
  return (
    <ProtectedRoute requireAdmin>
      <OutreachContent />
    </ProtectedRoute>
  )
}

function OutreachContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const warmSlackSendApprovalQaMode = searchParams?.get('qa') === 'warm-slack-send-approval'

  // Tab management (default: All Leads)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = searchParams?.get('tab')
    return tab === 'leads' || tab === 'escalations' ? tab : 'leads'
  })

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [leadsTempFilter, setLeadsTempFilter] = useState<'all' | 'warm' | 'cold'>(() => {
    const filter = searchParams?.get('filter')
    return (filter === 'warm' || filter === 'cold') ? filter : 'all'
  })
  const [leadsStatusFilter, setLeadsStatusFilter] = useState<string>(() => {
    return initialLeadStatusFilter(searchParams)
  })
  const [leadsSourceFilter, setLeadsSourceFilter] = useState<string>(() => {
    return searchParams?.get('source') || 'all'
  })
  const [leadsVisibilityFilter, setLeadsVisibilityFilter] = useState<'active' | 'do_not_contact' | 'removed' | 'all'>(() => {
    const v = searchParams?.get('visibility')
    return (v === 'do_not_contact' || v === 'removed' || v === 'all') ? v : 'active'
  })
  const [leadsSearch, setLeadsSearch] = useState('')
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(() => {
    if (warmSlackSendApprovalQaMode) return null
    return selectedLeadIdFromParams(searchParams)
  })
  const [outreachWorkroomLeadId, setOutreachWorkroomLeadId] = useState<number | null>(() => {
    return selectedLeadIdFromParams(searchParams)
  })
  const [leadsPage, setLeadsPage] = useState(1)
  const leadsPerPage = 50
  const [leadActionId, setLeadActionId] = useState<number | null>(null)
  const [leadRowMenuOpenId, setLeadRowMenuOpenId] = useState<number | null>(null)

  // Escalations tab state
  const [escalations, setEscalations] = useState<ChatEscalationRow[]>([])
  const [escalationsLoading, setEscalationsLoading] = useState(false)
  const [escalationsTotal, setEscalationsTotal] = useState(0)
  const [escalationsPage, setEscalationsPage] = useState(1)
  const [escalationsLinkedFilter, setEscalationsLinkedFilter] = useState<'all' | 'linked' | 'unlinked'>('all')
  const escalationsPerPage = 20

  // Escalations for expanded lead (lead detail "Chat escalations for this contact")
  const [leadEscalations, setLeadEscalations] = useState<ChatEscalationRow[]>([])
  const [leadEscalationsLoading, setLeadEscalationsLoading] = useState(false)

  // Related meetings for expanded lead (include note fields for Quick Wins fallback)
  const [leadMeetings, setLeadMeetings] = useState<
    Array<{
      id: string
      meeting_type: string
      meeting_date: string
      action_items?: unknown
      structured_notes?: unknown
      key_decisions?: unknown
    }>
  >([])
  /** Avoid showing another contact's meetings during expand switch (fetch is async). */
  const [leadMeetingsContactId, setLeadMeetingsContactId] = useState<number | null>(null)
  const [leadMeetingsLoading, setLeadMeetingsLoading] = useState(false)

  // Meeting action tasks attributed to expanded lead (via meeting_action_tasks.contact_submission_id)
  const [leadActionTasks, setLeadActionTasks] = useState<Array<{
    id: string
    title: string
    status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
    task_category: 'internal' | 'outreach'
    due_date: string | null
    outreach_queue_id: string | null
    meeting_record_id: string | null
  }>>([])
  const [leadActionTasksLoading, setLeadActionTasksLoading] = useState(false)

  const [relationshipPacketData, setRelationshipPacketData] =
    useState<RelationshipPacketApiResponse | null>(null)
  const [relationshipPacketLeadId, setRelationshipPacketLeadId] = useState<number | null>(null)
  const [relationshipPacketLoading, setRelationshipPacketLoading] = useState(false)
  const [relationshipPacketError, setRelationshipPacketError] = useState<string | null>(null)
  const [gmailDraftCanaryLoadingLeadId, setGmailDraftCanaryLoadingLeadId] = useState<number | null>(null)
  const [gmailDraftCanaryErrors, setGmailDraftCanaryErrors] = useState<Record<number, string | null>>({})
  const [gmailDraftCanaryResults, setGmailDraftCanaryResults] = useState<Record<number, GmailDraftCanaryResult | null>>({})
  const [smsTelnyxCanaryLoadingLeadId, setSmsTelnyxCanaryLoadingLeadId] = useState<number | null>(null)
  const [smsTelnyxCanaryErrors, setSmsTelnyxCanaryErrors] = useState<Record<number, string | null>>({})
  const [smsTelnyxCanaryResults, setSmsTelnyxCanaryResults] = useState<Record<number, SmsTelnyxNoSendCanaryResult | null>>({})
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Add lead modal
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)

  // Value evidence: lead selection and push
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set())
  const [warmBatchReview, setWarmBatchReview] = useState<WarmBatchReview | null>(null)
  const [warmBatchReviewLoading, setWarmBatchReviewLoading] = useState(false)
  const [warmBatchReviewError, setWarmBatchReviewError] = useState<string | null>(null)
  const [warmOfficeQueueFilter, setWarmOfficeQueueFilter] =
    useState<WarmOutreachOfficeBatchQueueState | 'all'>('all')
  const [warmBatchDraftActionLoading, setWarmBatchDraftActionLoading] = useState(false)
  const [warmBatchDraftActionError, setWarmBatchDraftActionError] = useState<string | null>(null)
  const [warmProviderDraftCanaryLoadingQueueId, setWarmProviderDraftCanaryLoadingQueueId] = useState<string | null>(null)
  const [warmProviderDraftCanaryError, setWarmProviderDraftCanaryError] = useState<string | null>(null)
  const [warmProviderDraftCanaryResult, setWarmProviderDraftCanaryResult] =
    useState<WarmGmailProviderDraftCanaryResult | null>(null)
  const [showEnrichModal, setShowEnrichModal] = useState(false)
  const [enrichModalLeadIds, setEnrichModalLeadIds] = useState<number[]>([])
  const [pushLoading, setPushLoading] = useState(false)
  const [evidenceDrawerContactId, setEvidenceDrawerContactId] = useState<number | null>(null)
  const [evidenceDrawerData, setEvidenceDrawerData] = useState<{
    evidence: Array<{ id: string; display_name: string | null; source_excerpt: string; confidence_score: number; monetary_indicator?: number | null }>
    reports: Array<{ id: string; title: string | null; total_annual_value: number | null; created_at: string }>
    totalEvidenceCount: number
  } | null>(null)
  const [evidenceDrawerLoading, setEvidenceDrawerLoading] = useState(false)

  // Social Intel modal state
  const [socialIntelLeadId, setSocialIntelLeadId] = useState<number | null>(null)
  const [socialIntelSources, setSocialIntelSources] = useState<string[]>(['reddit', 'google_maps', 'linkedin', 'g2', 'capterra'])
  const [socialIntelScope, setSocialIntelScope] = useState(5)
  const [socialIntelLoading, setSocialIntelLoading] = useState(false)
  const triggerSocialIntelForLead = async (payload: { leadId: number; sources: string[]; maxResults: number; scopeType: 'meeting' | 'assessment' | null; scopeId: string | null }) => {
    setSocialIntelLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      const triggerBody: Record<string, unknown> = {
        workflow: 'social_listening_lead',
        contact_submission_id: payload.leadId,
        sources: payload.sources,
        maxResults: payload.maxResults,
      }
      if (payload.scopeType && payload.scopeId) {
        triggerBody.scope_type = payload.scopeType
        triggerBody.scope_id = payload.scopeId
        triggerBody.phases = ['social']
      }
      const res = await fetch('/api/admin/value-evidence/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(triggerBody),
      })
      if (res.ok) {
        setSocialIntelLeadId(null)
        startVepPolling()
      }
    } finally {
      setSocialIntelLoading(false)
    }
  }

  // VEP extraction polling: track IDs being extracted
  const vepPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [vepPollingActive, setVepPollingActive] = useState(false)
  const leadsListFetchInFlightRef = useRef(false)
  const lastSilentLeadsListFetchAtRef = useRef(0)

  // Last VEP extraction run (from value_evidence_workflow_runs)
  const [lastVepRun, setLastVepRun] = useState<{ triggered_at: string; status: string } | null>(null)


  // Generate outreach state
  const [generateOutreachToast, setGenerateOutreachToast] = useState<string | null>(null)
  const [n8nFailedLeadIds, setN8nFailedLeadIds] = useState<Set<number>>(new Set())

  // Tech stack lookup (BuiltWith) — modal state
  const [techStackLoading, setTechStackLoading] = useState(false)
  const [techStackResult, setTechStackResult] = useState<{
    domain: string
    technologies?: Array<{ name: string; tag?: string; categories?: string[] }>
    byTag?: Record<string, string[]>
    error?: string
    creditsRemaining?: number
  } | null>(null)

  const fetchLeads = useCallback(
    async (opts?: { silent?: boolean; force?: boolean }): Promise<LeadsResponse | null> => {
      const silent = Boolean(opts?.silent)
      const force = Boolean(opts?.force)

      if (silent && !force) {
        if (leadsListFetchInFlightRef.current) return null
        const t = lastSilentLeadsListFetchAtRef.current
        if (t > 0 && Date.now() - t < MIN_SILENT_LEADS_FETCH_MS) return null
      }

      if (!silent) setLeadsLoading(true)
      leadsListFetchInFlightRef.current = true
      try {
        if (warmSlackSendApprovalQaMode) {
          const data: LeadsResponse = {
            leads: [warmSlackSendApprovalQaLead as Lead],
            total: 1,
            page: 1,
          }
          setLeads(data.leads)
          setLeadsTotal(data.total)
          if (silent) {
            lastSilentLeadsListFetchAtRef.current = Date.now()
          }
          return data
        }

        const session = await getCurrentSession()
        if (!session) return null

        const params = new URLSearchParams({
          filter: leadsTempFilter,
          visibility: leadsVisibilityFilter,
          ...(leadsStatusFilter !== 'all' && { status: leadsStatusFilter }),
          ...(leadsSourceFilter !== 'all' && { source: leadsSourceFilter }),
          ...(leadsSearch && { search: leadsSearch }),
          limit: leadsPerPage.toString(),
          offset: ((leadsPage - 1) * leadsPerPage).toString(),
        })

        const response = await fetch(`/api/admin/outreach/leads?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (response.ok) {
          const data: LeadsResponse = await response.json()
          setLeads(data.leads)
          setLeadsTotal(data.total)
          if (silent) {
            lastSilentLeadsListFetchAtRef.current = Date.now()
          }
          return data
        }
        return null
      } catch (error) {
        console.error('Failed to fetch leads:', error)
        return null
      } finally {
        leadsListFetchInFlightRef.current = false
        if (!silent) setLeadsLoading(false)
      }
    },
    [
      leadsTempFilter,
      leadsStatusFilter,
      leadsSourceFilter,
      leadsVisibilityFilter,
      leadsSearch,
      leadsPage,
      leadsPerPage,
      warmSlackSendApprovalQaMode,
    ],
  )

  /**
   * True only while a run is **actively** pending: server-side status is
   * `pending` AND its `triggered_at` is within the active window. Stale
   * pending rows (shown as "Stalled — retry") should NOT keep the poll or
   * Realtime running because there is no progress to detect.
   */
  const hasVepOrN8nPending = useMemo(() => {
    const now = Date.now()
    return leads.some((l) => {
      if (l.last_n8n_outreach_status === 'pending') {
        const age = l.last_n8n_outreach_triggered_at
          ? now - new Date(l.last_n8n_outreach_triggered_at).getTime()
          : Number.POSITIVE_INFINITY
        if (Number.isFinite(age) && age < ACTIVE_N8N_PENDING_MS) return true
      }
      if (l.last_vep_status === 'pending') {
        const age = l.last_vep_triggered_at
          ? now - new Date(l.last_vep_triggered_at).getTime()
          : Number.POSITIVE_INFINITY
        if (Number.isFinite(age) && age < ACTIVE_VEP_PENDING_MS) return true
      }
      return false
    })
  }, [leads])

  const fetchEscalations = useCallback(async () => {
    setEscalationsLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const params = new URLSearchParams({
        page: escalationsPage.toString(),
        limit: escalationsPerPage.toString(),
        ...(escalationsLinkedFilter === 'linked' && { linked: 'true' }),
        ...(escalationsLinkedFilter === 'unlinked' && { linked: 'false' }),
      })
      const response = await fetch(`/api/admin/chat-escalations?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setEscalations(data.escalations ?? [])
        setEscalationsTotal(data.total ?? 0)
      }
    } catch (error) {
      console.error('Failed to fetch escalations:', error)
    } finally {
      setEscalationsLoading(false)
    }
  }, [escalationsPage, escalationsLinkedFilter])

  // Legacy `?tab=queue`: the Message queue list lived here; email rows now use Email center.
  useEffect(() => {
    if (searchParams?.get('tab') !== 'queue') return
    const contact = searchParams.get('contact')
    if (contact) {
      router.replace(`/admin/email-center?contact=${encodeURIComponent(contact)}`)
      return
    }
    const p = new URLSearchParams(searchParams.toString())
    p.delete('tab')
    p.set('tab', 'leads')
    router.replace(`/admin/outreach?${p.toString()}`)
  }, [searchParams, router])

  // VEP extraction + n8n pending: slower poll + shared fetchLeads dedupe; Realtime remains primary
  const startVepPolling = useCallback(() => {
    if (vepPollingRef.current) return // already polling
    setVepPollingActive(true)
    vepPollingRef.current = setInterval(async () => {
      const data = await fetchLeads({ silent: true })
      if (!data) return
      const now = Date.now()
      const stillActive = data.leads.some((l: Lead) => {
        if (l.last_n8n_outreach_status === 'pending') {
          const age = l.last_n8n_outreach_triggered_at
            ? now - new Date(l.last_n8n_outreach_triggered_at).getTime()
            : Number.POSITIVE_INFINITY
          if (Number.isFinite(age) && age < ACTIVE_N8N_PENDING_MS) return true
        }
        if (l.last_vep_status === 'pending') {
          const age = l.last_vep_triggered_at
            ? now - new Date(l.last_vep_triggered_at).getTime()
            : Number.POSITIVE_INFINITY
          if (Number.isFinite(age) && age < ACTIVE_VEP_PENDING_MS) return true
        }
        return false
      })
      if (!stillActive && vepPollingRef.current) {
        clearInterval(vepPollingRef.current)
        vepPollingRef.current = null
        setVepPollingActive(false)
      }
    }, VEP_N8N_PENDING_POLL_MS)
  }, [fetchLeads])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vepPollingRef.current) {
        clearInterval(vepPollingRef.current)
        vepPollingRef.current = null
      }
    }
  }, [])

  // Start VEP/n8n fallback poll only while the current page has a pending run; clear as soon as none
  useEffect(() => {
    if (activeTab !== 'leads') {
      if (vepPollingRef.current) {
        clearInterval(vepPollingRef.current)
        vepPollingRef.current = null
        setVepPollingActive(false)
      }
      return
    }
    if (hasVepOrN8nPending) {
      startVepPolling()
    } else {
      if (vepPollingRef.current) {
        clearInterval(vepPollingRef.current)
        vepPollingRef.current = null
        setVepPollingActive(false)
      }
    }
  }, [activeTab, hasVepOrN8nPending, startVepPolling])

  // Realtime: only while something is pending so idle pages do not refetch on unrelated DB events
  useRealtimeOutreach({
    enabled: activeTab === 'leads' && hasVepOrN8nPending,
    visibleContactIds:
      activeTab === 'leads' && hasVepOrN8nPending ? leads.map((l) => l.id) : null,
    onEvent: () => {
      void fetchLeads({ silent: true })
    },
    debounceMs: OUTREACH_REALTIME_DEBOUNCE_MS,
  })

  // Fetch latest VEP extraction run (one-time on mount)
  useEffect(() => {
    async function fetchLastVepRun() {
      try {
        const session = await getCurrentSession()
        if (!session) return
        const res = await fetch('/api/admin/value-evidence/workflow-status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.vep001) setLastVepRun({ triggered_at: data.vep001.triggered_at, status: data.vep001.status })
        }
      } catch { /* non-critical */ }
    }
    fetchLastVepRun()
  }, [])

  useEffect(() => {
    if (activeTab === 'leads') {
      fetchLeads()
    } else {
      fetchEscalations()
    }
  }, [activeTab, fetchLeads, fetchEscalations])

  // Auto-open add-lead modal when navigated with ?open=add (e.g. from Meetings page)
  useEffect(() => {
    if (searchParams?.get('open') === 'add' && activeTab === 'leads') {
      setShowAddLeadModal(true)
    }
  }, [searchParams, activeTab])

  // Gmail OAuth return (callback redirects here with query flags)
  useEffect(() => {
    const gc = searchParams?.get('gmail_connected')
    const ge = searchParams?.get('gmail_oauth_error')
    if (gc !== '1' && ge == null) return

    if (gc === '1') {
      setGenerateOutreachToast(
        'Gmail connected. You can save email drafts to your Gmail (Drafts folder).'
      )
      setTimeout(() => setGenerateOutreachToast(null), 7000)
    } else if (ge) {
      const messages: Record<string, string> = {
        '1': 'Gmail connection did not finish. Please try Connect my Gmail again.',
        state: 'That sign-in link expired. Connect my Gmail again.',
        config: 'Gmail connection is not set up on the server.',
        refresh:
          'Google did not return a refresh token. In Google Account → Security → Third-party access, remove this app and connect again.',
        email: 'Could not read your Google account email. Try reconnecting.',
        save: 'Could not save your Gmail connection. Please try again.',
      }
      setGenerateOutreachToast(messages[ge] ?? messages['1'])
      setTimeout(() => setGenerateOutreachToast(null), 10000)
    }

    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('gmail_connected')
    params.delete('gmail_oauth_error')
    if (params.get('tab') == null) params.set('tab', 'leads')
    const qs = params.toString()
    router.replace(`/admin/outreach?${qs}`)
  }, [searchParams, router])

  useEffect(() => {
    let cancelled = false
    getCurrentSession()
      .then((currentSession) => {
        if (!cancelled) setAuthToken(currentSession?.access_token ?? null)
      })
      .catch(() => {
        if (!cancelled) setAuthToken(null)
      })
    return () => { cancelled = true }
  }, [])

  // Fetch escalations for the expanded lead (for "Chat escalations for this contact")
  useEffect(() => {
    if (activeTab !== 'leads' || !expandedLeadId) {
      setLeadEscalations([])
      return
    }
    if (warmSlackSendApprovalQaMode && expandedLeadId === WARM_SLACK_SEND_APPROVAL_QA_CONTACT_ID) {
      setLeadEscalations([])
      setLeadEscalationsLoading(false)
      return
    }
    let cancelled = false
    setLeadEscalationsLoading(true)
    getCurrentSession().then((session) => {
      if (!session?.access_token || cancelled) return
      fetch(`/api/admin/chat-escalations?contact=${expandedLeadId}&limit=50`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.ok ? res.json() : { escalations: [] })
        .then((data) => {
          if (!cancelled) setLeadEscalations(data.escalations ?? [])
        })
        .catch(() => { if (!cancelled) setLeadEscalations([]) })
        .finally(() => { if (!cancelled) setLeadEscalationsLoading(false) })
    })
    return () => { cancelled = true }
  }, [activeTab, expandedLeadId, warmSlackSendApprovalQaMode])

  // Fetch related meetings for the expanded lead
  useEffect(() => {
    if (activeTab !== 'leads' || !expandedLeadId) {
      setLeadMeetings([])
      setLeadMeetingsContactId(null)
      return
    }
    if (warmSlackSendApprovalQaMode && expandedLeadId === WARM_SLACK_SEND_APPROVAL_QA_CONTACT_ID) {
      setLeadMeetings([])
      setLeadMeetingsContactId(expandedLeadId)
      setLeadMeetingsLoading(false)
      return
    }
    let cancelled = false
    setLeadMeetings([])
    setLeadMeetingsContactId(null)
    setLeadMeetingsLoading(true)
    const contactId = expandedLeadId
    getCurrentSession().then((session) => {
      if (!session?.access_token || cancelled) return
      fetch(`/api/admin/sales/contact-meetings?contact_submission_id=${expandedLeadId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.ok ? res.json() : { meetings: [] })
        .then((data) => {
          if (!cancelled) {
            const meetings = (data.meetings ?? []).map(
              (m: {
                id: string
                meeting_type: string
                meeting_date: string
                action_items?: unknown
                structured_notes?: unknown
                key_decisions?: unknown
              }) => ({
                id: m.id,
                meeting_type: m.meeting_type,
                meeting_date: m.meeting_date,
                action_items: m.action_items,
                structured_notes: m.structured_notes,
                key_decisions: m.key_decisions,
              })
            )
            setLeadMeetings(meetings)
            setLeadMeetingsContactId(contactId)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLeadMeetings([])
            setLeadMeetingsContactId(null)
          }
        })
        .finally(() => { if (!cancelled) setLeadMeetingsLoading(false) })
    })
    return () => { cancelled = true }
  }, [activeTab, expandedLeadId, warmSlackSendApprovalQaMode])

  // Fetch meeting action tasks attributed to this contact (via contact_submission_id)
  useEffect(() => {
    if (activeTab !== 'leads' || !expandedLeadId) {
      setLeadActionTasks([])
      return
    }
    if (warmSlackSendApprovalQaMode && expandedLeadId === WARM_SLACK_SEND_APPROVAL_QA_CONTACT_ID) {
      setLeadActionTasks([])
      setLeadActionTasksLoading(false)
      return
    }
    let cancelled = false
    setLeadActionTasksLoading(true)
    getCurrentSession().then((session) => {
      if (!session?.access_token || cancelled) return
      fetch(`/api/meeting-action-tasks?contact_submission_id=${expandedLeadId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.ok ? res.json() : { tasks: [] })
        .then((data) => {
          if (!cancelled) {
            setLeadActionTasks((data.tasks ?? []).map((t: {
              id: string
              title: string
              status: 'pending' | 'in_progress' | 'complete' | 'cancelled'
              task_category: 'internal' | 'outreach'
              due_date: string | null
              outreach_queue_id: string | null
              meeting_record_id: string | null
            }) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              task_category: t.task_category,
              due_date: t.due_date,
              outreach_queue_id: t.outreach_queue_id,
              meeting_record_id: t.meeting_record_id,
            })))
          }
        })
        .catch(() => { if (!cancelled) setLeadActionTasks([]) })
        .finally(() => { if (!cancelled) setLeadActionTasksLoading(false) })
    })
    return () => { cancelled = true }
  }, [activeTab, expandedLeadId, warmSlackSendApprovalQaMode])

  useEffect(() => {
    if (activeTab !== 'leads' || !outreachWorkroomLeadId) {
      setRelationshipPacketData(null)
      setRelationshipPacketLeadId(null)
      setRelationshipPacketError(null)
      setRelationshipPacketLoading(false)
      return
    }

    let cancelled = false
    const leadId = outreachWorkroomLeadId
    setRelationshipPacketLeadId(leadId)
    setRelationshipPacketData(null)
    setRelationshipPacketError(null)
    setGmailDraftCanaryErrors((prev) => ({ ...prev, [leadId]: null }))
    setGmailDraftCanaryResults((prev) => ({ ...prev, [leadId]: null }))
    setSmsTelnyxCanaryErrors((prev) => ({ ...prev, [leadId]: null }))
    setSmsTelnyxCanaryResults((prev) => ({ ...prev, [leadId]: null }))
    setRelationshipPacketLoading(true)

    if (warmSlackSendApprovalQaMode && leadId === WARM_SLACK_SEND_APPROVAL_QA_CONTACT_ID) {
      setRelationshipPacketData(warmSlackSendApprovalQaRelationshipPacket)
      setRelationshipPacketLoading(false)
      return () => { cancelled = true }
    }

    getCurrentSession().then((session) => {
      if (cancelled) return
      if (!session?.access_token) {
        setRelationshipPacketError('Admin session is required to load the relationship packet.')
        setRelationshipPacketLoading(false)
        return
      }
      fetch(`/api/admin/outreach/leads/${leadId}/relationship-packet`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(async (res) => {
          const body = await res.json().catch(() => null)
          if (!res.ok) {
            throw new Error(
              typeof body?.error === 'string'
                ? body.error
                : 'Relationship packet could not be loaded.',
            )
          }
          return body as RelationshipPacketApiResponse
        })
        .then((data) => {
          if (!cancelled) setRelationshipPacketData(data)
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setRelationshipPacketData(null)
            setRelationshipPacketError(
              error instanceof Error
                ? error.message
                : 'Relationship packet could not be loaded.',
            )
          }
        })
        .finally(() => {
          if (!cancelled) setRelationshipPacketLoading(false)
        })
    })

    return () => { cancelled = true }
  }, [activeTab, outreachWorkroomLeadId, warmSlackSendApprovalQaMode])

  const runGmailDraftCanary = useCallback(async (leadId: number) => {
    if (gmailDraftCanaryLoadingLeadId != null) return
    setGmailDraftCanaryLoadingLeadId(leadId)
    setGmailDraftCanaryErrors((prev) => ({ ...prev, [leadId]: null }))
    setGmailDraftCanaryResults((prev) => ({ ...prev, [leadId]: null }))
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setGmailDraftCanaryErrors((prev) => ({
          ...prev,
          [leadId]: 'Admin session is required to run the no-send Gmail draft canary.',
        }))
        return
      }
      const res = await fetch(`/api/admin/outreach/leads/${leadId}/gmail-draft-canary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = (await res.json().catch(() => ({}))) as GmailDraftCanaryResult & { error?: string }
      if (!res.ok) {
        setGmailDraftCanaryErrors((prev) => ({
          ...prev,
          [leadId]: body.error || 'No-send Gmail draft canary failed.',
        }))
        return
      }
      setGmailDraftCanaryResults((prev) => ({ ...prev, [leadId]: body }))
      setGenerateOutreachToast(body.message || 'No-send Gmail draft canary passed.')
      setTimeout(() => setGenerateOutreachToast(null), 7000)
    } catch {
      setGmailDraftCanaryErrors((prev) => ({
        ...prev,
        [leadId]: 'No-send Gmail draft canary failed.',
      }))
    } finally {
      setGmailDraftCanaryLoadingLeadId(null)
    }
  }, [gmailDraftCanaryLoadingLeadId])

  const runSmsTelnyxNoSendCanary = useCallback(async (leadId: number) => {
    if (smsTelnyxCanaryLoadingLeadId != null) return
    setSmsTelnyxCanaryLoadingLeadId(leadId)
    setSmsTelnyxCanaryErrors((prev) => ({ ...prev, [leadId]: null }))
    setSmsTelnyxCanaryResults((prev) => ({ ...prev, [leadId]: null }))
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setSmsTelnyxCanaryErrors((prev) => ({
          ...prev,
          [leadId]: 'Admin session is required to run the SMS no-send canary.',
        }))
        return
      }
      const res = await fetch(`/api/admin/outreach/leads/${leadId}/sms-telnyx-no-send-canary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = (await res.json().catch(() => ({}))) as SmsTelnyxNoSendCanaryResult & { error?: string }
      if (!res.ok) {
        setSmsTelnyxCanaryErrors((prev) => ({
          ...prev,
          [leadId]: body.error || 'SMS no-send canary failed.',
        }))
        return
      }
      setSmsTelnyxCanaryResults((prev) => ({ ...prev, [leadId]: body }))
      setGenerateOutreachToast(body.message || 'SMS no-send canary completed.')
      setTimeout(() => setGenerateOutreachToast(null), 7000)
    } catch {
      setSmsTelnyxCanaryErrors((prev) => ({
        ...prev,
        [leadId]: 'SMS no-send canary failed.',
      }))
    } finally {
      setSmsTelnyxCanaryLoadingLeadId(null)
    }
  }, [smsTelnyxCanaryLoadingLeadId])

  useEffect(() => {
    if (leadRowMenuOpenId == null) return
    const close = () => setLeadRowMenuOpenId(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointerDown = (e: PointerEvent) => {
      const wrap = document.getElementById(`lead-actions-wrap-${leadRowMenuOpenId}`)
      if (wrap && !wrap.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [leadRowMenuOpenId])

  useEffect(() => {
    setLeadRowMenuOpenId(null)
  }, [activeTab])

  // Handle tab changes with URL updates
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('tab', tab)
    router.push(`/admin/outreach?${params.toString()}`)
  }

  const openReviewEnrichModal = useCallback((contactSubmissionIds: number[]) => {
    if (contactSubmissionIds.length === 0) return
    setEnrichModalLeadIds(contactSubmissionIds)
    setShowEnrichModal(true)
  }, [])

  const loadWarmBatchReview = useCallback(async (
    contactIds: number[],
    cohortLabel?: string,
  ) => {
    if (contactIds.length === 0) return

    setWarmBatchReviewLoading(true)
    setWarmBatchReviewError(null)
    setWarmBatchDraftActionError(null)
    setWarmProviderDraftCanaryError(null)
    setWarmProviderDraftCanaryResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setWarmBatchReviewError('Admin session is required to review a warm batch.')
        return
      }

      const res = await fetch('/api/admin/outreach/batch-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contact_ids: contactIds,
          cohort_label: cohortLabel ?? `${contactIds.length} selected Gmail draft candidate${contactIds.length === 1 ? '' : 's'}`,
          preferred_channel: 'email',
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          typeof body?.error === 'string'
            ? body.error
            : 'Warm batch review could not be loaded.',
        )
      }
      setWarmBatchReview(body as WarmBatchReview)
    } catch (error) {
      setWarmBatchReview(null)
      setWarmBatchReviewError(
        error instanceof Error ? error.message : 'Warm batch review could not be loaded.',
      )
    } finally {
      setWarmBatchReviewLoading(false)
    }
  }, [])

  const reviewWarmBatch = useCallback(async () => {
    await loadWarmBatchReview([...selectedLeadIds])
  }, [loadWarmBatchReview, selectedLeadIds])

  const createWarmBatchGmailDraftRecords = useCallback(async () => {
    const contactIds = [...selectedLeadIds]
    if (contactIds.length === 0) return

    setWarmBatchDraftActionLoading(true)
    setWarmBatchDraftActionError(null)
    setWarmProviderDraftCanaryError(null)
    setWarmProviderDraftCanaryResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setWarmBatchDraftActionError('Admin session is required to create draft-only Gmail records.')
        return
      }

      const res = await fetch('/api/admin/outreach/batch-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create_gmail_draft_records',
          contact_ids: contactIds,
          cohort_label: `${contactIds.length} selected Gmail draft candidate${contactIds.length === 1 ? '' : 's'}`,
          preferred_channel: 'email',
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          typeof body?.error === 'string'
            ? body.error
            : 'Gmail draft records could not be created.',
        )
      }
      setWarmBatchReview(body as WarmBatchReview)
    } catch (error) {
      setWarmBatchDraftActionError(
        error instanceof Error ? error.message : 'Gmail draft records could not be created.',
      )
    } finally {
      setWarmBatchDraftActionLoading(false)
    }
  }, [selectedLeadIds])

  const prepareWarmProviderDraftCanary = useCallback(async (queueId: string) => {
    if (warmProviderDraftCanaryLoadingQueueId) return

    setWarmProviderDraftCanaryLoadingQueueId(queueId)
    setWarmProviderDraftCanaryError(null)
    setWarmProviderDraftCanaryResult(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setWarmProviderDraftCanaryError('Admin session is required to prepare the provider draft canary.')
        return
      }

      const res = await fetch(`/api/admin/outreach/${encodeURIComponent(queueId)}/gmail-user-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ noSendSmoke: true }),
      })
      const body = (await res.json().catch(() => ({}))) as WarmGmailProviderDraftCanaryResult & { error?: string }
      if (!res.ok) {
        setWarmProviderDraftCanaryError(body.error || 'Provider draft canary preparation failed.')
        return
      }

      setWarmProviderDraftCanaryResult(body)
      setGenerateOutreachToast(body.message || 'Provider draft canary prepared. Gmail draft creation remains locked.')
      setTimeout(() => setGenerateOutreachToast(null), 7000)
    } catch {
      setWarmProviderDraftCanaryError('Provider draft canary preparation failed.')
    } finally {
      setWarmProviderDraftCanaryLoadingQueueId(null)
    }
  }, [warmProviderDraftCanaryLoadingQueueId])

  const setExpandedLeadFromControl = useCallback((leadId: number | null) => {
    setExpandedLeadId(leadId)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('tab', 'leads')
    params.delete('contact')
    if (leadId) {
      params.set('id', String(leadId))
    } else {
      params.delete('id')
    }
    router.replace(`/admin/outreach?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const updateLeadDncOrRemoved = useCallback(
    async (leadId: number, payload: { do_not_contact?: boolean; removed_at?: string | null }) => {
      const session = await getCurrentSession()
      if (!session) return
      setLeadActionId(leadId)
      try {
        const res = await fetch(`/api/admin/outreach/leads/${leadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        })
        if (res.ok) await fetchLeads()
      } catch (e) {
        console.error('Update lead DNC/removed failed:', e)
      } finally {
        setLeadActionId(null)
      }
    },
    [fetchLeads]
  )

  const getScoreBadgeColor = (score: number | null) => {
    if (!score) return 'bg-silicon-slate text-foreground'
    if (score >= 70) return 'bg-green-900/50 text-green-400 border border-green-700'
    if (score >= 40) return 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
    return 'bg-red-900/50 text-red-400 border border-red-700'
  }
  const warmOutreachShortlist = useMemo(
    () => buildWarmOutreachShortlist(leads, { limit: 15 }),
    [leads],
  )
  const warmOfficeDigest = warmOutreachShortlist.officeDigest
  const warmOfficeBatchQueue = warmOutreachShortlist.officeBatchQueue
  const showWarmOutreachShortlist =
    activeTab === 'leads' && leadsTempFilter === 'warm' && warmOutreachShortlist.items.length > 0
  const prepareOfficeBatchPlan = useCallback(async () => {
    const contactIds = warmOfficeBatchQueue.currentCta.contactIds
    if (contactIds.length === 0) return
    setSelectedLeadIds(new Set(contactIds))
    await loadWarmBatchReview(
      contactIds,
      `${contactIds.length} office-week review batch candidate${contactIds.length === 1 ? '' : 's'}`,
    )
  }, [loadWarmBatchReview, warmOfficeBatchQueue.currentCta.contactIds])
  const openWarmShortlistItem = useCallback(
    (item: WarmOutreachShortlistItem) => {
      setOutreachWorkroomLeadId(item.contactId)
      setExpandedLeadId(item.contactId)
      setLeadRowMenuOpenId(null)
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.set('tab', 'leads')
      params.set('filter', 'warm')
      params.set('id', String(item.contactId))
      params.set('contactId', String(item.contactId))
      const hash = item.cta.key === 'handle_response' ? '#warm-response-lifecycle' : ''
      router.replace(`/admin/outreach?${params.toString()}${hash}`, { scroll: false })
    },
    [router, searchParams],
  )
  const openWarmOfficeCandidate = useCallback(
    (candidate: WarmOutreachOfficeBatchQueueCandidate) => {
      setOutreachWorkroomLeadId(candidate.contactId)
      setExpandedLeadId(candidate.contactId)
      setLeadRowMenuOpenId(null)
      const params = new URLSearchParams(searchParams?.toString() || '')
      params.set('tab', 'leads')
      params.set('filter', 'warm')
      params.set('id', String(candidate.contactId))
      params.set('contactId', String(candidate.contactId))
      const hash = candidate.responseStatus === 'reply_detected' ? '#warm-response-lifecycle' : ''
      router.replace(`/admin/outreach?${params.toString()}${hash}`, { scroll: false })
    },
    [router, searchParams],
  )
  const openWarmDigestCurrentAction = useCallback(() => {
    const contactId = warmOfficeDigest.currentCta.contactId
    if (!warmOfficeDigest.currentCta.enabled || contactId == null) return

    const item = warmOutreachShortlist.items.find((candidate) => candidate.contactId === contactId)
    if (item) {
      openWarmShortlistItem(item)
      return
    }

    setOutreachWorkroomLeadId(contactId)
    setExpandedLeadId(contactId)
    setLeadRowMenuOpenId(null)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('tab', 'leads')
    params.set('filter', 'warm')
    params.set('id', String(contactId))
    params.set('contactId', String(contactId))
    const hash = warmOfficeDigest.currentCta.key === 'handle_response' ? '#warm-response-lifecycle' : ''
    router.replace(`/admin/outreach?${params.toString()}${hash}`, { scroll: false })
  }, [openWarmShortlistItem, router, searchParams, warmOfficeDigest, warmOutreachShortlist.items])
  const expandedLead = expandedLeadId ? leads.find((lead) => lead.id === expandedLeadId) ?? null : null
  const outreachWorkroomLead = outreachWorkroomLeadId
    ? leads.find((lead) => lead.id === outreachWorkroomLeadId) ?? null
    : null
  const modePolicies = Object.values(OUTREACH_MODE_POLICIES)
  const outreachModeLabel = outreachWorkroomLead
    ? `${isWarmLeadSource(outreachWorkroomLead.lead_source) ? 'Warm' : 'Cold'} 1:1`
    : activeTab === 'escalations'
      ? 'Warm 1:1 review'
      : `${leadsTempFilter === 'all' ? 'Cold/warm' : leadsTempFilter === 'warm' ? 'Warm' : 'Cold'} lead review`
  const outreachNextAction = outreachWorkroomLead
    ? outreachWorkroomLead.do_not_contact || outreachWorkroomLead.removed_at
      ? 'Resolve contact status before any draft or evidence work continues.'
      : 'Review evidence, recent drafts, meetings, and contact status before preparing internal outreach.'
    : selectedLeadIds.size
      ? `Review or enrich ${selectedLeadIds.size} selected lead(s).`
      : 'Select a lead to inspect the canonical outreach workroom.'
  const outreachBlocker = outreachWorkroomLead?.do_not_contact
    ? 'This lead is marked do not contact.'
    : outreachWorkroomLead?.removed_at
      ? 'This lead is removed from the active list.'
      : null

  return (
    <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Lead Pipeline' },
          ]}
        />

        {/* Header */}
        <div className="admin-console-surface-header mb-6 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex-1">
            <div className="admin-console-eyebrow mb-2">Pipeline Operations</div>
            <h1 className="text-3xl font-bold text-foreground">
              Lead Pipeline
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {activeTab === 'escalations'
                ? 'Chat and voice escalations — link to leads and view transcripts'
                : 'Manage all leads, view details, and track progress. For email send history and rows, use Email center.'}
            </p>
          </div>
          {lastVepRun && (
            <div className="text-right text-xs text-muted-foreground/90 flex-shrink-0 mr-4">
              <div>
                Last VEP extraction:{' '}
                <span className="text-muted-foreground">
                  {new Date(lastVepRun.triggered_at).toLocaleString()}
                </span>
              </div>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${
                lastVepRun.status === 'success'
                  ? 'bg-green-500/20 text-green-400'
                  : lastVepRun.status === 'failed'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
              }`}>
                {lastVepRun.status}
              </span>
            </div>
          )}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end" aria-label="Outreach workroom actions">
            {activeTab === 'leads' && (
              <button
                type="button"
                onClick={() => setShowAddLeadModal(true)}
                className="admin-console-button-primary"
              >
                <Plus size={14} />
                Add lead
              </button>
            )}
            <Link href="/admin/credentials#gmail-profile">
              <button className="admin-console-button-secondary">
                <Mail size={16} />
                Gmail profile
              </button>
            </Link>
            <Link href="/admin/outreach/dashboard">
              <button className="admin-console-button-secondary">
                <BarChart3 size={16} />
                Dashboard & Triggers
              </button>
            </Link>
            <button
              onClick={() => {
                if (activeTab === 'leads') void fetchLeads()
                else void fetchEscalations()
              }}
              className="admin-console-button-muted"
            >
              <RefreshCw size={16} className={(leadsLoading || escalationsLoading) ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <MobileWorkflowSummary
          title={outreachWorkroomLead ? `Lead: ${outreachWorkroomLead.name}` : 'Outreach workroom'}
          currentState={outreachModeLabel}
          owner="Vambah / Outreach"
          nextAction={outreachNextAction}
          waitingOnYou={outreachWorkroomLead || selectedLeadIds.size ? 'Yes - review before action' : 'No'}
          blocker={outreachBlocker}
          canonicalHref={outreachWorkroomLead ? `/admin/outreach?tab=leads&id=${outreachWorkroomLead.id}` : '/admin/outreach?tab=leads'}
          canonicalLabel={outreachWorkroomLead ? 'Open selected lead' : 'Open lead workroom'}
          tone={outreachBlocker ? 'red' : outreachWorkroomLead || selectedLeadIds.size ? 'yellow' : 'blue'}
        />

        <div className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-4 lg:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outreach modes</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {modePolicies.map((mode) => (
              <span key={mode.key} className="rounded-full border border-silicon-slate/70 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                {mode.label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{OUTREACH_MODE_GATING_NOTE}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-silicon-slate">
          <button
            onClick={() => handleTabChange('leads')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              activeTab === 'leads'
                ? 'border-radiant-gold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users size={18} />
            <span className="font-medium">All Leads</span>
            {leadsTotal > 0 && (
              <span className="px-2 py-0.5 bg-radiant-gold text-imperial-navy text-xs font-semibold rounded-full">
                {leadsTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('escalations')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              activeTab === 'escalations'
                ? 'border-radiant-gold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle size={18} />
            <span className="font-medium">Escalations</span>
            {escalationsTotal > 0 && (
              <span className="rounded-full border border-radiant-gold/50 bg-radiant-gold/20 px-2 py-0.5 text-xs font-semibold text-radiant-gold">
                {escalationsTotal}
              </span>
            )}
          </button>
        </div>

        {/* Leads Tab Content */}
        {activeTab === 'leads' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Filter size={14} className="text-muted-foreground" />
              <select
                value={leadsTempFilter}
                onChange={(e) => setLeadsTempFilter(e.target.value as 'all' | 'warm' | 'cold')}
                className="bg-silicon-slate/50 text-foreground border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Leads</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
              <select
                value={leadsStatusFilter}
                onChange={(e) => setLeadsStatusFilter(e.target.value)}
                className="bg-silicon-slate/50 text-foreground border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="sequence_active">Contacted</option>
                <option value="replied">Replied</option>
                <option value="booked">Booked</option>
                <option value="opted_out">Opted Out</option>
              </select>
              <select
                value={leadsSourceFilter}
                onChange={(e) => setLeadsSourceFilter(e.target.value)}
                className="bg-silicon-slate/50 text-foreground border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Sources</option>
                <option value="warm_facebook">Facebook</option>
                <option value="warm_google_contacts">Google Contacts</option>
                <option value="warm_linkedin">LinkedIn</option>
                <option value="cold_apollo">Apollo</option>
              </select>
              <select
                value={leadsVisibilityFilter}
                onChange={(e) => setLeadsVisibilityFilter(e.target.value as 'active' | 'do_not_contact' | 'removed' | 'all')}
                className="bg-silicon-slate/50 text-foreground border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                title="Show leads by contact status"
              >
                <option value="active">Active only</option>
                <option value="do_not_contact">Do not contact</option>
                <option value="removed">Removed</option>
                <option value="all">All</option>
              </select>
              <input
                type="text"
                placeholder="Search by name, email, or company..."
                value={leadsSearch}
                onChange={(e) => setLeadsSearch(e.target.value)}
                className="bg-silicon-slate/50 text-foreground border border-white/10 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
              />
            </div>

            <AddLeadModal
              open={showAddLeadModal}
              onClose={() => setShowAddLeadModal(false)}
              onLeadAdded={(id) => {
                setShowAddLeadModal(false)
                setExpandedLeadId(id)
                fetchLeads()
              }}
              onOutreachGenerated={() => {}}
            />

            <ReviewEnrichModal
              open={showEnrichModal}
              onClose={() => setShowEnrichModal(false)}
              leadIds={enrichModalLeadIds}
              pushLoading={pushLoading}
              setPushLoading={setPushLoading}
              fetchLeads={fetchLeads}
              startVepPolling={startVepPolling}
              onSelectedLeadsClear={() => setSelectedLeadIds(new Set())}
            />

            {/* Evidence drawer */}
            <EvidenceDrawer
              contactId={evidenceDrawerContactId}
              data={evidenceDrawerData}
              loading={evidenceDrawerLoading}
              onClose={() => setEvidenceDrawerContactId(null)}
              onDataChange={setEvidenceDrawerData}
              onRefreshExtract={async (cid) => {
                const session = await getCurrentSession()
                if (!session) return
                const extractRes = await fetch('/api/admin/value-evidence/extract-leads', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ leads: [{ contact_submission_id: cid }] }),
                })
                if (extractRes.ok) {
                  startVepPolling()
                  await fetchLeads()
                }
              }}
              fetchLeads={fetchLeads}
            />

            {/* Social Intel modal */}
            {socialIntelLeadId != null && (
              <SocialIntelModal
                leadId={socialIntelLeadId}
                contactSubmissionId={socialIntelLeadId}
                sources={socialIntelSources}
                onSourcesChange={setSocialIntelSources}
                scope={socialIntelScope}
                onScopeChange={setSocialIntelScope}
                loading={socialIntelLoading}
                onTrigger={triggerSocialIntelForLead}
                onClose={() => setSocialIntelLeadId(null)}
              />
            )}

            {/* Tech stack lookup modal (BuiltWith) */}
            <TechStackModal result={techStackResult} onClose={() => setTechStackResult(null)} />

            {/* Generate outreach toast */}
            <AnimatePresence>
              {generateOutreachToast && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-lg bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm flex items-center gap-2"
                >
                  <Mail size={16} />
                  {generateOutreachToast}
                  <button
                    type="button"
                    onClick={() => setGenerateOutreachToast(null)}
                    className="ml-auto p-1 rounded hover:bg-emerald-800/50"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {showWarmOutreachShortlist && (
              <>
              <WarmOfficeBatchQueuePanel
                queue={warmOfficeBatchQueue}
                activeState={warmOfficeQueueFilter}
                loading={warmBatchReviewLoading}
                error={warmBatchReviewError}
                onStateChange={setWarmOfficeQueueFilter}
                onPrepareBatch={prepareOfficeBatchPlan}
                onOpenCandidate={openWarmOfficeCandidate}
              />
              <section
                className="mb-4 rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-3 sm:p-4"
                aria-label="Warm response digest"
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,auto)] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">
                        Warm response digest
                      </p>
                      <span className="rounded-full border border-silicon-slate/70 bg-background/45 px-2 py-0.5 text-xs text-muted-foreground">
                        {warmOfficeDigest.operatingWindowLabel}
                      </span>
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100">
                        external requests {warmOfficeDigest.executionBoundary.externalRequests.length}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                      <DigestPill label="Drafted" value={String(warmOfficeDigest.counts.drafted)} />
                      <DigestPill label="Approved" value={String(warmOfficeDigest.counts.approved)} />
                      <DigestPill label="Sent" value={String(warmOfficeDigest.counts.sent)} />
                      <DigestPill label="Replied" value={String(warmOfficeDigest.counts.replied)} />
                      <DigestPill label="Blocked" value={String(warmOfficeDigest.counts.blocked)} />
                      <DigestPill label="Needs Vambah" value={String(warmOfficeDigest.counts.needsVambah)} />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!warmOfficeDigest.currentCta.enabled || warmOfficeDigest.currentCta.contactId == null}
                    onClick={openWarmDigestCurrentAction}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 text-sm font-semibold text-radiant-gold transition-colors hover:bg-radiant-gold/15 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
                    aria-label={`Warm digest current action: ${warmOfficeDigest.currentCta.label}${warmOfficeDigest.currentCta.contactName ? ` for ${warmOfficeDigest.currentCta.contactName}` : ''}`}
                  >
                    <MessageSquare size={15} aria-hidden />
                    {warmOfficeDigest.currentCta.label}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {warmOfficeDigest.responseStates.slice(0, 3).map((row) => (
                    <div
                      key={row.contactId}
                      className={`rounded-md border p-2 ${responseDigestClasses(row.classification)}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold">{row.contactName}</p>
                        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold">
                          {row.classification.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 opacity-85">{row.nextBestAction}</p>
                      <p className="mt-1 text-[10px] leading-4 opacity-75">
                        Follow-up: {row.followUpDraftReadiness.replace(/_/g, ' ')}
                        {row.suppressionProposalVisible ? ' / suppression review visible' : ''}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                  Provider monitoring, Gmail/SMS sends, Slack dispatch, social actions, and n8n dispatch remain off.
                </p>
              </section>
              <section
                className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/15 p-3 sm:p-4"
                aria-label="Daily warm outreach shortlist"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">
                        Daily warm shortlist
                      </p>
                      <span className="rounded-full border border-silicon-slate/70 bg-background/45 px-2 py-0.5 text-xs text-muted-foreground">
                        {warmOutreachShortlist.items.length} shown
                      </span>
                      <span className="rounded-full border border-silicon-slate/70 bg-background/45 px-2 py-0.5 text-xs text-muted-foreground">
                        SMS unavailable
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Prioritized from the current warm filter. CTAs open Portfolio review gates only.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                      {warmOutreachShortlist.summary.readyCount} ready
                    </span>
                    <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                      {warmOutreachShortlist.summary.blockedCount} blocked
                    </span>
                    <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-sky-100">
                      {warmOutreachShortlist.summary.submittedCount} submitted
                    </span>
                  </div>
                </div>
                <div className="grid gap-2">
                  {warmOutreachShortlist.items.map((item) => (
                    <article
                      key={item.contactId}
                      className="grid gap-3 rounded-lg border border-silicon-slate/70 bg-background/45 p-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)_minmax(11rem,auto)] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-radiant-gold/30 bg-radiant-gold/10 px-2 py-0.5 text-xs font-semibold text-radiant-gold">
                            #{item.priorityRank}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${shortlistStatusClasses(item.status)}`}>
                            {shortlistStatusLabel(item.status)}
                          </span>
                          <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
                            {item.contactName}
                          </h3>
                          {item.company && (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.company}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span title="Relationship basis" className="inline-flex items-center gap-1">
                            <ShieldCheck size={12} aria-hidden />
                            {item.relationshipBasis}
                          </span>
                          <span title={item.lastTouch.iso ?? 'No dated touch available'} className="inline-flex items-center gap-1">
                            <Clock size={12} aria-hidden />
                            {item.lastTouch.label}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {item.recommendedNextAction}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.channelReadiness.map((channel) => (
                            <span
                              key={`${item.contactId}-${channel.channel}`}
                              title={channel.label}
                              className={`rounded-full border px-2 py-0.5 text-[11px] ${channelReadinessClasses(channel.state)}`}
                            >
                              {channel.label}
                            </span>
                          ))}
                        </div>
                        {item.blockers.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${item.contactName} shortlist blockers`}>
                            {item.blockers.slice(0, 4).map((blocker) => (
                              <span
                                key={`${item.contactId}-${blocker.key}`}
                                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100"
                              >
                                {blocker.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openWarmShortlistItem(item)}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 text-sm font-semibold text-radiant-gold transition-colors hover:bg-radiant-gold/15 lg:w-auto"
                        aria-label={`${item.cta.label} for ${item.contactName}`}
                      >
                        {item.cta.key === 'handle_response' ? (
                          <MessageSquare size={15} aria-hidden />
                        ) : item.cta.key === 'send_approved_gmail_draft' ? (
                          <Send size={15} aria-hidden />
                        ) : item.cta.key === 'resolve_blocker' ? (
                          <AlertTriangle size={15} aria-hidden />
                        ) : (
                          <ClipboardCheck size={15} aria-hidden />
                        )}
                        {item.cta.label}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              </>
            )}

            {outreachWorkroomLead && (
              <section
                id="warm-outreach-approval-gate"
                className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-4"
                aria-label={`Outreach workroom for ${outreachWorkroomLead.name}`}
              >
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">
                      Selected outreach workroom
                    </p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
                      {outreachWorkroomLead.name}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                      Review the relationship packet and prepare internal email or LinkedIn drafts here. The lead list stays a list; provider sends remain gated.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOutreachWorkroomLeadId(null)}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-silicon-slate/80 bg-silicon-slate/35 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-silicon-slate/55 hover:text-foreground"
                    aria-label={`Close outreach workroom for ${outreachWorkroomLead.name}`}
                  >
                    <X size={15} aria-hidden />
                    Close
                  </button>
                </div>
                <div className="space-y-3">
                  {outreachBlocker ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-amber-100"
                    >
                      <p className="flex items-center gap-2 font-semibold">
                        <ShieldOff size={15} className="shrink-0" aria-hidden />
                        Draft generation blocked
                      </p>
                      <p className="mt-1 leading-6 text-amber-100/85">
                        {outreachBlocker} This workroom remains read-only for relationship review; no local draft,
                        provider call, Gmail draft, DM, or send can start until the contact status is resolved.
                      </p>
                    </div>
                  ) : (
                    <OutreachEmailGenerateRow
                      lead={outreachWorkroomLead}
                      presentation="workroom"
                      n8nFallback={n8nFailedLeadIds.has(outreachWorkroomLead.id)}
                      relationshipPacketData={
                        relationshipPacketLeadId === outreachWorkroomLead.id ? relationshipPacketData : null
                      }
                      relationshipPacketLoading={
                        relationshipPacketLeadId === outreachWorkroomLead.id && relationshipPacketLoading
                      }
                      relationshipPacketError={
                        relationshipPacketLeadId === outreachWorkroomLead.id ? relationshipPacketError : null
                      }
                      onToast={(msg) => {
                        setGenerateOutreachToast(msg)
                        setTimeout(() => setGenerateOutreachToast(null), 6000)
                      }}
                      onFallbackAvailable={() => {
                        setN8nFailedLeadIds((prev) => new Set([...prev, outreachWorkroomLead.id]))
                      }}
                      onFallbackCleared={() => {
                        setN8nFailedLeadIds((prev) => {
                          const next = new Set(prev)
                          next.delete(outreachWorkroomLead.id)
                          return next
                        })
                      }}
                      onSettled={() => {
                        void fetchLeads({ silent: true })
                      }}
                      onOutreachOpen={() => {
                        void fetchLeads({ silent: true })
                      }}
                    />
                  )}
                  <RelationshipPacketPanel
                    authToken={authToken}
                    loading={relationshipPacketLeadId === outreachWorkroomLead.id && relationshipPacketLoading}
                    error={relationshipPacketLeadId === outreachWorkroomLead.id ? relationshipPacketError : null}
                    data={relationshipPacketLeadId === outreachWorkroomLead.id ? relationshipPacketData : null}
                    responseDigestAnchorId="warm-response-lifecycle"
                    inertSlackApprovalRequest={warmSlackSendApprovalQaMode}
                    gmailDraftCanaryLoading={gmailDraftCanaryLoadingLeadId === outreachWorkroomLead.id}
                    gmailDraftCanaryError={gmailDraftCanaryErrors[outreachWorkroomLead.id] ?? null}
                    gmailDraftCanaryResult={gmailDraftCanaryResults[outreachWorkroomLead.id] ?? null}
                    onGmailDraftCanary={() => { void runGmailDraftCanary(outreachWorkroomLead.id) }}
                    smsTelnyxCanaryLoading={smsTelnyxCanaryLoadingLeadId === outreachWorkroomLead.id}
                    smsTelnyxCanaryError={smsTelnyxCanaryErrors[outreachWorkroomLead.id] ?? null}
                    smsTelnyxCanaryResult={smsTelnyxCanaryResults[outreachWorkroomLead.id] ?? null}
                    onSmsTelnyxNoSendCanary={() => { void runSmsTelnyxNoSendCanary(outreachWorkroomLead.id) }}
                  />
                </div>
              </section>
            )}

            {/* Leads List */}
            {leadsLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={24} className="animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-20">
                <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium text-muted-foreground">
                  No leads found
                </h3>
                <p className="text-muted-foreground mt-2">
                  Try adjusting your filters or trigger lead scraping from the dashboard
                </p>
              </div>
            ) : (
              <>
                {selectedLeadIds.size > 0 && (
                  <div className="relative z-10 mb-4 grid gap-3 rounded-xl border border-silicon-slate bg-background/95 p-3 sm:sticky sm:top-0 sm:flex sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {selectedLeadIds.size} lead(s) selected
                      </span>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Plan draft-only Gmail outreach or enrich selected leads from this existing outreach list.
                      </p>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        onClick={reviewWarmBatch}
                        disabled={warmBatchReviewLoading || selectedLeadIds.size === 0 || selectedLeadIds.size > 50}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-500/35 bg-sky-500/10 px-4 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {warmBatchReviewLoading ? (
                          <RefreshCw size={15} className="animate-spin" aria-hidden />
                        ) : (
                          <Users size={15} aria-hidden />
                        )}
                        Plan Gmail drafts
                      </button>
                      <button
                        type="button"
                        onClick={() => openReviewEnrichModal([...selectedLeadIds])}
                        disabled={pushLoading || selectedLeadIds.size === 0 || selectedLeadIds.size > 50}
                        className="min-h-10 w-full rounded-lg px-4 py-2 text-sm font-medium btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 sm:w-auto"
                      >
                        {pushLoading ? 'Loading...' : 'Push to Value Evidence'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLeadIds(new Set())
                          setWarmBatchReview(null)
                          setWarmBatchReviewError(null)
                          setWarmBatchDraftActionError(null)
                          setWarmProviderDraftCanaryError(null)
                          setWarmProviderDraftCanaryResult(null)
                        }}
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-silicon-slate/80 px-3 text-sm text-muted-foreground hover:text-foreground sm:w-auto sm:border-transparent"
                      >
                        Clear selection
                      </button>
                    </div>
                  </div>
                )}
                {(selectedLeadIds.size > 0 || warmBatchReview || warmBatchReviewError) && (
                  <WarmBatchReviewPanel
                    data={warmBatchReview}
                    loading={warmBatchReviewLoading}
                    error={warmBatchReviewError}
                    draftActionLoading={warmBatchDraftActionLoading}
                    draftActionError={warmBatchDraftActionError}
                    providerDraftCanaryLoading={warmProviderDraftCanaryLoadingQueueId != null}
                    providerDraftCanaryError={warmProviderDraftCanaryError}
                    providerDraftCanaryResult={warmProviderDraftCanaryResult}
                    selectedCount={selectedLeadIds.size}
                    onReview={reviewWarmBatch}
                    onCreateGmailDraftRecords={createWarmBatchGmailDraftRecords}
                    onPrepareProviderDraftCanary={prepareWarmProviderDraftCanary}
                  />
                )}
                <div className="flex items-center gap-2 mb-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && leads.every((l) => selectedLeadIds.has(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadIds(new Set(leads.map((l) => l.id)))
                        } else {
                          setSelectedLeadIds(new Set())
                        }
                      }}
                      className="rounded border-white/20"
                    />
                    Select all on this page
                  </label>
                </div>
                <div className="space-y-4">
                  <AnimatePresence>
                    {leads.map((lead) => (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`admin-console-card admin-console-interactive overflow-visible rounded-xl border ${
                          leadRowMenuOpenId === lead.id ? 'relative z-20' : ''
                        }`}
                      >
                        {/* Lead Card Header */}
                        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,auto)] xl:items-start">
                          <div className="flex min-w-0 items-start gap-3">
                          <label className="flex-shrink-0 pt-0.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.has(lead.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLeadIds((s) => new Set([...s, lead.id]))
                                } else {
                                  setSelectedLeadIds((s) => {
                                    const next = new Set(s)
                                    next.delete(lead.id)
                                    return next
                                  })
                                }
                              }}
                              className="rounded border-white/20"
                            />
                          </label>
                          {/* Temperature Icon */}
                          <div
                            className={`p-2 rounded-lg ${
                              isWarmLeadSource(lead.lead_source)
                                ? 'bg-orange-900/30 text-orange-400'
                                : 'bg-sky-500/10 text-sky-300'
                            }`}
                          >
                            {isWarmLeadSource(lead.lead_source) ? (
                              <Flame size={20} />
                            ) : (
                              <Snowflake size={20} />
                            )}
                          </div>

                          {/* Lead Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">
                                <Link
                                  href={`/admin/contacts/${lead.id}`}
                                  className="inline-flex items-center gap-1.5 text-foreground hover:text-teal-300 transition-colors underline decoration-dotted decoration-teal-400/70 underline-offset-4 hover:decoration-teal-300"
                                  title="Open contact record"
                                >
                                  <span>{lead.name}</span>
                                  <ExternalLink size={13} className="shrink-0 opacity-70 text-teal-400/90" aria-hidden />
                                </Link>
                              </h3>
                              {lead.lead_score !== null && (
                                <span className={`px-2 py-0.5 rounded text-xs ${getScoreBadgeColor(lead.lead_score)}`}>
                                  Score: {lead.lead_score}
                                </span>
                              )}
                              <span className="rounded border border-white/10 bg-silicon-slate/50 px-2 py-0.5 text-xs text-foreground">
                                {lead.lead_source
                                  ?.replace(/^(warm|cold)_/i, '') // Remove warm_ or cold_ prefix
                                  .replace(/_/g, ' ') // Replace all underscores with spaces
                                  .replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize first letter of each word
                                }
                              </span>
                              {lead.do_not_contact && (
                                <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 rounded text-xs">Do not contact</span>
                              )}
                              {lead.removed_at && (
                                <span className="px-2 py-0.5 bg-red-900/50 text-red-300 rounded text-xs">Removed</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                              {lead.job_title && (
                                <span className="flex items-center gap-1">
                                  <User size={12} />
                                  {lead.job_title}
                                </span>
                              )}
                              {lead.company && (
                                <span className="flex items-center gap-1">
                                  <Building2 size={12} />
                                  {lead.company}
                                </span>
                              )}
                              <Link
                                href={`/admin/email-center?contact=${lead.id}`}
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-sky-300 transition-colors underline decoration-dotted decoration-sky-400/50 underline-offset-2 hover:decoration-sky-300"
                                title={`Open Email center for this lead (${lead.messages_count} messages, ${lead.messages_sent} sent)`}
                                aria-label={`Open Email center for ${lead.name}`}
                              >
                                <Mail size={12} className="shrink-0" aria-hidden />
                                <span>
                                  {lead.messages_count} messages ({lead.messages_sent} sent)
                                </span>
                                <ExternalLink size={11} className="shrink-0 opacity-60" aria-hidden />
                              </Link>
                              {lead.has_reply && (
                                <span className="flex items-center gap-1 text-green-400">
                                  <CheckCircle size={12} />
                                  Replied
                                </span>
                              )}
                            </div>
                            {!lead.has_extractable_text && (
                              <p className="mt-1 text-xs text-amber-400">
                                No notes, diagnostic, or report data to extract. Add insights before pushing.
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {lead.evidence_count > 0 && (
                                <span className="inline-flex items-stretch rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-700 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setEvidenceDrawerContactId(lead.id)
                                      setEvidenceDrawerLoading(true)
                                      setEvidenceDrawerData(null)
                                      try {
                                        const session = await getCurrentSession()
                                        if (!session) return
                                        const res = await fetch(
                                          `/api/admin/value-evidence/evidence?contact_id=${lead.id}`,
                                          { headers: { Authorization: `Bearer ${session.access_token}` } }
                                        )
                                        const data = await res.json()
                                        if (res.ok) setEvidenceDrawerData(data)
                                      } finally {
                                        setEvidenceDrawerLoading(false)
                                      }
                                    }}
                                    className="px-2 py-1 hover:bg-green-800/50 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                                    aria-label={`View ${lead.evidence_count} evidence items for ${lead.name}`}
                                  >
                                    Evidence: {lead.evidence_count}
                                  </button>
                                  <Link
                                    href={`/admin/value-evidence?tab=dashboard&contactId=${lead.id}`}
                                    className="px-1.5 py-1 border-l border-green-700/70 hover:bg-green-800/60 flex items-center focus:outline-none focus:ring-2 focus:ring-green-500/40"
                                    title={`Open ${lead.name} in Value Evidence (workflow progress, run history)`}
                                    aria-label={`Open ${lead.name} in Value Evidence dashboard`}
                                  >
                                    <ExternalLink size={11} aria-hidden className="opacity-80" />
                                  </Link>
                                </span>
                              )}
                              {(() => {
                                const vepStaleMs = 10 * 60 * 1000
                                const isVepStalePending =
                                  lead.last_vep_status === 'pending' &&
                                  lead.evidence_count === 0 &&
                                  !!lead.last_vep_triggered_at &&
                                  Date.now() - new Date(lead.last_vep_triggered_at).getTime() > vepStaleMs
                                const isVepFreshPending =
                                  lead.last_vep_status === 'pending' &&
                                  lead.evidence_count === 0 &&
                                  !isVepStalePending
                                const showVepPushChip =
                                  lead.evidence_count === 0 &&
                                  (lead.last_vep_status !== 'pending' || isVepStalePending)

                                if (isVepFreshPending) {
                                  return (
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-700 flex items-center gap-1">
                                      <RefreshCw size={12} className="animate-spin" aria-hidden />
                                      Extracting…
                                    </span>
                                  )
                                }

                                if (!showVepPushChip) return null

                                const failed = lead.last_vep_status === 'failed'
                                const chipLabel = failed
                                  ? 'Push failed'
                                  : isVepStalePending
                                    ? 'Stalled — retry'
                                    : 'No evidence'
                                const canPush = lead.has_extractable_text && !pushLoading
                                const pushTitle = !lead.has_extractable_text
                                  ? 'Add notes, diagnostic, or report data before pushing to Value Evidence'
                                  : failed || isVepStalePending
                                    ? 'Open review and retry Value Evidence extraction'
                                    : 'Open review and push to Value Evidence'

                                return (
                                  <button
                                    type="button"
                                    disabled={!canPush}
                                    onClick={() => openReviewEnrichModal([lead.id])}
                                    title={pushTitle}
                                    aria-label={pushTitle}
                                    className={`group inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-radiant-gold/40 ${
                                      failed
                                        ? 'bg-red-900/35 text-red-200 border-red-700/60 enabled:hover:bg-radiant-gold/20 enabled:hover:text-radiant-gold enabled:hover:border-radiant-gold/50'
                                        : isVepStalePending
                                          ? 'bg-amber-900/35 text-amber-200 border-amber-700/60 enabled:hover:bg-radiant-gold/20 enabled:hover:text-radiant-gold enabled:hover:border-radiant-gold/50'
                                          : 'bg-silicon-slate/80 text-foreground/85 border-white/10 enabled:hover:bg-radiant-gold/20 enabled:hover:text-radiant-gold enabled:hover:border-radiant-gold/50'
                                    } disabled:opacity-55 disabled:cursor-not-allowed`}
                                  >
                                    <span>{chipLabel}</span>
                                    {canPush && (
                                      <Cpu size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden />
                                    )}
                                  </button>
                                )
                              })()}
                            </div>
                          </div>
                          </div>

                          {/* Actions — primary CTA + progressive fallback + More + expand */}
                          <div className="flex w-full min-w-0 flex-wrap items-start justify-end gap-2 sm:flex-nowrap xl:w-[min(36rem,42vw)]">
                            <button
                              type="button"
                              onClick={() => {
                                setOutreachWorkroomLeadId(lead.id)
                                setLeadRowMenuOpenId(null)
                              }}
                              className={`inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors sm:w-auto sm:min-w-[10rem] ${
                                outreachWorkroomLeadId === lead.id
                                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                                  : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                              }`}
                              aria-current={outreachWorkroomLeadId === lead.id ? 'true' : undefined}
                            >
                              <MessageSquare size={16} className="shrink-0" aria-hidden />
                              <span className="truncate">
                                {outreachWorkroomLeadId === lead.id ? 'Workroom open' : 'Open Outreach'}
                              </span>
                            </button>

                            {/* More actions — grouped dropdown */}
                            <div className="relative shrink-0" id={`lead-actions-wrap-${lead.id}`}>
                              <button
                                type="button"
                                aria-expanded={leadRowMenuOpenId === lead.id}
                                aria-haspopup="menu"
                                aria-label="More lead actions"
                                onClick={() =>
                                  setLeadRowMenuOpenId(leadRowMenuOpenId === lead.id ? null : lead.id)
                                }
                                className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-foreground/90 transition-colors flex items-center justify-center"
                              >
                                <MoreHorizontal size={18} />
                              </button>
                              {leadRowMenuOpenId === lead.id && (
                                <div
                                  role="menu"
                                  className="absolute right-0 top-full mt-1 z-50 min-w-[14rem] rounded-lg border border-white/10 bg-background py-1 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
                                >
                                  {/* Compose & in-app generation live on the lead row (OutreachEmailGenerateRow). */}

                                  {/* Research & intel */}
                                  <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Research</div>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-silicon-slate/60 flex items-center gap-2"
                                    onClick={() => {
                                      setLeadRowMenuOpenId(null)
                                      setSocialIntelLeadId(lead.id)
                                    }}
                                  >
                                    <Globe size={14} className="shrink-0 opacity-80" />
                                    Social Intel
                                  </button>
                                  {lead.evidence_count > 0 && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-silicon-slate/60 flex items-center gap-2"
                                      disabled={pushLoading}
                                      onClick={async () => {
                                        setLeadRowMenuOpenId(null)
                                        const session = await getCurrentSession()
                                        if (!session) return
                                        setPushLoading(true)
                                        try {
                                          const res = await fetch('/api/admin/value-evidence/extract-leads', {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              Authorization: `Bearer ${session.access_token}`,
                                            },
                                            body: JSON.stringify({
                                              leads: [{ contact_submission_id: lead.id }],
                                            }),
                                          })
                                          if (res.ok) {
                                            startVepPolling()
                                            await fetchLeads()
                                            if (evidenceDrawerContactId === lead.id) {
                                              const r = await fetch(
                                                `/api/admin/value-evidence/evidence?contact_id=${lead.id}`,
                                                { headers: { Authorization: `Bearer ${session.access_token}` } }
                                              )
                                              const d = await r.json()
                                              if (r.ok) setEvidenceDrawerData(d)
                                            }
                                          }
                                        } finally {
                                          setPushLoading(false)
                                        }
                                      }}
                                    >
                                      <RefreshCw size={14} className="shrink-0 opacity-80" />
                                      Refresh evidence
                                    </button>
                                  )}

                                  {/* Value Evidence */}
                                  <div className="border-t border-silicon-slate my-1" />
                                  <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Value Evidence</div>
                                  <Link
                                    href={`/admin/value-evidence?tab=dashboard&contactId=${lead.id}`}
                                    role="menuitem"
                                    onClick={() => setLeadRowMenuOpenId(null)}
                                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-silicon-slate/60 flex items-center gap-2"
                                    aria-label={`Open ${lead.name} in Value Evidence dashboard`}
                                  >
                                    <ExternalLink size={14} className="shrink-0 opacity-80" aria-hidden />
                                    Open in Value Evidence
                                  </Link>
                                  {(() => {
                                    const vepStaleMs = 10 * 60 * 1000
                                    const isVepStalePending =
                                      lead.last_vep_status === 'pending' &&
                                      lead.evidence_count === 0 &&
                                      !!lead.last_vep_triggered_at &&
                                      Date.now() - new Date(lead.last_vep_triggered_at).getTime() > vepStaleMs
                                    const failed = lead.last_vep_status === 'failed'
                                    if (!failed && !isVepStalePending) return null
                                    return (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="w-full text-left px-3 py-2 text-sm text-amber-200 hover:bg-silicon-slate/60 flex items-center gap-2"
                                        disabled={pushLoading || !lead.has_extractable_text}
                                        title={
                                          !lead.has_extractable_text
                                            ? 'Add notes, diagnostic, or report data before retrying'
                                            : 'Open review and retry Value Evidence extraction'
                                        }
                                        onClick={() => {
                                          setLeadRowMenuOpenId(null)
                                          void openReviewEnrichModal([lead.id])
                                        }}
                                      >
                                        <RefreshCw size={14} className="shrink-0 opacity-80" aria-hidden />
                                        Retry extraction
                                      </button>
                                    )
                                  })()}

                                  {/* Pipeline */}
                                  <div className="border-t border-silicon-slate my-1" />
                                  <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Pipeline</div>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-silicon-slate/60 flex items-center gap-2"
                                    onClick={() => {
                                      setLeadRowMenuOpenId(null)
                                      void openReviewEnrichModal([lead.id])
                                    }}
                                  >
                                    <Edit3 size={14} className="shrink-0 opacity-80" />
                                    Review and edit
                                  </button>

                                  {/* Background jobs (conditional) */}
                                  {lead.last_vep_status === 'pending' && lead.evidence_count === 0 && (
                                    <>
                                      <div className="border-t border-silicon-slate my-1" />
                                      <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Background jobs</div>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="w-full text-left px-3 py-2 text-sm text-amber-300 hover:bg-silicon-slate/60 flex items-center gap-2"
                                        disabled={pushLoading}
                                        onClick={async () => {
                                          setLeadRowMenuOpenId(null)
                                          const session = await getCurrentSession()
                                          if (!session) return
                                          setPushLoading(true)
                                          try {
                                            const res = await fetch('/api/admin/value-evidence/extract-leads/cancel', {
                                              method: 'POST',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${session.access_token}`,
                                              },
                                              body: JSON.stringify({ contact_submission_ids: [lead.id] }),
                                            })
                                            if (res.ok) await fetchLeads()
                                          } finally {
                                            setPushLoading(false)
                                          }
                                        }}
                                      >
                                        <X size={14} className="shrink-0 opacity-80" />
                                        Cancel extraction
                                      </button>
                                    </>
                                  )}

                                  {/* Danger */}
                                  <div className="border-t border-silicon-slate my-1" />
                                  {!lead.removed_at && lead.do_not_contact && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full text-left px-3 py-2 text-sm text-emerald-300 hover:bg-silicon-slate/60 flex items-center gap-2"
                                      disabled={leadActionId === lead.id}
                                      onClick={() => {
                                        setLeadRowMenuOpenId(null)
                                        void updateLeadDncOrRemoved(lead.id, { do_not_contact: false })
                                      }}
                                    >
                                      <RotateCcw size={14} className="shrink-0 opacity-80" />
                                      Allow contact again
                                    </button>
                                  )}
                                  {!lead.do_not_contact && !lead.removed_at && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full text-left px-3 py-2 text-sm text-amber-200 hover:bg-silicon-slate/60 flex items-center gap-2"
                                      disabled={leadActionId === lead.id}
                                      title="Will not be overwritten by future ingest"
                                      onClick={() => {
                                        setLeadRowMenuOpenId(null)
                                        void updateLeadDncOrRemoved(lead.id, { do_not_contact: true })
                                      }}
                                    >
                                      <ShieldOff size={14} className="shrink-0 opacity-80" />
                                      Do not contact
                                    </button>
                                  )}
                                  {!lead.removed_at ? (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-red-950/40 flex items-center gap-2"
                                      disabled={leadActionId === lead.id}
                                      onClick={() => {
                                        setLeadRowMenuOpenId(null)
                                        if (
                                          window.confirm(
                                            `Remove "${lead.name}" from the lead list? You can restore from "Removed" view.`
                                          )
                                        ) {
                                          void updateLeadDncOrRemoved(lead.id, {
                                            removed_at: new Date().toISOString(),
                                          })
                                        }
                                      }}
                                    >
                                      <Trash2 size={14} className="shrink-0 opacity-80" />
                                      Remove from list
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="w-full text-left px-3 py-2 text-sm text-green-300 hover:bg-silicon-slate/60 flex items-center gap-2"
                                      disabled={leadActionId === lead.id}
                                      onClick={() => {
                                        setLeadRowMenuOpenId(null)
                                        void updateLeadDncOrRemoved(lead.id, { removed_at: null })
                                      }}
                                    >
                                      <RotateCcw size={14} className="shrink-0 opacity-80" />
                                      Restore to list
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Expand / collapse */}
                            <button
                              onClick={() =>
                                setExpandedLeadFromControl(expandedLeadId === lead.id ? null : lead.id)
                              }
                              aria-expanded={expandedLeadId === lead.id}
                              aria-label={`${expandedLeadId === lead.id ? 'Collapse' : 'Expand'} details for ${lead.name}`}
                              className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-muted-foreground"
                            >
                              {expandedLeadId === lead.id ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Lead Details */}
                        <AnimatePresence>
                          {expandedLeadId === lead.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-silicon-slate overflow-hidden rounded-b-xl"
                            >
                              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <RelationshipPacketPanel
                                  authToken={authToken}
                                  loading={relationshipPacketLeadId === lead.id && relationshipPacketLoading}
                                  error={relationshipPacketLeadId === lead.id ? relationshipPacketError : null}
                                  data={relationshipPacketLeadId === lead.id ? relationshipPacketData : null}
                                  inertSlackApprovalRequest={warmSlackSendApprovalQaMode}
                                  gmailDraftCanaryLoading={gmailDraftCanaryLoadingLeadId === lead.id}
                                  gmailDraftCanaryError={gmailDraftCanaryErrors[lead.id] ?? null}
                                  gmailDraftCanaryResult={gmailDraftCanaryResults[lead.id] ?? null}
                                  onGmailDraftCanary={() => { void runGmailDraftCanary(lead.id) }}
                                  smsTelnyxCanaryLoading={smsTelnyxCanaryLoadingLeadId === lead.id}
                                  smsTelnyxCanaryError={smsTelnyxCanaryErrors[lead.id] ?? null}
                                  smsTelnyxCanaryResult={smsTelnyxCanaryResults[lead.id] ?? null}
                                  onSmsTelnyxNoSendCanary={() => { void runSmsTelnyxNoSendCanary(lead.id) }}
                                />

                                {/* Contact Info */}
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
                                  <div className="space-y-2 text-sm">
                                    {lead.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail size={14} className="text-muted-foreground" />
                                        <a href={`mailto:${lead.email}`} className="text-sky-300 hover:text-sky-200">
                                          {lead.email}
                                        </a>
                                      </div>
                                    )}
                                    {lead.linkedin_url && (
                                      <div className="flex items-center gap-2">
                                        <Linkedin size={14} className="text-muted-foreground" />
                                        <a
                                          href={lead.linkedin_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
                                        >
                                          LinkedIn Profile
                                          <ExternalLink size={12} />
                                        </a>
                                      </div>
                                    )}
                                    {lead.job_title && (
                                      <div className="flex items-center gap-2">
                                        <User size={14} className="text-muted-foreground" />
                                        <span className="text-foreground">{lead.job_title}</span>
                                      </div>
                                    )}
                                    {lead.phone_number && (
                                      <div className="flex items-center gap-2">
                                        <Phone size={14} className="text-muted-foreground" />
                                        <a href={`tel:${lead.phone_number}`} className="text-foreground hover:text-radiant-gold">
                                          {lead.phone_number}
                                        </a>
                                      </div>
                                    )}
                                    {lead.industry && (
                                      <div className="flex items-center gap-2">
                                        <Briefcase size={14} className="text-muted-foreground" />
                                        <span className="text-foreground">{lead.industry}</span>
                                      </div>
                                    )}
                                    {lead.company_domain && (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Globe size={14} className="text-muted-foreground" />
                                        <a
                                          href={lead.company_domain.startsWith('http') ? lead.company_domain : `https://${lead.company_domain}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-sky-300 hover:text-sky-200"
                                        >
                                          {lead.company_domain}
                                          <ExternalLink size={12} />
                                        </a>
                                        {lead.website_tech_stack?.technologies?.length ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setTechStackResult({
                                                domain: lead.website_tech_stack!.domain ?? lead.company_domain ?? '',
                                                technologies: lead.website_tech_stack!.technologies as Array<{ name: string; tag?: string; categories?: string[] }>,
                                                byTag: lead.website_tech_stack!.byTag,
                                              })
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                          >
                                            <CheckCircle size={12} />
                                            Tech stack loaded ({lead.website_tech_stack.technologies.length})
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            disabled={techStackLoading}
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              const session = await getCurrentSession()
                                              if (!session?.access_token) return
                                              setTechStackResult(null)
                                              setTechStackLoading(true)
                                              try {
                                                const res = await fetch(
                                                  `/api/admin/tech-stack-lookup?domain=${encodeURIComponent(lead.company_domain ?? '')}`,
                                                  { headers: { Authorization: `Bearer ${session.access_token}` } }
                                                )
                                                const data = await res.json()
                                                if (!res.ok) {
                                                  setTechStackResult({
                                                    domain: lead.company_domain ?? '',
                                                    error: data.error ?? 'Lookup failed',
                                                    creditsRemaining: data.creditsRemaining,
                                                  })
                                                  return
                                                }
                                                setTechStackResult({
                                                  domain: data.domain,
                                                  technologies: data.technologies,
                                                  byTag: data.byTag,
                                                  creditsRemaining: data.creditsRemaining,
                                                })
                                                const savedPayload = {
                                                  domain: data.domain,
                                                  technologies: data.technologies,
                                                  byTag: data.byTag,
                                                  creditsRemaining: typeof data.creditsRemaining === 'number' ? data.creditsRemaining : null,
                                                }
                                                await fetch(`/api/admin/outreach/leads/${lead.id}`, {
                                                  method: 'PATCH',
                                                  headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: `Bearer ${session.access_token}`,
                                                  },
                                                  body: JSON.stringify({
                                                    website_tech_stack: savedPayload,
                                                    website_tech_stack_fetched_at: new Date().toISOString(),
                                                  }),
                                                })
                                                setLeads((prev) =>
                                                  prev.map((l) =>
                                                    l.id === lead.id
                                                      ? { ...l, website_tech_stack: savedPayload } as typeof l
                                                      : l
                                                  )
                                                )
                                              } catch {
                                                setTechStackResult({
                                                  domain: lead.company_domain ?? '',
                                                  error: 'Request failed. Check BUILTWITH_API_KEY if configured.',
                                                })
                                              } finally {
                                                setTechStackLoading(false)
                                              }
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs border bg-silicon-slate/60 hover:bg-silicon-slate text-foreground/90 border-silicon-slate disabled:opacity-60 disabled:cursor-not-allowed"
                                          >
                                            {techStackLoading ? (
                                              <Loader2 size={12} className="animate-spin" />
                                            ) : (
                                              <Cpu size={12} />
                                            )}
                                            {techStackLoading ? 'Loading…' : 'Fetch tech stack'}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Scores & Status */}
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Lead Intelligence</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    {lead.lead_score !== null && (
                                      <div className="bg-background/60 rounded-lg p-3">
                                        <div className="text-muted-foreground text-xs">Lead Score</div>
                                        <div className="text-lg font-bold">{lead.lead_score}</div>
                                      </div>
                                    )}
                                    {lead.ai_readiness_score !== null && (
                                      <div className="bg-background/60 rounded-lg p-3">
                                        <div className="text-muted-foreground text-xs">AI Readiness</div>
                                        <div className="text-lg font-bold">{lead.ai_readiness_score}/10</div>
                                      </div>
                                    )}
                                    {lead.competitive_pressure_score !== null && (
                                      <div className="bg-background/60 rounded-lg p-3">
                                        <div className="text-muted-foreground text-xs">Competitive Pressure</div>
                                        <div className="text-lg font-bold">{lead.competitive_pressure_score}/10</div>
                                      </div>
                                    )}
                                    <div className="bg-background/60 rounded-lg p-3">
                                      <div className="text-muted-foreground text-xs">Status</div>
                                      <div className="text-sm font-medium capitalize">{lead.outreach_status.replace('_', ' ')}</div>
                                    </div>
                                  </div>

                                  {(() => {
                                    const fromDb = formatQuickWinsForDisplay(lead.quick_wins as unknown)
                                    const meetingsForLead =
                                      leadMeetingsContactId === lead.id ? leadMeetings : []
                                    const fromMeetings =
                                      !fromDb && meetingsForLead.length > 0
                                        ? formatQuickWinsForDisplay(
                                            collectQuickWinTitlesFromMeetingRows(meetingsForLead, { maxLines: 15 })
                                          )
                                        : null
                                    const quickWinsText = fromDb || fromMeetings
                                    if (!quickWinsText) return null
                                    return (
                                      <div className="mt-3 bg-background/60 rounded-lg p-3">
                                        <div className="text-muted-foreground text-xs mb-1 flex items-center justify-between gap-2">
                                          <span>Quick Wins</span>
                                          {fromMeetings && !fromDb && (
                                            <span className="text-[10px] font-normal text-muted-foreground/80">
                                              From meeting notes
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-sm text-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">
                                          {quickWinsText}
                                        </div>
                                      </div>
                                    )
                                  })()}

                                  {/* Meeting action items attributed to this lead */}
                                  {expandedLeadId === lead.id && (leadActionTasksLoading || leadActionTasks.length > 0) && (
                                    <div className="mt-3 bg-background/60 rounded-lg p-3">
                                      <div className="text-muted-foreground text-xs mb-2 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                          <CheckCircle size={12} />
                                          Meeting action items
                                          {leadActionTasks.length > 0 && (
                                            <span className="text-muted-foreground/70">
                                              ({leadActionTasks.filter(t => t.status !== 'complete' && t.status !== 'cancelled').length} open
                                              {' / '}{leadActionTasks.length} total)
                                            </span>
                                          )}
                                        </span>
                                        <Link
                                          href={buildLinkWithReturn(
                                            `/admin/meeting-tasks?contact_submission_id=${lead.id}`,
                                            `/admin/outreach?tab=leads&id=${lead.id}`
                                          )}
                                          className="text-[11px] text-radiant-gold hover:text-amber-300"
                                        >
                                          Manage →
                                        </Link>
                                      </div>
                                      {leadActionTasksLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <RefreshCw size={12} className="animate-spin" /> Loading…
                                        </div>
                                      ) : (
                                        <ul className="space-y-1.5">
                                          {leadActionTasks.slice(0, 6).map((t) => (
                                            <li key={t.id} className="flex items-center gap-2 text-xs">
                                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                t.status === 'complete' ? 'bg-emerald-500'
                                                  : t.status === 'cancelled' ? 'bg-silicon-slate'
                                                  : t.status === 'in_progress' ? 'bg-sky-400'
                                                  : 'bg-amber-500'
                                              }`} />
                                              <span className={`truncate flex-1 ${
                                                t.status === 'complete' || t.status === 'cancelled'
                                                  ? 'text-muted-foreground line-through'
                                                  : 'text-foreground'
                                              }`}>
                                                {t.title}
                                              </span>
                                              {t.task_category === 'outreach' && (
                                                <span className="rounded border border-radiant-gold/30 bg-radiant-gold/10 px-1 py-0.5 text-[10px] text-radiant-gold">
                                                  outreach
                                                </span>
                                              )}
                                              {t.outreach_queue_id && (
                                                <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" title="An outreach draft has been generated for this task">
                                                  draft
                                                </span>
                                              )}
                                            </li>
                                          ))}
                                          {leadActionTasks.length > 6 && (
                                            <li className="text-[11px] text-muted-foreground pt-1">
                                              + {leadActionTasks.length - 6} more
                                            </li>
                                          )}
                                        </ul>
                                      )}
                                    </div>
                                  )}

                                  {/* Related meetings for this lead */}
                                  {expandedLeadId === lead.id &&
                                    (leadMeetingsLoading ||
                                      (leadMeetingsContactId === lead.id && leadMeetings.length > 0)) && (
                                    <div className="mt-3 bg-background/60 rounded-lg p-3">
                                      <div className="text-muted-foreground text-xs mb-2 flex items-center gap-1.5">
                                        <Video size={12} />
                                        Related Meetings
                                      </div>
                                      {leadMeetingsLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <RefreshCw size={12} className="animate-spin" /> Loading…
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-2">
                                          {(leadMeetingsContactId === lead.id ? leadMeetings : []).map((m) => (
                                            <Link
                                              key={m.id}
                                              href={buildLinkWithReturn(`/admin/meetings/${m.id}`, `/admin/outreach?tab=leads&id=${lead.id}`)}
                                              className="inline-flex items-center gap-1.5 rounded-md border border-radiant-gold/30 bg-radiant-gold/10 px-2.5 py-1 text-xs text-radiant-gold transition-colors hover:bg-radiant-gold/20"
                                            >
                                              <Video size={12} />
                                              {m.meeting_type.replace(/_/g, ' ')}
                                              <span className="text-radiant-gold/70">
                                                {new Date(m.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                              </span>
                                            </Link>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {lead.has_sales_conversation ? (
                                    <div className="mt-3">
                                      <Link
                                        href={lead.latest_session_id
                                          ? buildLinkWithReturn(`/admin/sales/conversation/${lead.latest_session_id}`, `/admin/outreach?tab=leads&id=${lead.id}`)
                                          : '/admin/sales'}
                                        className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300"
                                      >
                                        <CheckCircle size={14} />
                                        View Sales Conversation
                                        {lead.session_count > 1 && <span className="text-xs text-muted-foreground">({lead.session_count} sessions)</span>}
                                      </Link>
                                    </div>
                                  ) : (
                                    <div className="mt-3">
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation()
                                          const authSession = await getCurrentSession()
                                          if (!authSession?.access_token) return
                                          try {
                                            const res = await fetch('/api/admin/sales/sessions', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
                                              body: JSON.stringify({
                                                client_name: lead.name,
                                                client_email: lead.email,
                                                client_company: lead.company,
                                                contact_submission_id: lead.id,
                                                funnel_stage: 'prospect',
                                              }),
                                            })
                                            if (res.ok) {
                                              const data = await res.json()
                                              router.push(buildLinkWithReturn(`/admin/sales/conversation/${data.data.id}`, `/admin/outreach?tab=leads&id=${lead.id}`))
                                            }
                                          } catch (err) {
                                            console.error('Failed to start conversation:', err)
                                          }
                                        }}
                                        className="flex items-center gap-2 text-sm text-radiant-gold hover:text-amber-300"
                                      >
                                        <MessageSquare size={14} />
                                        Start Conversation
                                      </button>
                                    </div>
                                  )}

                                  {/* Chat escalations for this contact */}
                                  <div className="mt-4 pt-4 border-t border-silicon-slate">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                      <AlertTriangle size={14} />
                                      Chat escalations for this contact
                                    </h4>
                                    {leadEscalationsLoading ? (
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <RefreshCw size={14} className="animate-spin" />
                                        Loading…
                                      </div>
                                    ) : leadEscalations.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">None</p>
                                    ) : (
                                      <ul className="space-y-1">
                                        {leadEscalations.map((e) => (
                                          <li key={e.id}>
                                            <Link
                                              href={buildLinkWithReturn(`/admin/outreach/escalations/${e.id}`, `/admin/outreach?tab=leads&id=${lead.id}`)}
                                              className="text-sm text-radiant-gold hover:text-amber-400"
                                            >
                                              {new Date(e.escalated_at).toLocaleString()} — {e.source} · {e.reason ?? 'escalation'}
                                            </Link>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Pagination */}
                {leadsTotal > leadsPerPage && (
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {(leadsPage - 1) * leadsPerPage + 1} to {Math.min(leadsPage * leadsPerPage, leadsTotal)} of {leadsTotal} leads
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                        disabled={leadsPage === 1}
                        className="admin-console-button-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {leadsPage} of {Math.ceil(leadsTotal / leadsPerPage)}
                      </span>
                      <button
                        onClick={() => setLeadsPage(p => p + 1)}
                        disabled={leadsPage >= Math.ceil(leadsTotal / leadsPerPage)}
                        className="admin-console-button-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            </>
            )}

        {/* Escalations Tab Content */}
        {activeTab === 'escalations' && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Filter size={14} className="text-muted-foreground" />
              <select
                value={escalationsLinkedFilter}
                onChange={(e) => setEscalationsLinkedFilter(e.target.value as 'all' | 'linked' | 'unlinked')}
                className="bg-silicon-slate/50 text-foreground border border-white/10 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Escalations</option>
                <option value="linked">Linked to lead</option>
                <option value="unlinked">Not linked</option>
              </select>
            </div>
            {escalationsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw size={24} className="animate-spin" />
              </div>
            ) : escalations.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground rounded-lg border border-silicon-slate bg-silicon-slate/30">
                No chat escalations yet. Escalations appear when a visitor requests a human or the bot cannot adequately respond.
              </div>
            ) : (
              <div className="rounded-lg border border-silicon-slate overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-silicon-slate/50 border-b border-silicon-slate">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Source</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Contact</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Linked lead</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Reason</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalations.map((e) => (
                      <tr key={e.id} className="border-b border-silicon-slate/50 hover:bg-silicon-slate/30">
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(e.escalated_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm capitalize">{e.source}</td>
                        <td className="px-4 py-3 text-sm">
                          {e.visitor_name || '—'} | {e.visitor_email || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {e.contact_submissions ? (
                            <Link href={`/admin/outreach?tab=leads&id=${e.contact_submission_id}`} className="text-radiant-gold hover:text-amber-300">
                              {e.contact_submissions.name || e.contact_submissions.email || 'Lead'}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">Not linked</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{e.reason ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={buildLinkWithReturn(`/admin/outreach/escalations/${e.id}`, '/admin/outreach?tab=escalations')}
                            className="text-sm text-radiant-gold hover:text-amber-400"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {escalationsTotal > escalationsPerPage && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(escalationsPage - 1) * escalationsPerPage + 1} to {Math.min(escalationsPage * escalationsPerPage, escalationsTotal)} of {escalationsTotal}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEscalationsPage(p => Math.max(1, p - 1))}
                    disabled={escalationsPage === 1}
                    className="admin-console-button-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {escalationsPage} of {Math.ceil(escalationsTotal / escalationsPerPage)}
                  </span>
                  <button
                    onClick={() => setEscalationsPage(p => p + 1)}
                    disabled={escalationsPage >= Math.ceil(escalationsTotal / escalationsPerPage)}
                    className="admin-console-button-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
