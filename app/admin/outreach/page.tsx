'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isWarmLeadSource } from '@/lib/constants/lead-source'
import {
  Mail,
  Linkedin,
  CheckCircle,
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
import { OutreachEmailGenerateRow } from '@/components/admin/OutreachEmailGenerateRow'
import { useRealtimeOutreach } from '@/lib/hooks/useRealtimeOutreach'
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

type TabType = 'leads' | 'escalations'

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
    return searchParams?.get('status') || 'all'
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
    const id = searchParams?.get('id')
    return id ? parseInt(id) : null
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

  // Add lead modal
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)

  // Value evidence: lead selection and push
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set())
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

  const fetchLeads = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) setLeadsLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

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
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error)
    } finally {
      if (!silent) setLeadsLoading(false)
    }
  }, [leadsTempFilter, leadsStatusFilter, leadsSourceFilter, leadsVisibilityFilter, leadsSearch, leadsPage, leadsPerPage])

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

  // VEP extraction polling: start/stop based on vepPollingActive flag
  const startVepPolling = useCallback(() => {
    if (vepPollingRef.current) return // already polling
    setVepPollingActive(true)
    vepPollingRef.current = setInterval(async () => {
      const session = await getCurrentSession()
      if (!session) return
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
        // Stop when no VEP and no n8n CLG run is still "pending" on the current page
        const hasVepPending = data.leads.some((l: Lead) => l.last_vep_status === 'pending')
        const hasN8nPending = data.leads.some((l: Lead) => l.last_n8n_outreach_status === 'pending')
        if (!hasVepPending && !hasN8nPending && vepPollingRef.current) {
          clearInterval(vepPollingRef.current)
          vepPollingRef.current = null
          setVepPollingActive(false)
        }
      }
    }, 4000)
  }, [leadsTempFilter, leadsStatusFilter, leadsSourceFilter, leadsVisibilityFilter, leadsSearch, leadsPage, leadsPerPage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vepPollingRef.current) {
        clearInterval(vepPollingRef.current)
        vepPollingRef.current = null
      }
    }
  }, [])

  // If the list already has a pending n8n CLG run (e.g. after refresh), keep polling like VEP
  useEffect(() => {
    if (activeTab !== 'leads') return
    if (leads.some((l) => l.last_n8n_outreach_status === 'pending' || l.last_vep_status === 'pending')) {
      startVepPolling()
    }
  }, [activeTab, leads, startVepPolling])

  // Realtime push updates (Supabase Realtime → Postgres logical replication):
  // flips pills and refreshes "Email — recent" the moment n8n CLG-002 marks a
  // run success/failed OR a new outreach_queue row is inserted. Fallback polling
  // (startVepPolling, 4s) remains as a safety net in case Realtime drops events.
  useRealtimeOutreach({
    enabled: activeTab === 'leads',
    visibleContactIds: activeTab === 'leads' ? leads.map((l) => l.id) : null,
    onEvent: () => {
      void fetchLeads({ silent: true })
    },
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

  // Fetch escalations for the expanded lead (for "Chat escalations for this contact")
  useEffect(() => {
    if (activeTab !== 'leads' || !expandedLeadId) {
      setLeadEscalations([])
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
  }, [activeTab, expandedLeadId])

  // Fetch related meetings for the expanded lead
  useEffect(() => {
    if (activeTab !== 'leads' || !expandedLeadId) {
      setLeadMeetings([])
      setLeadMeetingsContactId(null)
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
  }, [activeTab, expandedLeadId])

  // Fetch meeting action tasks attributed to this contact (via contact_submission_id)
  useEffect(() => {
    if (activeTab !== 'leads' || !expandedLeadId) {
      setLeadActionTasks([])
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
  }, [activeTab, expandedLeadId])

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

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Lead Pipeline' },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold gradient-text">
              Lead Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
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
          <div className="flex items-center gap-3">
            {activeTab === 'leads' && (
              <button
                type="button"
                onClick={() => setShowAddLeadModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 btn-gold text-imperial-navy rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                Add lead
              </button>
            )}
            <Link href="/admin/outreach/dashboard">
              <button className="flex items-center gap-2 px-4 py-2 btn-gold text-imperial-navy font-semibold rounded-lg transition-colors">
                <BarChart3 size={16} />
                Dashboard & Triggers
              </button>
            </Link>
            <button
              onClick={() => {
                if (activeTab === 'leads') void fetchLeads()
                else void fetchEscalations()
              }}
              className="flex items-center gap-2 px-4 py-2 btn-ghost rounded-lg transition-colors"
            >
              <RefreshCw size={16} className={(leadsLoading || escalationsLoading) ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
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
              <span className="px-2 py-0.5 bg-orange-500/80 text-white text-xs font-semibold rounded-full">
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
              <Filter size={14} className="text-gray-500" />
              <select
                value={leadsTempFilter}
                onChange={(e) => setLeadsTempFilter(e.target.value as 'all' | 'warm' | 'cold')}
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Leads</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </select>
              <select
                value={leadsStatusFilter}
                onChange={(e) => setLeadsStatusFilter(e.target.value)}
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="booked">Booked</option>
                <option value="opted_out">Opted Out</option>
              </select>
              <select
                value={leadsSourceFilter}
                onChange={(e) => setLeadsSourceFilter(e.target.value)}
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
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
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
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
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
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
                  <div className="sticky top-0 z-10 mb-4 p-3 bg-background/95 border border-silicon-slate rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-foreground">
                      {selectedLeadIds.size} lead(s) selected
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openReviewEnrichModal([...selectedLeadIds])}
                        disabled={pushLoading || selectedLeadIds.size === 0 || selectedLeadIds.size > 50}
                        className="px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 rounded-lg font-medium text-sm"
                      >
                        {pushLoading ? 'Loading...' : 'Push to Value Evidence'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLeadIds(new Set())}
                        className="text-sm text-muted-foreground hover:text-white"
                      >
                        Clear selection
                      </button>
                    </div>
                  </div>
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
                        className={`bg-silicon-slate/50 border border-silicon-slate rounded-xl overflow-visible ${
                          leadRowMenuOpenId === lead.id ? 'relative z-20' : ''
                        }`}
                      >
                        {/* Lead Card Header */}
                        <div className="p-4 flex items-start gap-3">
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
                                : 'bg-blue-900/30 text-blue-400'
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
                              <h3 className="font-semibold text-white">
                                <Link
                                  href={`/admin/contacts/${lead.id}`}
                                  className="inline-flex items-center gap-1.5 text-white hover:text-teal-300 transition-colors underline decoration-dotted decoration-teal-400/70 underline-offset-4 hover:decoration-teal-300"
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
                              <span className="px-2 py-0.5 bg-gray-800 text-foreground rounded text-xs">
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
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
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
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-blue-300 transition-colors underline decoration-dotted decoration-blue-400/50 underline-offset-2 hover:decoration-blue-300"
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
                                    className={`group inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
                                      failed
                                        ? 'bg-red-900/35 text-red-200 border-red-700/60 enabled:hover:bg-purple-600/85 enabled:hover:text-white enabled:hover:border-purple-400'
                                        : isVepStalePending
                                          ? 'bg-amber-900/35 text-amber-200 border-amber-700/60 enabled:hover:bg-purple-600/85 enabled:hover:text-white enabled:hover:border-purple-400'
                                          : 'bg-gray-700/90 text-foreground/85 border-gray-600 enabled:hover:bg-purple-600/85 enabled:hover:text-white enabled:hover:border-purple-400'
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

                          {/* Actions — primary CTA + progressive fallback + More + expand */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Primary CTA: pipeline-style pill (idle / running / succeeded / failed / cancelled / link). */}
                            <OutreachEmailGenerateRow
                              lead={lead}
                              n8nFallback={n8nFailedLeadIds.has(lead.id)}
                              onToast={(msg) => {
                                setGenerateOutreachToast(msg)
                                setTimeout(() => setGenerateOutreachToast(null), 6000)
                              }}
                              onFallbackAvailable={() => {
                                setN8nFailedLeadIds((prev) => new Set([...prev, lead.id]))
                              }}
                              onFallbackCleared={() => {
                                setN8nFailedLeadIds((prev) => {
                                  const next = new Set(prev)
                                  next.delete(lead.id)
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
                                  className="absolute right-0 top-full mt-1 z-50 min-w-[14rem] py-1 rounded-lg border border-silicon-slate bg-background shadow-xl"
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
                                setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)
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
                                {/* Contact Info */}
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Contact Information</h4>
                                  <div className="space-y-2 text-sm">
                                    {lead.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail size={14} className="text-muted-foreground" />
                                        <a href={`mailto:${lead.email}`} className="text-blue-400 hover:text-blue-300">
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
                                        <a href={`tel:${lead.phone_number}`} className="text-foreground hover:text-white">
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
                                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
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
                                          className="text-[11px] text-violet-400 hover:text-violet-300"
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
                                                  : t.status === 'cancelled' ? 'bg-gray-600'
                                                  : t.status === 'in_progress' ? 'bg-blue-500'
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
                                                <span className="text-[10px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
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
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-900/30 text-violet-300 border border-violet-800/50 text-xs hover:bg-violet-800/40 transition-colors"
                                            >
                                              <Video size={12} />
                                              {m.meeting_type.replace(/_/g, ' ')}
                                              <span className="text-violet-400/70">
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
                                        className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
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
                        className="px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg hover:bg-silicon-slate transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {leadsPage} of {Math.ceil(leadsTotal / leadsPerPage)}
                      </span>
                      <button
                        onClick={() => setLeadsPage(p => p + 1)}
                        disabled={leadsPage >= Math.ceil(leadsTotal / leadsPerPage)}
                        className="px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg hover:bg-silicon-slate transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <Filter size={14} className="text-gray-500" />
              <select
                value={escalationsLinkedFilter}
                onChange={(e) => setEscalationsLinkedFilter(e.target.value as 'all' | 'linked' | 'unlinked')}
                className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
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
                            <Link href={`/admin/outreach?tab=leads&id=${e.contact_submission_id}`} className="text-purple-400 hover:text-purple-300">
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
                    className="px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg hover:bg-silicon-slate transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {escalationsPage} of {Math.ceil(escalationsTotal / escalationsPerPage)}
                  </span>
                  <button
                    onClick={() => setEscalationsPage(p => p + 1)}
                    disabled={escalationsPage >= Math.ceil(escalationsTotal / escalationsPerPage)}
                    className="px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg hover:bg-silicon-slate transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
