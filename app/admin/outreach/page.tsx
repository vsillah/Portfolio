'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { isWarmLeadSource, inputTypeFromLeadSource } from '@/lib/constants/lead-source'
import {
  Mail,
  Linkedin,
  CheckCircle,
  XCircle,
  Edit3,
  Send,
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
  FileText,
  CalendarCheck,
  ChevronRight,
  MoreHorizontal,
  Sparkles,
  Inbox,
  Save,
  Unplug,
  Video,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import {
  type AdminMeetingContextItem,
  mapDbMeetingRowsToContextItems,
  mergeDbFirstWithReadAi,
  isMeetingRecordContextId,
  meetingRecordUuidFromContextId,
} from '@/lib/admin-meeting-context-items'
import { buildGmailComposeUrl } from '@/lib/gmail-compose'
import { formatQuickWinsForDisplay, quickWinsToEditableString } from '@/lib/quick-wins-display'
import { buildLinkWithReturn } from '@/lib/admin-return-context'
import TechStackModal from '@/components/admin/outreach/TechStackModal'
import SocialIntelModal from '@/components/admin/outreach/SocialIntelModal'
import EvidenceDrawer from '@/components/admin/outreach/EvidenceDrawer'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

interface Contact {
  id: number
  name: string
  email: string
  company: string
  company_domain: string
  job_title: string
  industry: string
  lead_score: number
  qualification_status: string
  lead_source: string
  outreach_status: string
  full_report: string
  quick_wins: string
  ai_readiness_score: number
  competitive_pressure_score: number
  linkedin_url: string
}

interface OutreachItem {
  id: string
  contact_submission_id: number
  channel: 'email' | 'linkedin'
  subject: string | null
  body: string
  sequence_step: number
  status: string
  thread_id: string | null
  scheduled_send_at: string | null
  sent_at: string | null
  replied_at: string | null
  reply_content: string | null
  generation_model: string
  generation_prompt_summary: string
  approved_at: string | null
  created_at: string
  updated_at: string
  contact_submissions: Contact
}

interface Stats {
  draft: number
  approved: number
  sent: number
  replied: number
  bounced: number
  cancelled: number
  rejected: number
  total: number
}

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
  has_extractable_text: boolean
  do_not_contact?: boolean
  removed_at?: string | null
  website_tech_stack?: { domain?: string; technologies?: unknown[]; byTag?: Record<string, string[]> } | null
}

interface LeadsResponse {
  leads: Lead[]
  total: number
  page: number
}

type TabType = 'queue' | 'leads' | 'escalations'

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


const READAI_CACHE_TTL_MS = 5 * 60 * 1000

/** Read.ai / DB meetings may use text, action, title, etc.; omit empty and literal "undefined". */
function formatMeetingActionItemsAsBullets(actionItems: unknown[] | null | undefined): string {
  if (!actionItems?.length) return ''
  const lines: string[] = []
  for (const ai of actionItems) {
    let text = ''
    if (typeof ai === 'string') text = ai.trim()
    else if (ai && typeof ai === 'object') {
      const o = ai as Record<string, unknown>
      const t = o.text ?? o.action ?? o.title ?? o.description ?? o.body
      text = typeof t === 'string' ? t.trim() : ''
    }
    if (text && text !== 'undefined') lines.push(`• ${text}`)
  }
  return lines.join('\n')
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
  
  // Tab management
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = searchParams?.get('tab')
    return (tab === 'leads' || tab === 'queue' || tab === 'escalations') ? tab : 'queue'
  })

  // Queue state
  const [items, setItems] = useState<OutreachItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('draft')
  const [channelFilter, setChannelFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [contactFilter, setContactFilter] = useState<number | null>(() => {
    const contact = searchParams?.get('contact')
    return contact ? parseInt(contact) : null
  })
  const [filteredContactName, setFilteredContactName] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

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

  // Related meetings for expanded lead
  const [leadMeetings, setLeadMeetings] = useState<Array<{ id: string; meeting_type: string; meeting_date: string }>>([])
  const [leadMeetingsLoading, setLeadMeetingsLoading] = useState(false)

  // Add lead modal (manual entry)
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)
  const [addLeadName, setAddLeadName] = useState('')
  const [addLeadEmail, setAddLeadEmail] = useState('')
  const [addLeadCompany, setAddLeadCompany] = useState('')
  const [addLeadCompanyWebsite, setAddLeadCompanyWebsite] = useState('')
  const [addLeadLinkedInUrl, setAddLeadLinkedInUrl] = useState('')
  const [addLeadJobTitle, setAddLeadJobTitle] = useState('')
  const [addLeadIndustry, setAddLeadIndustry] = useState('')
  const [addLeadPhone, setAddLeadPhone] = useState('')
  const [addLeadMessage, setAddLeadMessage] = useState('')
  const [addLeadInputType, setAddLeadInputType] = useState('other')
  const [addLeadLoading, setAddLeadLoading] = useState(false)
  const [addLeadError, setAddLeadError] = useState<string | null>(null)
  const [addLeadSuccessId, setAddLeadSuccessId] = useState<number | null>(null)
  const [addLeadEmployeeCount, setAddLeadEmployeeCount] = useState('')
  const [addLeadQuickWins, setAddLeadQuickWins] = useState('')
  const [addLeadPainPoints, setAddLeadPainPoints] = useState('')
  const [showVepSection, setShowVepSection] = useState(false)
  const [addLeadMeetingId, setAddLeadMeetingId] = useState<string | null>(null)
  const [addLeadMeetings, setAddLeadMeetings] = useState<{ id: string; meeting_type: string; meeting_date: string; transcript_preview?: string; contact_name?: string | null; contact_submission_id?: number | null }[]>([])
  const [addLeadMeetingsLoading, setAddLeadMeetingsLoading] = useState(false)
  const [addLeadExtractLoading, setAddLeadExtractLoading] = useState(false)
  const [addLeadMeetingSummary, setAddLeadMeetingSummary] = useState('')
  const [addLeadMeetingPainPoints, setAddLeadMeetingPainPoints] = useState('')
  const [addLeadOutreachToast, setAddLeadOutreachToast] = useState(false)
  const [addLeadMeetingTab, setAddLeadMeetingTab] = useState<'select' | 'paste' | 'readai'>('select')
  const [addLeadReadAiEmail, setAddLeadReadAiEmail] = useState('')
  const [addLeadReadAiMeetings, setAddLeadReadAiMeetings] = useState<AdminMeetingContextItem[]>([])
  const [addLeadReadAiLoading, setAddLeadReadAiLoading] = useState(false)
  const [addLeadReadAiSearched, setAddLeadReadAiSearched] = useState(false)
  const [addLeadPasteText, setAddLeadPasteText] = useState('')
  const [addLeadPasteTitle, setAddLeadPasteTitle] = useState('')
  const [addLeadPasteAttendeeName, setAddLeadPasteAttendeeName] = useState('')
  const [addLeadPasteAttendeeEmail, setAddLeadPasteAttendeeEmail] = useState('')
  const [addLeadPasteSaving, setAddLeadPasteSaving] = useState(false)

  // Value evidence: lead selection and push
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set())
  const [showEnrichModal, setShowEnrichModal] = useState(false)
  const [enrichModalLeads, setEnrichModalLeads] = useState<Array<{
    id: number
    name: string
    email: string | null
    company: string | null
    company_domain: string | null
    industry: string | null
    job_title: string | null
    phone_number: string | null
    linkedin_url: string | null
    lead_source: string | null
    employee_count: string | null
    message: string | null
    quick_wins: string | null
    full_report: string | null
    rep_pain_points: string | null
    has_diagnostic: boolean
    has_extractable_text: boolean
    evidence_count?: number
  }>>([])
  const [enrichModalForm, setEnrichModalForm] = useState<Record<number, {
    name?: string
    email?: string
    company?: string
    company_domain?: string
    linkedin_url?: string
    job_title?: string
    industry?: string
    phone_number?: string
    input_type?: string
    message?: string
    rep_pain_points?: string
    quick_wins?: string
    employee_count?: string
  }>>({})
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

  // Unified lead modal: re-run enrichment (for Save), loading, error
  const [unifiedModalReRunEnrichment, setUnifiedModalReRunEnrichment] = useState(true)
  const [unifiedModalSaveLoading, setUnifiedModalSaveLoading] = useState(false)
  const [unifiedModalSaveError, setUnifiedModalSaveError] = useState<string | null>(null)
  /** After a successful Push from this modal, show Classify instead of Push (also when preflight shows all leads already have evidence). */
  const [enrichModalVepPushCompleted, setEnrichModalVepPushCompleted] = useState(false)

  // Read.ai + meeting_records — shared cache (Read.ai slice only) + merged modal state
  const readAiCacheRef = useRef<Record<string, { meetings: AdminMeetingContextItem[]; fetchedAt: number }>>({})

  const [meetingsByLead, setMeetingsByLead] = useState<Record<number, AdminMeetingContextItem[]>>({})
  const [meetingsLoading, setMeetingsLoading] = useState<Record<number, boolean>>({})
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<Record<number, Set<string>>>({})
  const [meetingImportLoading, setMeetingImportLoading] = useState(false)
  const [meetingSectionExpanded, setMeetingSectionExpanded] = useState<Record<number, boolean>>({})
  const [, setReadAiCacheTick] = useState(0)

  // Pending meeting imports — staged for admin approval before merging into form fields
  type PendingMeetingImport = {
    meetingId: string
    meetingTitle: string
    meetingDate: string
    type: 'pain_points' | 'quick_wins'
    content: string
  }
  const [pendingMeetingImports, setPendingMeetingImports] = useState<Record<number, PendingMeetingImport[]>>({})

  // Generate outreach state
  const [generateOutreachLoading, setGenerateOutreachLoading] = useState<number | null>(null)
  const [generateInAppLoading, setGenerateInAppLoading] = useState<number | null>(null)
  const [generateOutreachToast, setGenerateOutreachToast] = useState<string | null>(null)
  const [emailDraftInboxLoadingId, setEmailDraftInboxLoadingId] = useState<string | null>(null)
  const [gmailUserDraftLoadingId, setGmailUserDraftLoadingId] = useState<string | null>(null)
  const [gmailUserOAuthStatus, setGmailUserOAuthStatus] = useState<{
    connected: boolean
    googleEmail: string | null
    configured: boolean
  } | null>(null)
  const [gmailOAuthConnectLoading, setGmailOAuthConnectLoading] = useState(false)
  const [gmailOAuthDisconnectLoading, setGmailOAuthDisconnectLoading] = useState(false)

  // Pain point classification in enrich modal
  type ClassifiedPainPoint = {
    text: string
    categoryId: string
    categoryName: string
    categoryDisplayName: string
    confidence: number
    method: 'keyword' | 'ai'
  }
  const [enrichClassifiedItems, setEnrichClassifiedItems] = useState<Record<number, ClassifiedPainPoint[]>>({})
  const [enrichClassifyLoading, setEnrichClassifyLoading] = useState<Record<number, boolean>>({})

  // Add Lead modal: pending extracted suggestions for admin approval
  type PendingExtractSuggestion = {
    field: 'pain_points' | 'quick_wins'
    content: string
  }
  const [addLeadPendingExtracts, setAddLeadPendingExtracts] = useState<PendingExtractSuggestion[]>([])

  const getReadAiCacheAge = useCallback((email: string): string | null => {
    const cached = readAiCacheRef.current[email.toLowerCase().trim()]
    if (!cached) return null
    const seconds = Math.floor((Date.now() - cached.fetchedAt) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ago`
  }, [])

  const bustReadAiCache = useCallback((email: string) => {
    delete readAiCacheRef.current[email.toLowerCase().trim()]
  }, [])

  // Tech stack lookup (BuiltWith) — modal state
  const [techStackLoading, setTechStackLoading] = useState(false)
  const [techStackResult, setTechStackResult] = useState<{
    domain: string
    technologies?: Array<{ name: string; tag?: string; categories?: string[] }>
    byTag?: Record<string, string[]>
    error?: string
    creditsRemaining?: number
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const params = new URLSearchParams({
        status: statusFilter,
        channel: channelFilter,
        ...(search && { search }),
        ...(contactFilter && { contact: contactFilter.toString() }),
      })

      const response = await fetch(`/api/admin/outreach?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setItems(Array.isArray(data.items) ? data.items : [])
        setStats(data.stats ?? { draft: 0, approved: 0, sent: 0, replied: 0, bounced: 0, cancelled: 0, rejected: 0, total: 0 })
        const contact = contactFilter && Array.isArray(data.items) && data.items.length > 0
          ? data.items[0].contact_submissions
          : null
        setFilteredContactName(contact && typeof contact === 'object' && !Array.isArray(contact) && contact.name != null
          ? String(contact.name)
          : null)
      }
    } catch (error) {
      console.error('Failed to fetch outreach data:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, channelFilter, search, contactFilter])

  const fetchGmailUserOAuthStatus = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      if (!session) {
        setGmailUserOAuthStatus(null)
        return
      }
      const r = await fetch('/api/admin/oauth/google-gmail/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = (await r.json().catch(() => ({}))) as {
        connected?: boolean
        googleEmail?: string | null
        configured?: boolean
      }
      if (r.ok && typeof data.connected === 'boolean') {
        setGmailUserOAuthStatus({
          connected: data.connected,
          googleEmail: data.googleEmail ?? null,
          configured: Boolean(data.configured),
        })
      } else {
        setGmailUserOAuthStatus({
          connected: false,
          googleEmail: null,
          configured: false,
        })
      }
    } catch {
      setGmailUserOAuthStatus(null)
    }
  }, [])

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true)
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
      setLeadsLoading(false)
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
        // Stop polling if no leads are pending
        const hasPending = data.leads.some((l: Lead) => l.last_vep_status === 'pending')
        if (!hasPending && vepPollingRef.current) {
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
    if (activeTab === 'queue') {
      fetchData()
      void fetchGmailUserOAuthStatus()
    } else if (activeTab === 'leads') {
      fetchLeads()
    } else if (activeTab === 'escalations') {
      fetchEscalations()
    }
  }, [activeTab, fetchData, fetchLeads, fetchEscalations, fetchGmailUserOAuthStatus])

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

    void fetchGmailUserOAuthStatus()
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.delete('gmail_connected')
    params.delete('gmail_oauth_error')
    const qs = params.toString()
    router.replace(qs ? `/admin/outreach?${qs}` : '/admin/outreach')
  }, [searchParams, router, fetchGmailUserOAuthStatus])

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
      return
    }
    let cancelled = false
    setLeadMeetingsLoading(true)
    getCurrentSession().then((session) => {
      if (!session?.access_token || cancelled) return
      fetch(`/api/admin/sales/contact-meetings?contact_submission_id=${expandedLeadId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((res) => res.ok ? res.json() : { meetings: [] })
        .then((data) => {
          if (!cancelled) {
            const meetings = (data.meetings ?? []).map((m: { id: string; meeting_type: string; meeting_date: string }) => ({
              id: m.id,
              meeting_type: m.meeting_type,
              meeting_date: m.meeting_date,
            }))
            setLeadMeetings(meetings)
          }
        })
        .catch(() => { if (!cancelled) setLeadMeetings([]) })
        .finally(() => { if (!cancelled) setLeadMeetingsLoading(false) })
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

  // Open Review & Enrich modal (same flow for bulk "Push" and per-lead "Retry")
  const openReviewEnrichModal = useCallback(async (contactSubmissionIds: number[]) => {
    if (contactSubmissionIds.length === 0) return
    const session = await getCurrentSession()
    if (!session) return
    setPushLoading(true)
    setEnrichModalVepPushCompleted(false)
    try {
      const res = await fetch('/api/admin/value-evidence/extract-leads/preflight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ contact_submission_ids: contactSubmissionIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preflight failed')
      const leads = data.leads || []
      setEnrichModalLeads(leads)
      setEnrichModalForm({})
      setUnifiedModalReRunEnrichment(true)
      setUnifiedModalSaveError(null)
      setMeetingsByLead({})
      setSelectedMeetingIds({})
      setMeetingSectionExpanded({})
      setPendingMeetingImports({})
      setEnrichClassifiedItems({})
      setEnrichClassifyLoading({})
      setShowEnrichModal(true)

      // Meeting context: attributed meeting_records + Read.ai (when email present)
      for (const lead of leads) {
        fetchMeetingsForLead(lead.id, lead.email ?? null, session.access_token)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPushLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchMeetingsForLead = useCallback(async (leadId: number, email: string | null, accessToken: string, forceRefresh?: boolean) => {
    const cacheKey = (email ?? '').toLowerCase().trim()
    const canReadAi = cacheKey.length > 0

    setMeetingsLoading((prev) => ({ ...prev, [leadId]: true }))
    try {
      const needReadAiFetch =
        canReadAi &&
        (forceRefresh ||
          !readAiCacheRef.current[cacheKey] ||
          Date.now() - readAiCacheRef.current[cacheKey].fetchedAt >= READAI_CACHE_TTL_MS)

      const dbPromise = fetch(
        `/api/admin/meetings?contact_submission_id=${leadId}&limit=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      ).then(async (r) => (r.ok ? r.json() : { meetings: [] }))

      const readAiPromise = needReadAiFetch
        ? fetch(`/api/admin/read-ai/meetings?email=${encodeURIComponent(email!)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }).then(async (r) => {
            if (!r.ok) {
              console.warn(`[read-ai/meetings] ${r.status} for lead ${leadId}`)
              return { meetings: [] as AdminMeetingContextItem[] }
            }
            const data = await r.json()
            const meetings: AdminMeetingContextItem[] = data.meetings || []
            readAiCacheRef.current[cacheKey] = { meetings, fetchedAt: Date.now() }
            setReadAiCacheTick((t) => t + 1)
            return { meetings }
          })
        : Promise.resolve({
            meetings: (canReadAi ? readAiCacheRef.current[cacheKey]?.meetings : undefined) ?? ([] as AdminMeetingContextItem[]),
          })

      const [dbData, readAiData] = await Promise.all([dbPromise, readAiPromise])

      const dbRows = (dbData.meetings || []) as Array<{
        id: string
        meeting_type: string
        meeting_date: string
        summary: string | null
      }>

      const dbMapped = mapDbMeetingRowsToContextItems(dbRows)
      const merged = mergeDbFirstWithReadAi(dbMapped, readAiData.meetings)

      setMeetingsByLead((prev) => ({ ...prev, [leadId]: merged }))
      if (merged.length > 0) {
        setMeetingSectionExpanded((prev) => ({ ...prev, [leadId]: true }))
      }
    } catch (err) {
      console.error(`[meetings-context] Failed for lead ${leadId}:`, err)
    } finally {
      setMeetingsLoading((prev) => ({ ...prev, [leadId]: false }))
    }
  }, [])

  const handleToggleMeeting = useCallback((leadId: number, meetingId: string) => {
    setSelectedMeetingIds((prev) => {
      const current = prev[leadId] ?? new Set<string>()
      const next = new Set(current)
      if (next.has(meetingId)) next.delete(meetingId)
      else next.add(meetingId)
      return { ...prev, [leadId]: next }
    })
  }, [])

  const handleImportMeetings = useCallback(async (leadId: number) => {
    const selected = selectedMeetingIds[leadId]
    if (!selected || selected.size === 0) return

    const session = await getCurrentSession()
    if (!session) return

    setMeetingImportLoading(true)
    try {
      const pending: PendingMeetingImport[] = []

      for (const meetingId of selected) {
        const res = isMeetingRecordContextId(meetingId)
          ? await fetch(`/api/admin/meetings/${encodeURIComponent(meetingRecordUuidFromContextId(meetingId))}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          : await fetch(`/api/admin/read-ai/meetings/${encodeURIComponent(meetingId)}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
        if (!res.ok) continue
        const { meeting } = await res.json()

        const date = new Date(meeting.start_time_ms).toLocaleDateString()

        if (meeting.summary) {
          pending.push({
            meetingId,
            meetingTitle: meeting.title,
            meetingDate: date,
            type: 'pain_points',
            content: meeting.summary,
          })
        }
        if (meeting.action_items?.length) {
          const items = formatMeetingActionItemsAsBullets(meeting.action_items)
          if (!items) continue
          pending.push({
            meetingId,
            meetingTitle: meeting.title,
            meetingDate: date,
            type: 'quick_wins',
            content: items,
          })
        }
      }

      setPendingMeetingImports((prev) => ({
        ...prev,
        [leadId]: [...(prev[leadId] || []), ...pending],
      }))

      setSelectedMeetingIds((prev) => ({ ...prev, [leadId]: new Set<string>() }))
    } catch (err) {
      console.error('[read-ai] Import failed:', err)
    } finally {
      setMeetingImportLoading(false)
    }
  }, [selectedMeetingIds])

  const handleApproveMeetingImport = useCallback((leadId: number, index: number) => {
    const items = pendingMeetingImports[leadId]
    if (!items || !items[index]) return

    const item = items[index]
    const formatted = `--- From meeting: ${item.meetingTitle} (${item.meetingDate}) ---\n${item.content}`

    setEnrichModalForm((prev) => {
      const existing = prev[leadId] || {}
      const field = item.type === 'pain_points' ? 'rep_pain_points' : 'quick_wins'
      const current = existing[field] ?? ''
      return {
        ...prev,
        [leadId]: {
          ...existing,
          [field]: [current, formatted].filter(Boolean).join('\n\n'),
        },
      }
    })

    setPendingMeetingImports((prev) => ({
      ...prev,
      [leadId]: items.filter((_, i) => i !== index),
    }))
  }, [pendingMeetingImports])

  const handleDeclineMeetingImport = useCallback((leadId: number, index: number) => {
    setPendingMeetingImports((prev) => ({
      ...prev,
      [leadId]: (prev[leadId] || []).filter((_, i) => i !== index),
    }))
  }, [])

  const handleApproveAllMeetingImports = useCallback((leadId: number) => {
    const items = pendingMeetingImports[leadId]
    if (!items || items.length === 0) return

    setEnrichModalForm((prev) => {
      const existing = prev[leadId] || {}
      let painPoints = existing.rep_pain_points ?? ''
      let quickWins = existing.quick_wins ?? ''

      for (const item of items) {
        const formatted = `--- From meeting: ${item.meetingTitle} (${item.meetingDate}) ---\n${item.content}`
        if (item.type === 'pain_points') {
          painPoints = [painPoints, formatted].filter(Boolean).join('\n\n')
        } else {
          quickWins = [quickWins, formatted].filter(Boolean).join('\n\n')
        }
      }

      return {
        ...prev,
        [leadId]: { ...existing, rep_pain_points: painPoints, quick_wins: quickWins },
      }
    })

    setPendingMeetingImports((prev) => ({ ...prev, [leadId]: [] }))
  }, [pendingMeetingImports])

  const handleDeclineAllMeetingImports = useCallback((leadId: number) => {
    setPendingMeetingImports((prev) => ({ ...prev, [leadId]: [] }))
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

  const handleAction = async (action: 'approve' | 'reject', ids: string[]) => {
    setActionLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/admin/outreach', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ids }),
      })

      if (response.ok) {
        setSelectedIds(new Set())
        await fetchData()
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleEdit = async (id: string) => {
    setActionLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/admin/outreach', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'edit',
          ids: [id],
          updates: { subject: editSubject, body: editBody },
        }),
      })

      if (response.ok) {
        setEditingId(null)
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to edit:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSend = async (id: string) => {
    setActionLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/admin/outreach/${id}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to send:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)))
    }
  }

  const startEditing = (item: OutreachItem) => {
    setEditingId(item.id)
    setEditSubject(item.subject || '')
    setEditBody(item.body)
  }

  const openDraftInGmail = useCallback(
    (item: OutreachItem) => {
      const email = item.contact_submissions?.email?.trim()
      if (!email?.includes('@')) {
        setGenerateOutreachToast('This lead has no valid email address.')
        setTimeout(() => setGenerateOutreachToast(null), 6000)
        return
      }
      const subject = editingId === item.id ? editSubject : item.subject ?? ''
      const body = editingId === item.id ? editBody : item.body
      const { url, omitBodyFromUrl } = buildGmailComposeUrl(email, subject, body)
      const openTab = () => {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      if (omitBodyFromUrl) {
        void navigator.clipboard.writeText(body).then(() => {
          openTab()
          setGenerateOutreachToast(
            'Gmail opened. Message body was copied — paste it into the compose window (body was too long for the link).'
          )
          setTimeout(() => setGenerateOutreachToast(null), 8000)
        }).catch(() => {
          openTab()
          setGenerateOutreachToast(
            'Gmail opened with recipient and subject only. Copy the message body from the preview below.'
          )
          setTimeout(() => setGenerateOutreachToast(null), 10000)
        })
      } else {
        openTab()
      }
    },
    [editingId, editSubject, editBody]
  )

  const emailDraftCopyToInbox = async (item: OutreachItem) => {
    const subject = editingId === item.id ? editSubject : item.subject ?? ''
    const body = editingId === item.id ? editBody : item.body
    setEmailDraftInboxLoadingId(item.id)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setGenerateOutreachToast('Please sign in to continue.')
        setTimeout(() => setGenerateOutreachToast(null), 6000)
        return
      }
      const res = await fetch(
        `/api/admin/outreach/${item.id}/email-draft-to-inbox`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject,
            body,
          }),
        }
      )
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }
      if (res.ok) {
        setGenerateOutreachToast(
          data.message ?? 'A copy was sent to your account email.'
        )
        setTimeout(() => setGenerateOutreachToast(null), 6000)
      } else {
        setGenerateOutreachToast(
          data.error ?? 'We could not send that copy. Please try again.'
        )
        setTimeout(() => setGenerateOutreachToast(null), 8000)
      }
    } catch {
      setGenerateOutreachToast(
        'We could not send that copy. Please try again.'
      )
      setTimeout(() => setGenerateOutreachToast(null), 8000)
    } finally {
      setEmailDraftInboxLoadingId(null)
    }
  }

  const saveGmailUserDraft = async (item: OutreachItem) => {
    const subject = editingId === item.id ? editSubject : item.subject ?? ''
    const body = editingId === item.id ? editBody : item.body
    setGmailUserDraftLoadingId(item.id)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setGenerateOutreachToast('Please sign in to continue.')
        setTimeout(() => setGenerateOutreachToast(null), 6000)
        return
      }
      const res = await fetch(
        `/api/admin/outreach/${item.id}/gmail-user-draft`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subject, body }),
        }
      )
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        openGmailUrl?: string
      }
      if (res.ok) {
        setGenerateOutreachToast(
          data.message ?? 'Draft saved in your Gmail.'
        )
        setTimeout(() => setGenerateOutreachToast(null), 7000)
        if (data.openGmailUrl) {
          window.open(data.openGmailUrl, '_blank', 'noopener,noreferrer')
        }
      } else {
        setGenerateOutreachToast(
          data.error ?? 'Could not save a Gmail draft. Please try again.'
        )
        setTimeout(() => setGenerateOutreachToast(null), 9000)
      }
    } catch {
      setGenerateOutreachToast(
        'Could not save a Gmail draft. Please try again.'
      )
      setTimeout(() => setGenerateOutreachToast(null), 9000)
    } finally {
      setGmailUserDraftLoadingId(null)
    }
  }

  const startGmailUserOAuthConnect = async () => {
    setGmailOAuthConnectLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setGenerateOutreachToast('Please sign in to continue.')
        setTimeout(() => setGenerateOutreachToast(null), 6000)
        return
      }
      const res = await fetch('/api/admin/oauth/google-gmail/start', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
      }
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setGenerateOutreachToast(
        data.error ?? 'Could not start Gmail sign-in. Please try again.'
      )
      setTimeout(() => setGenerateOutreachToast(null), 8000)
    } finally {
      setGmailOAuthConnectLoading(false)
    }
  }

  const disconnectGmailUserOAuth = async () => {
    setGmailOAuthDisconnectLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch('/api/admin/oauth/google-gmail/disconnect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      await fetchGmailUserOAuthStatus()
      if (res.ok) {
        setGenerateOutreachToast('Gmail disconnected from this admin account.')
        setTimeout(() => setGenerateOutreachToast(null), 6000)
      } else {
        setGenerateOutreachToast('Could not disconnect. Please try again.')
        setTimeout(() => setGenerateOutreachToast(null), 6000)
      }
    } finally {
      setGmailOAuthDisconnectLoading(false)
    }
  }

  const resetAddLeadForm = () => {
    setAddLeadName('')
    setAddLeadEmail('')
    setAddLeadCompany('')
    setAddLeadCompanyWebsite('')
    setAddLeadLinkedInUrl('')
    setAddLeadJobTitle('')
    setAddLeadIndustry('')
    setAddLeadPhone('')
    setAddLeadMessage('')
    setAddLeadInputType('other')
    setAddLeadEmployeeCount('')
    setAddLeadQuickWins('')
    setAddLeadPainPoints('')
    setShowVepSection(false)
    setAddLeadError(null)
    setAddLeadMeetingId(null)
    setAddLeadMeetings([])
    setAddLeadExtractLoading(false)
    setAddLeadMeetingSummary('')
    setAddLeadMeetingPainPoints('')
    setAddLeadMeetingTab('select')
    setAddLeadPasteText('')
    setAddLeadPasteTitle('')
    setAddLeadPasteAttendeeName('')
    setAddLeadPasteAttendeeEmail('')
    setAddLeadPasteSaving(false)
    setAddLeadPendingExtracts([])
  }

  const fetchMeetingsForPicker = async () => {
    setAddLeadMeetingsLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch('/api/admin/meetings?unlinked_only=false&limit=50', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAddLeadMeetings(data.meetings || [])
      }
    } catch {
      // Silently fail; meeting list is optional
    } finally {
      setAddLeadMeetingsLoading(false)
    }
  }

  const handleExtractFromMeeting = async (meetingId: string) => {
    setAddLeadExtractLoading(true)
    setAddLeadError(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/meetings/${meetingId}/extract-lead-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setAddLeadError(err.error || 'Failed to extract lead fields')
        return
      }
      const { fields } = await res.json()
      if (fields.name) setAddLeadName(fields.name)
      if (fields.email) setAddLeadEmail(fields.email)
      if (fields.company) setAddLeadCompany(fields.company)
      if (fields.company_website) setAddLeadCompanyWebsite(fields.company_website)
      if (fields.linkedin_url) setAddLeadLinkedInUrl(fields.linkedin_url)
      if (fields.job_title) setAddLeadJobTitle(fields.job_title)
      if (fields.industry) setAddLeadIndustry(fields.industry)
      if (fields.phone) setAddLeadPhone(fields.phone)
      const pendingSuggestions: PendingExtractSuggestion[] = []
      if (fields.pain_points) {
        pendingSuggestions.push({ field: 'pain_points', content: fields.pain_points })
        setAddLeadMeetingPainPoints(fields.pain_points)
        setShowVepSection(true)
      }
      if (fields.quick_wins) {
        pendingSuggestions.push({ field: 'quick_wins', content: fields.quick_wins })
        setShowVepSection(true)
      }
      if (pendingSuggestions.length > 0) {
        setAddLeadPendingExtracts((prev) => [...prev, ...pendingSuggestions])
      }
      if (fields.employee_count) {
        setAddLeadEmployeeCount(fields.employee_count)
        setShowVepSection(true)
      }
      if (fields.meeting_context_summary) {
        setAddLeadMessage(fields.meeting_context_summary)
        setAddLeadMeetingSummary(fields.meeting_context_summary)
      }
    } catch {
      setAddLeadError('Failed to extract lead fields from meeting')
    } finally {
      setAddLeadExtractLoading(false)
    }
  }

  const handlePasteAndExtract = async () => {
    const text = addLeadPasteText.trim()
    if (!text) return
    setAddLeadPasteSaving(true)
    setAddLeadError(null)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const ingestRes = await fetch('/api/admin/meetings/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          transcript: text,
          title: addLeadPasteTitle.trim() || undefined,
          attendee_name: addLeadPasteAttendeeName.trim() || undefined,
          attendee_email: addLeadPasteAttendeeEmail.trim() || undefined,
          meeting_type: 'external',
        }),
      })
      if (!ingestRes.ok) {
        const err = await ingestRes.json().catch(() => ({}))
        setAddLeadError(err.error || 'Failed to save transcript')
        return
      }
      const { meeting } = await ingestRes.json()
      const newId = meeting.id as string

      setAddLeadMeetingId(newId)
      setAddLeadMeetings((prev) => [
        { id: newId, meeting_type: 'external', meeting_date: meeting.meeting_date, transcript_preview: text.substring(0, 120) },
        ...prev,
      ])
      setAddLeadMeetingTab('select')

      await handleExtractFromMeeting(newId)
    } catch {
      setAddLeadError('Failed to save and extract from transcript')
    } finally {
      setAddLeadPasteSaving(false)
    }
  }

  const handleAddLeadReadAiSearch = async (forceRefresh?: boolean) => {
    const email = addLeadReadAiEmail.trim()
    if (!email) return

    const cacheKey = email.toLowerCase()
    const needReadAiFetch =
      forceRefresh ||
      !readAiCacheRef.current[cacheKey] ||
      Date.now() - readAiCacheRef.current[cacheKey].fetchedAt >= READAI_CACHE_TTL_MS

    const session = await getCurrentSession()
    if (!session) return
    setAddLeadReadAiLoading(true)
    setAddLeadReadAiSearched(false)
    try {
      const dbPromise = fetch(
        `/api/admin/meetings?match_email=${encodeURIComponent(email)}&limit=50`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      ).then((r) => (r.ok ? r.json() : { meetings: [] }))

      const readAiPromise = needReadAiFetch
        ? fetch(`/api/admin/read-ai/meetings?email=${encodeURIComponent(email)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).then(async (r) => {
            if (!r.ok) {
              console.warn(`[read-ai/meetings] Add Lead search ${r.status}`)
              return { meetings: [] as AdminMeetingContextItem[] }
            }
            const data = await r.json()
            const meetings: AdminMeetingContextItem[] = data.meetings || []
            readAiCacheRef.current[cacheKey] = { meetings, fetchedAt: Date.now() }
            setReadAiCacheTick((t) => t + 1)
            return { meetings }
          })
        : Promise.resolve({
            meetings: readAiCacheRef.current[cacheKey]?.meetings ?? ([] as AdminMeetingContextItem[]),
          })

      const [dbData, readAiData] = await Promise.all([dbPromise, readAiPromise])

      const dbRows = (dbData.meetings || []) as Array<{
        id: string
        meeting_type: string
        meeting_date: string
        summary: string | null
      }>
      const dbMapped = mapDbMeetingRowsToContextItems(dbRows)
      setAddLeadReadAiMeetings(mergeDbFirstWithReadAi(dbMapped, readAiData.meetings))
    } catch (err) {
      console.error('[read-ai] Add Lead search failed:', err)
    } finally {
      setAddLeadReadAiLoading(false)
      setAddLeadReadAiSearched(true)
    }
  }

  const handleAddLeadReadAiImport = async (meetingId: string) => {
    const session = await getCurrentSession()
    if (!session) return
    setAddLeadExtractLoading(true)
    try {
      const res = isMeetingRecordContextId(meetingId)
        ? await fetch(`/api/admin/meetings/${encodeURIComponent(meetingRecordUuidFromContextId(meetingId))}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        : await fetch(`/api/admin/read-ai/meetings/${encodeURIComponent(meetingId)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
      if (!res.ok) return
      const { meeting } = await res.json()

      if (isMeetingRecordContextId(meetingId)) {
        const rawId = meetingRecordUuidFromContextId(meetingId)
        setAddLeadMeetingId(rawId)
        setAddLeadMeetings((prev) => {
          if (prev.some((x) => x.id === rawId)) return prev
          return [
            {
              id: rawId,
              meeting_type: 'record',
              meeting_date: new Date(meeting.start_time_ms).toISOString(),
            },
            ...prev,
          ]
        })
      } else {
        // Ingest Read.ai transcript into meeting_records so it follows the existing pipeline
        const ingestRes = await fetch('/api/admin/meetings/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            transcript: meeting.transcript?.text || meeting.summary || '',
            title: meeting.title,
            attendee_email: addLeadReadAiEmail.trim() || undefined,
            meeting_type: 'external',
          }),
        })
        if (ingestRes.ok) {
          const { meeting: saved } = await ingestRes.json()
          setAddLeadMeetingId(saved.id)
          setAddLeadMeetings((prev) => [
            { id: saved.id, meeting_type: 'external', meeting_date: saved.meeting_date },
            ...prev,
          ])
        }
      }

      if (meeting.summary) {
        setAddLeadPainPoints((prev) => [prev, `--- From meeting: ${meeting.title} ---\n${meeting.summary}`].filter(Boolean).join('\n\n'))
      }
      if (meeting.action_items?.length) {
        const items = formatMeetingActionItemsAsBullets(meeting.action_items)
        if (items) {
          setAddLeadQuickWins((prev) => [prev, `--- From meeting: ${meeting.title} ---\n${items}`].filter(Boolean).join('\n\n'))
        }
      }

      if (!isMeetingRecordContextId(meetingId)) {
        const attendee = meeting.participants?.find((p: { email: string | null }) =>
          p.email?.toLowerCase() === addLeadReadAiEmail.trim().toLowerCase()
        )
        if (attendee) {
          if (!addLeadName.trim() && attendee.name) setAddLeadName(attendee.name)
          if (!addLeadEmail.trim() && attendee.email) setAddLeadEmail(attendee.email)
        }
      } else if (addLeadReadAiEmail.trim()) {
        if (!addLeadEmail.trim()) setAddLeadEmail(addLeadReadAiEmail.trim())
      }

      setAddLeadMeetingTab('select')
    } catch (err) {
      console.error('[read-ai] Import to Add Lead failed:', err)
    } finally {
      setAddLeadExtractLoading(false)
    }
  }

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLeadError(null)
    setAddLeadLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        setAddLeadError('Not authenticated')
        return
      }
      const payload: Record<string, unknown> = {
        name: addLeadName.trim(),
        email: addLeadEmail.trim() || undefined,
        company: addLeadCompany.trim() || undefined,
        company_domain: addLeadCompanyWebsite.trim() || undefined,
        linkedin_url: addLeadLinkedInUrl.trim() || undefined,
        job_title: addLeadJobTitle.trim() || undefined,
        industry: addLeadIndustry.trim() || undefined,
        phone_number: addLeadPhone.trim() || undefined,
        message: addLeadMessage.trim() || undefined,
        input_type: addLeadInputType,
        employee_count: addLeadEmployeeCount.trim() || undefined,
        quick_wins: addLeadQuickWins.trim() || undefined,
        rep_pain_points: addLeadPainPoints.trim() || undefined,
      }
      if (addLeadMeetingId) {
        payload.meeting_record_id = addLeadMeetingId
        payload.meeting_summary = addLeadMeetingSummary || undefined
        payload.meeting_pain_points = addLeadMeetingPainPoints || undefined
        payload.generate_outreach = true
      }
      const response = await fetch('/api/admin/outreach/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAddLeadError(data.error || `Request failed (${response.status})`)
        return
      }
      setAddLeadSuccessId(data.id ?? null)
      if (data.outreach_queued) {
        setAddLeadOutreachToast(true)
        setTimeout(() => setAddLeadOutreachToast(false), 8000)
      }
      setShowAddLeadModal(false)
      resetAddLeadForm()
      await fetchLeads()
      if (data.id != null) setExpandedLeadId(data.id)
    } catch (err) {
      setAddLeadError(err instanceof Error ? err.message : 'Failed to add lead')
    } finally {
      setAddLeadLoading(false)
    }
  }

  const getScoreBadgeColor = (score: number | null) => {
    if (!score) return 'bg-silicon-slate text-foreground'
    if (score >= 70) return 'bg-green-900/50 text-green-400 border border-green-700'
    if (score >= 40) return 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
    return 'bg-red-900/50 text-red-400 border border-red-700'
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-radiant-gold/20 text-radiant-gold border border-radiant-gold/50',
      approved: 'bg-green-900/50 text-green-400 border border-green-700',
      sent: 'bg-silicon-slate text-foreground border border-silicon-slate',
      replied: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700',
      bounced: 'bg-red-900/50 text-red-400 border border-red-700',
      cancelled: 'bg-silicon-slate/70 text-muted-foreground border border-silicon-slate',
      rejected: 'bg-red-900/50 text-red-400 border border-red-700',
    }
    return colors[status] || 'bg-silicon-slate/70 text-muted-foreground'
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
              {activeTab === 'queue'
                ? 'Review and approve AI-generated outreach messages before sending'
                : activeTab === 'escalations'
                  ? 'Chat and voice escalations — link to leads and view transcripts'
                  : 'Manage all leads, view details, and track progress'}
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
                onClick={() => {
                  setShowAddLeadModal(true)
                  setAddLeadError(null)
                  setAddLeadSuccessId(null)
                }}
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
              onClick={activeTab === 'queue' ? fetchData : activeTab === 'leads' ? fetchLeads : fetchEscalations}
              className="flex items-center gap-2 px-4 py-2 btn-ghost rounded-lg transition-colors"
            >
              <RefreshCw size={16} className={(loading || leadsLoading || escalationsLoading) ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-silicon-slate">
          <button
            onClick={() => handleTabChange('queue')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${
              activeTab === 'queue'
                ? 'border-radiant-gold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare size={18} />
            <span className="font-medium">Message Queue</span>
            {stats && stats.draft > 0 && (
              <span className="px-2 py-0.5 bg-radiant-gold text-imperial-navy text-xs font-semibold rounded-full">
                {stats.draft}
              </span>
            )}
          </button>
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

        {/* Queue Tab Content */}
        {activeTab === 'queue' && (
          <>
            {/* Stats */}
            {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {Object.entries(stats)
              .filter(([key]) => key !== 'total')
              .map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`p-3 rounded-lg border transition-all ${
                    statusFilter === key
                      ? 'bg-silicon-slate border-radiant-gold'
                      : 'bg-silicon-slate/50 border-silicon-slate hover:bg-silicon-slate'
                  }`}
                >
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                </button>
              ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Filter size={14} className="text-gray-500" />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Channels</option>
            <option value="email">Email Only</option>
            <option value="linkedin">LinkedIn Only</option>
          </select>

          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
          />

          <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full border-l border-silicon-slate/60 pl-3 ml-1">
            {gmailUserOAuthStatus === null ? (
              <span className="text-xs text-muted-foreground">My Gmail…</span>
            ) : !gmailUserOAuthStatus.configured ? (
              <span
                className="text-xs text-muted-foreground"
                title="An administrator must enable Google sign-in for Gmail drafts on the server"
              >
                My Gmail drafts: unavailable
              </span>
            ) : gmailUserOAuthStatus.connected ? (
              <>
                <span className="text-xs text-emerald-400/90 truncate max-w-[220px]">
                  My Gmail: {gmailUserOAuthStatus.googleEmail}
                </span>
                <button
                  type="button"
                  onClick={() => void disconnectGmailUserOAuth()}
                  disabled={gmailOAuthDisconnectLoading}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-silicon-slate text-muted-foreground hover:text-rose-300 disabled:opacity-50"
                  title="Remove saved Gmail access for your admin login"
                >
                  {gmailOAuthDisconnectLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Unplug size={12} />
                  )}
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startGmailUserOAuthConnect()}
                disabled={gmailOAuthConnectLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-emerald-600/50 text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-50"
                title="Sign in with Google so the app can create drafts in your Gmail"
              >
                {gmailOAuthConnectLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Mail size={14} />
                )}
                Connect my Gmail
              </button>
            )}
          </div>

          {/* Contact Filter Badge */}
          {contactFilter && filteredContactName && (
            <div className="flex items-center gap-2 px-3 py-2 bg-silicon-slate border border-radiant-gold/50 rounded-lg">
              <Users size={14} className="text-blue-400" />
              <span className="text-sm text-blue-400">
                Filtered by: <span className="font-medium">{filteredContactName}</span>
              </span>
              <button
                onClick={() => {
                  setContactFilter(null)
                  setFilteredContactName(null)
                  const params = new URLSearchParams(searchParams?.toString() || '')
                  params.delete('contact')
                  router.push(`/admin/outreach?${params.toString()}`)
                }}
                className="p-0.5 hover:bg-radiant-gold/20 rounded transition-colors"
              >
                <X size={14} className="text-blue-400" />
              </button>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedIds.size > 0 && statusFilter === 'draft' && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => handleAction('approve', Array.from(selectedIds))}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle size={14} />
                Approve All
              </button>
              <button
                onClick={() => handleAction('reject', Array.from(selectedIds))}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <XCircle size={14} />
                Reject All
              </button>
            </div>
          )}
        </div>

        {/* Select All */}
        {items.length > 0 && statusFilter === 'draft' && (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={selectedIds.size === items.length && items.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800"
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}

        {/* Items List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium text-muted-foreground">
              No {statusFilter} messages
            </h3>
            <p className="text-muted-foreground mt-2">
              {statusFilter === 'draft'
                ? 'New drafts will appear here when leads are processed'
                : `No messages with status "${statusFilter}"`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-silicon-slate/50 border border-silicon-slate rounded-xl overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-4 flex items-start gap-3">
                    {statusFilter === 'draft' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800"
                      />
                    )}

                    {/* Channel Icon */}
                    <div
                      className={`p-2 rounded-lg ${
                        item.channel === 'email'
                          ? 'bg-silicon-slate text-radiant-gold'
                          : 'bg-sky-900/30 text-sky-400'
                      }`}
                    >
                      {item.channel === 'email' ? (
                        <Mail size={20} />
                      ) : (
                        <Linkedin size={20} />
                      )}
                    </div>

                    {/* Lead Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">
                          <Link href={`/admin/contacts/${item.contact_submission_id}`} className="hover:text-teal-400 transition-colors">
                            {item.contact_submissions?.name || 'Unknown'}
                          </Link>
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs ${getScoreBadgeColor(item.contact_submissions?.lead_score)}`}>
                          Score: {item.contact_submissions?.lead_score || 'N/A'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Step {item.sequence_step}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        {item.contact_submissions?.job_title && (
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {item.contact_submissions.job_title}
                          </span>
                        )}
                        {item.contact_submissions?.company && (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} />
                            {item.contact_submissions.company}
                          </span>
                        )}
                        {item.contact_submissions?.ai_readiness_score && (
                          <span className="flex items-center gap-1">
                            <Star size={12} />
                            AI: {item.contact_submissions.ai_readiness_score}/10
                          </span>
                        )}
                      </div>
                      {item.channel === 'email' && item.subject && (
                        <p className="mt-2 text-sm text-foreground">
                          <span className="text-muted-foreground">Subject:</span>{' '}
                          {item.subject}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/outreach?tab=leads&id=${item.contact_submission_id}`}
                        className="p-2 rounded-lg bg-silicon-slate hover:bg-silicon-slate/80 text-radiant-gold transition-colors"
                        title="View Lead Profile"
                      >
                        <User size={16} />
                      </Link>
                      {item.channel === 'email' &&
                        (item.status === 'draft' || item.status === 'approved') && (
                          <>
                            <button
                              type="button"
                              onClick={() => openDraftInGmail(item)}
                              disabled={
                                actionLoading ||
                                !item.contact_submissions?.email?.trim()?.includes('@')
                              }
                              className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-muted-foreground hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                              aria-label="Open draft in Gmail compose"
                              title={
                                item.contact_submissions?.email?.trim()?.includes('@')
                                  ? 'Open Gmail compose with this draft pre-filled'
                                  : 'Lead has no email — add one on the contact profile'
                              }
                            >
                              <ExternalLink size={16} />
                            </button>
                            {gmailUserOAuthStatus?.connected && (
                              <button
                                type="button"
                                onClick={() => void saveGmailUserDraft(item)}
                                disabled={
                                  actionLoading ||
                                  gmailUserDraftLoadingId === item.id ||
                                  !item.contact_submissions?.email
                                    ?.trim()
                                    ?.includes('@')
                                }
                                className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-muted-foreground hover:text-violet-300 disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Save draft to my Gmail"
                                title={
                                  item.contact_submissions?.email?.trim()?.includes('@')
                                    ? 'Create a draft in your Gmail (OAuth) — opens Drafts in a new tab'
                                    : 'Lead has no email — add one on the contact profile'
                                }
                              >
                                {gmailUserDraftLoadingId === item.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Save size={16} />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      {(item.status === 'draft' || item.status === 'approved') && (
                        <button
                          type="button"
                          onClick={() => void emailDraftCopyToInbox(item)}
                          disabled={
                            actionLoading ||
                            emailDraftInboxLoadingId === item.id
                          }
                          className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-muted-foreground hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Email a copy of this draft to my inbox"
                          title="Email a copy to the address on your admin profile (uses the site’s configured mail sender)"
                        >
                          {emailDraftInboxLoadingId === item.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Inbox size={16} />
                          )}
                        </button>
                      )}
                      {item.status === 'draft' && (
                        <>
                          <button
                            onClick={() => startEditing(item)}
                            className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-muted-foreground hover:text-white"
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleAction('approve', [item.id])}
                            disabled={actionLoading}
                            className="p-2 rounded-lg bg-green-900/30 hover:bg-green-800/50 transition-colors text-green-400 disabled:opacity-50"
                            title="Approve"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => handleAction('reject', [item.id])}
                            disabled={actionLoading}
                            className="p-2 rounded-lg bg-red-900/30 hover:bg-red-800/50 transition-colors text-red-400 disabled:opacity-50"
                            title="Reject"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <button
                          onClick={() => handleSend(item.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 px-3 py-2 btn-gold text-imperial-navy hover:opacity-90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <Send size={14} />
                          Send Now
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === item.id ? null : item.id)
                        }
                        className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-muted-foreground"
                      >
                        {expandedId === item.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {expandedId === item.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-silicon-slate"
                      >
                        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Message Preview */}
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Eye size={14} />
                              Message Preview
                            </h4>
                            {editingId === item.id ? (
                              <div className="space-y-3">
                                {item.channel === 'email' && (
                                  <input
                                    type="text"
                                    value={editSubject}
                                    onChange={(e) =>
                                      setEditSubject(e.target.value)
                                    }
                                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                                    placeholder="Subject"
                                  />
                                )}
                                <textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  rows={8}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold resize-y"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEdit(item.id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1.5 btn-gold text-imperial-navy hover:opacity-90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                  >
                                    Save Changes
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="px-3 py-1.5 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg text-sm transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-background/60 rounded-lg p-4 text-sm whitespace-pre-wrap text-foreground max-h-64 overflow-y-auto">
                                {item.body}
                              </div>
                            )}

                            {/* Reply Content */}
                            {item.reply_content && (
                              <div className="mt-4">
                                <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-1">
                                  <MessageSquare size={14} />
                                  Reply Received
                                </h4>
                                <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-4 text-sm text-emerald-300 whitespace-pre-wrap">
                                  {item.reply_content}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Lead Research Brief */}
                          <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Star size={14} />
                              Lead Research Brief
                            </h4>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-background/60 rounded-lg p-3">
                                  <div className="text-muted-foreground text-xs">Lead Score</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.lead_score || 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-background/60 rounded-lg p-3">
                                  <div className="text-muted-foreground text-xs">AI Readiness</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.ai_readiness_score || 'N/A'}/10
                                  </div>
                                </div>
                                <div className="bg-background/60 rounded-lg p-3">
                                  <div className="text-muted-foreground text-xs">Competitive Pressure</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.competitive_pressure_score || 'N/A'}/10
                                  </div>
                                </div>
                                <div className="bg-background/60 rounded-lg p-3">
                                  <div className="text-muted-foreground text-xs">Source</div>
                                  <div className="text-sm font-medium">
                                    {item.contact_submissions?.lead_source || 'N/A'}
                                  </div>
                                </div>
                              </div>

                              {(() => {
                                const qw = formatQuickWinsForDisplay(item.contact_submissions?.quick_wins as unknown)
                                if (!qw) return null
                                return (
                                  <div className="bg-background/60 rounded-lg p-3">
                                    <div className="text-muted-foreground text-xs mb-1">Quick Wins</div>
                                    <div className="text-sm text-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">
                                      {qw}
                                    </div>
                                  </div>
                                )
                              })()}

                              <div className="flex gap-2">
                                {item.contact_submissions?.email && (
                                  <a
                                    href={`mailto:${item.contact_submissions.email}`}
                                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    <Mail size={12} />
                                    {item.contact_submissions.email}
                                  </a>
                                )}
                                {item.contact_submissions?.linkedin_url && (
                                  <a
                                    href={item.contact_submissions.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                                  >
                                    <ExternalLink size={12} />
                                    LinkedIn
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Metadata */}
                            <div className="mt-4 text-xs text-muted-foreground space-y-1">
                              <div className="flex items-center gap-1">
                                <Clock size={12} />
                                Created: {new Date(item.created_at).toLocaleString()}
                              </div>
                              {item.sent_at && (
                                <div>Sent: {new Date(item.sent_at).toLocaleString()}</div>
                              )}
                              {item.replied_at && (
                                <div>Replied: {new Date(item.replied_at).toLocaleString()}</div>
                              )}
                              {item.generation_model && (
                                <div>Model: {item.generation_model}</div>
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
        )}
          </>
        )}

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

            {/* Add lead modal */}
            <AnimatePresence>
              {showAddLeadModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                  onClick={() => !addLeadLoading && setShowAddLeadModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col bg-background border border-silicon-slate rounded-xl shadow-xl"
                  >
                    <div className="flex items-center justify-between p-6 pb-4">
                      <h3 className="text-lg font-semibold text-white">Add lead</h3>
                      <button
                        type="button"
                        onClick={() => !addLeadLoading && setShowAddLeadModal(false)}
                        className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-muted-foreground"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <form id="add-lead-form" onSubmit={handleAddLeadSubmit} className="flex-1 overflow-y-auto px-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Name *</label>
                        <input
                          type="text"
                          value={addLeadName}
                          onChange={(e) => setAddLeadName(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                        <input
                          type="email"
                          value={addLeadEmail}
                          onChange={(e) => setAddLeadEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="email@company.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Company</label>
                        <input
                          type="text"
                          value={addLeadCompany}
                          onChange={(e) => setAddLeadCompany(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Company name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Company website</label>
                        <input
                          type="text"
                          value={addLeadCompanyWebsite}
                          onChange={(e) => setAddLeadCompanyWebsite(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="company.com or https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">LinkedIn URL</label>
                        <input
                          type="url"
                          value={addLeadLinkedInUrl}
                          onChange={(e) => setAddLeadLinkedInUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Job title</label>
                        <input
                          type="text"
                          value={addLeadJobTitle}
                          onChange={(e) => setAddLeadJobTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Job title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Industry</label>
                        <input
                          type="text"
                          value={addLeadIndustry}
                          onChange={(e) => setAddLeadIndustry(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="e.g. Technology, Healthcare"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                        <input
                          type="tel"
                          value={addLeadPhone}
                          onChange={(e) => setAddLeadPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">How did you get this lead?</label>
                        <select
                          value={addLeadInputType}
                          onChange={(e) => {
                            const val = e.target.value
                            setAddLeadInputType(val)
                            if (val === 'meeting') {
                              setAddLeadMeetingTab('readai')
                              if (addLeadEmail.trim()) setAddLeadReadAiEmail(addLeadEmail.trim())
                              if (addLeadMeetings.length === 0) fetchMeetingsForPicker()
                            }
                            if (val !== 'meeting') {
                              setAddLeadMeetingId(null)
                            }
                          }}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                        >
                          <option value="linkedin">LinkedIn</option>
                          <option value="referral">Referral</option>
                          <option value="business_card">Business card</option>
                          <option value="event">Event</option>
                          <option value="meeting">Meeting</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      {addLeadInputType === 'meeting' && (
                        <div className="space-y-3 p-3 rounded-lg border border-purple-700/50 bg-purple-900/20">
                          <div className="flex rounded-lg overflow-hidden border border-purple-700/40">
                            <button
                              type="button"
                              onClick={() => setAddLeadMeetingTab('readai')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${addLeadMeetingTab === 'readai' ? 'bg-cyan-700/60 text-cyan-100' : 'bg-silicon-slate/30 text-muted-foreground/90 hover:text-muted-foreground'}`}
                            >
                              <CalendarCheck size={12} /> Meetings
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddLeadMeetingTab('select')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${addLeadMeetingTab === 'select' ? 'bg-purple-700/60 text-purple-100' : 'bg-silicon-slate/30 text-muted-foreground/90 hover:text-muted-foreground'}`}
                            >
                              <Search size={12} /> Existing
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddLeadMeetingTab('paste')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${addLeadMeetingTab === 'paste' ? 'bg-purple-700/60 text-purple-100' : 'bg-silicon-slate/30 text-muted-foreground/90 hover:text-muted-foreground'}`}
                            >
                              <FileText size={12} /> Paste
                            </button>
                          </div>

                          {addLeadMeetingTab === 'readai' && (
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  value={addLeadReadAiEmail}
                                  onChange={(e) => setAddLeadReadAiEmail(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddLeadReadAiSearch()}
                                  className="flex-1 px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-cyan-500 text-sm"
                                  placeholder="Search by attendee email..."
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddLeadReadAiSearch()}
                                  disabled={!addLeadReadAiEmail.trim() || addLeadReadAiLoading}
                                  className="px-3 py-2 rounded-lg bg-cyan-700/50 hover:bg-cyan-700/70 text-cyan-200 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {addLeadReadAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                  Search
                                </button>
                              </div>

                              {addLeadReadAiLoading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                  <Loader2 size={14} className="animate-spin" />
                                  Loading meeting records and Read.ai matches…
                                </div>
                              )}

                              {addLeadReadAiSearched && !addLeadReadAiLoading && addLeadReadAiMeetings.length === 0 && (
                                <p className="text-sm text-muted-foreground/90 py-1">
                                  No meeting records matched this email, and nothing was found in Read.ai in the last 30 days.
                                </p>
                              )}

                              {addLeadReadAiSearched && !addLeadReadAiLoading && getReadAiCacheAge(addLeadReadAiEmail) && (
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
                                  <span>Fetched {getReadAiCacheAge(addLeadReadAiEmail)}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddLeadReadAiSearch(true)}
                                    className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                                  >
                                    <RefreshCw size={10} /> Refresh
                                  </button>
                                </div>
                              )}

                              {addLeadReadAiMeetings.map((m) => {
                                const date = new Date(m.start_time_ms)
                                return (
                                  <div
                                    key={m.id}
                                    className="p-3 rounded-lg border border-silicon-slate/60 bg-silicon-slate/30 space-y-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{m.title}</div>
                                        <div className="text-xs text-muted-foreground/90">
                                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          {m.platform && (
                                            <span className="ml-1 capitalize">
                                              · {m.platform === 'record' ? 'Record' : m.platform}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAddLeadReadAiImport(m.id)}
                                        disabled={addLeadExtractLoading}
                                        className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                                      >
                                        {addLeadExtractLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                        Import
                                      </button>
                                    </div>
                                    {m.summary && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">{m.summary}</p>
                                    )}
                                    <div className="text-xs text-muted-foreground/80">
                                      {m.participants.map((p) => p.name).filter(Boolean).join(', ')}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {addLeadMeetingTab === 'select' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-purple-300 mb-1">Select meeting</label>
                                {addLeadMeetingsLoading ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 size={14} className="animate-spin" /> Loading meetings...
                                  </div>
                                ) : (
                                  <select
                                    value={addLeadMeetingId || ''}
                                    onChange={(e) => setAddLeadMeetingId(e.target.value || null)}
                                    className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-purple-500"
                                  >
                                    <option value="">Choose a meeting...</option>
                                    {addLeadMeetings.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.meeting_date ? new Date(m.meeting_date).toLocaleDateString() : 'No date'} — {m.meeting_type}{m.contact_name ? ` (linked: ${m.contact_name})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              {addLeadMeetingId && (
                                <button
                                  type="button"
                                  onClick={() => handleExtractFromMeeting(addLeadMeetingId)}
                                  disabled={addLeadExtractLoading}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-700/50 hover:bg-purple-700/70 text-purple-200 text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                  {addLeadExtractLoading ? (
                                    <>
                                      <Loader2 size={14} className="animate-spin" />
                                      Analyzing transcript...
                                    </>
                                  ) : (
                                    <>
                                      <Cpu size={14} />
                                      Extract lead info from transcript
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}

                          {addLeadMeetingTab === 'paste' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-purple-300 mb-1">Meeting title (optional)</label>
                                <input
                                  type="text"
                                  value={addLeadPasteTitle}
                                  onChange={(e) => setAddLeadPasteTitle(e.target.value)}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500"
                                  placeholder="e.g. Coffee chat with Jane at FinTech Summit"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-sm font-medium text-purple-300 mb-1">Attendee name</label>
                                  <input
                                    type="text"
                                    value={addLeadPasteAttendeeName}
                                    onChange={(e) => setAddLeadPasteAttendeeName(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500"
                                    placeholder="Jane Doe"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-purple-300 mb-1">Attendee email</label>
                                  <input
                                    type="email"
                                    value={addLeadPasteAttendeeEmail}
                                    onChange={(e) => setAddLeadPasteAttendeeEmail(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500"
                                    placeholder="jane@example.com"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-purple-300 mb-1">Transcript</label>
                                <textarea
                                  value={addLeadPasteText}
                                  onChange={(e) => setAddLeadPasteText(e.target.value)}
                                  rows={6}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-purple-500 resize-y text-sm"
                                  placeholder="Paste your meeting transcript here..."
                                />
                                {addLeadPasteText.trim() && (
                                  <p className="text-xs text-muted-foreground/80 mt-1">{addLeadPasteText.trim().length.toLocaleString()} characters</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={handlePasteAndExtract}
                                disabled={!addLeadPasteText.trim() || addLeadPasteSaving || addLeadExtractLoading}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-700/50 hover:bg-purple-700/70 text-purple-200 text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                {addLeadPasteSaving || addLeadExtractLoading ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    {addLeadPasteSaving ? 'Saving transcript...' : 'Extracting lead info...'}
                                  </>
                                ) : (
                                  <>
                                    <Cpu size={14} />
                                    Save &amp; Extract lead info
                                  </>
                                )}
                              </button>
                            </>
                          )}

                          {addLeadExtractLoading && (
                            <div className="space-y-2">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-8 rounded bg-silicon-slate/50 animate-pulse" />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Message / notes</label>
                        <textarea
                          value={addLeadMessage}
                          onChange={(e) => setAddLeadMessage(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                          placeholder="Optional notes"
                        />
                      </div>
                      {/* Pending AI-extracted suggestions for admin approval */}
                      {addLeadPendingExtracts.length > 0 && (
                        <div className="p-3 rounded-lg border border-amber-700/50 bg-amber-900/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                              <AlertTriangle size={14} />
                              Review extracted items ({addLeadPendingExtracts.length})
                            </h4>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  for (const item of addLeadPendingExtracts) {
                                    if (item.field === 'pain_points') {
                                      setAddLeadPainPoints((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                                    } else {
                                      setAddLeadQuickWins((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                                    }
                                  }
                                  setAddLeadPendingExtracts([])
                                  setShowVepSection(true)
                                }}
                                className="px-2 py-1 text-xs font-medium rounded bg-green-900/50 text-green-400 border border-green-700 hover:bg-green-800/50"
                              >
                                Approve all
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddLeadPendingExtracts([])}
                                className="px-2 py-1 text-xs font-medium rounded bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-800/50"
                              >
                                Decline all
                              </button>
                            </div>
                          </div>
                          {addLeadPendingExtracts.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 p-2 rounded bg-silicon-slate/30">
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                                item.field === 'pain_points'
                                  ? 'bg-red-900/50 text-red-400'
                                  : 'bg-green-900/50 text-green-400'
                              }`}>
                                {item.field === 'pain_points' ? 'Pain point' : 'Quick win'}
                              </span>
                              <p className="flex-1 text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.field === 'pain_points') {
                                      setAddLeadPainPoints((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                                    } else {
                                      setAddLeadQuickWins((prev) => [prev, item.content].filter(Boolean).join('\n\n'))
                                    }
                                    setAddLeadPendingExtracts((prev) => prev.filter((_, i) => i !== idx))
                                    setShowVepSection(true)
                                  }}
                                  className="p-1 rounded hover:bg-green-900/50 text-green-400"
                                  title="Approve"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAddLeadPendingExtracts((prev) => prev.filter((_, i) => i !== idx))}
                                  className="p-1 rounded hover:bg-red-900/50 text-red-400"
                                  title="Decline"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border border-silicon-slate rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowVepSection((v) => !v)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-silicon-slate/50 hover:bg-silicon-slate text-left text-sm font-medium text-muted-foreground"
                        >
                          Value Evidence (optional)
                          {showVepSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {showVepSection && (
                          <div className="p-3 space-y-3 border-t border-silicon-slate">
                            <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">Company size</label>
                              <select
                                value={addLeadEmployeeCount}
                                onChange={(e) => setAddLeadEmployeeCount(e.target.value)}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                              >
                                <option value="">Select range</option>
                                <option value="1-10">1-10</option>
                                <option value="11-50">11-50</option>
                                <option value="51-200">51-200</option>
                                <option value="201-500">201-500</option>
                                <option value="501-1000">501-1000</option>
                                <option value="1000+">1000+</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">Quick wins</label>
                              <textarea
                                value={addLeadQuickWins}
                                onChange={(e) => setAddLeadQuickWins(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                                placeholder="Quick-win AI opportunities with 90-day ROI potential"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">Known pain points</label>
                              <textarea
                                value={addLeadPainPoints}
                                onChange={(e) => setAddLeadPainPoints(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                                placeholder="Known challenges, bottlenecks, or pain points for this lead"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {addLeadError && (
                        <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm flex items-center gap-2">
                          <AlertTriangle size={16} />
                          {addLeadError}
                        </div>
                      )}
                      <div className="h-4" />
                    </form>
                    <div className="flex gap-3 p-6 pt-4 border-t border-silicon-slate">
                      <button
                        type="submit"
                        form="add-lead-form"
                        disabled={addLeadLoading || addLeadExtractLoading || !addLeadName.trim()}
                        className="flex-1 px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                      >
                        {addLeadLoading ? 'Adding...' : addLeadInputType === 'meeting' && addLeadMeetingId ? 'Add lead & queue email' : 'Add lead'}
                      </button>
                      <button
                        type="button"
                        onClick={() => !addLeadLoading && setShowAddLeadModal(false)}
                        className="px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success toast when lead was just added */}
            {addLeadSuccessId != null && !showAddLeadModal && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-lg bg-green-900/30 border border-green-800 text-green-300 text-sm flex items-center gap-2"
              >
                <CheckCircle size={16} />
                Lead added successfully.
                <button
                  type="button"
                  onClick={() => setAddLeadSuccessId(null)}
                  className="ml-auto p-1 hover:bg-silicon-slate rounded"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
            {addLeadOutreachToast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 rounded-lg bg-purple-900/30 border border-purple-700 text-purple-300 text-sm flex items-center gap-2"
              >
                <Mail size={16} />
                Discovery email is being generated — check the Message Queue in ~30 seconds.
                <button
                  type="button"
                  onClick={() => setAddLeadOutreachToast(false)}
                  className="ml-auto p-1 hover:bg-silicon-slate rounded"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}

            {/* Unified Lead modal (Edit + Review & Enrich) */}
            <AnimatePresence>
              {showEnrichModal && enrichModalLeads.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                  onClick={() => !pushLoading && !unifiedModalSaveLoading && setShowEnrichModal(false)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-background border border-silicon-slate rounded-xl shadow-xl"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-silicon-slate">
                      <h3 className="text-lg font-semibold text-white">
                        {enrichModalLeads.length === 1 ? enrichModalLeads[0].name : 'Lead'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => !pushLoading && !unifiedModalSaveLoading && setShowEnrichModal(false)}
                        className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-muted-foreground"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[20rem]">
                      {enrichModalLeads.map((l) => (
                        <div
                          key={l.id}
                          className={`p-4 rounded-lg border ${l.has_extractable_text ? 'border-silicon-slate bg-silicon-slate/50' : 'border-radiant-gold/50 bg-radiant-gold/10'}`}
                        >
                          {enrichModalLeads.length > 1 && (
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium text-white">{l.name}</span>
                              {!l.has_extractable_text && (
                                <span className="text-xs text-amber-400">Needs enrichment</span>
                              )}
                            </div>
                          )}
                          {/* Lead details section */}
                          <div className="space-y-3 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">Name *</label>
                              <input
                                type="text"
                                value={enrichModalForm[l.id]?.name ?? l.name ?? ''}
                                onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], name: e.target.value } }))}
                                required
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                placeholder="Full name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                              <input
                                type="email"
                                value={enrichModalForm[l.id]?.email ?? l.email ?? ''}
                                onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], email: e.target.value } }))}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                placeholder="email@company.com"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Company</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.company ?? l.company ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], company: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="Company name"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Company website</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.company_domain ?? l.company_domain ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], company_domain: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="company.com or https://..."
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">LinkedIn URL</label>
                                <input
                                  type="url"
                                  value={enrichModalForm[l.id]?.linkedin_url ?? l.linkedin_url ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], linkedin_url: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="https://linkedin.com/in/..."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Job title</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.job_title ?? l.job_title ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], job_title: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="Job title"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Industry</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.industry ?? l.industry ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], industry: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="e.g. Technology, Healthcare"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                                <input
                                  type="tel"
                                  value={enrichModalForm[l.id]?.phone_number ?? l.phone_number ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], phone_number: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="+1 234 567 8900"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">How did you get this lead?</label>
                              <select
                                value={enrichModalForm[l.id]?.input_type ?? inputTypeFromLeadSource(l.lead_source)}
                                onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], input_type: e.target.value } }))}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                              >
                                <option value="linkedin">LinkedIn</option>
                                <option value="referral">Referral</option>
                                <option value="business_card">Business card</option>
                                <option value="event">Event</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-muted-foreground mb-1">Message / notes</label>
                              <textarea
                                value={enrichModalForm[l.id]?.message ?? l.message ?? ''}
                                onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], message: e.target.value } }))}
                                rows={2}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                                placeholder="Optional notes"
                              />
                            </div>
                          </div>
                          {/* Value Evidence section */}
                          <div className="pt-3 border-t border-silicon-slate space-y-3">
                            <h4 className="text-sm font-medium text-muted-foreground">Value Evidence</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Pain points</label>
                                <textarea
                                  value={enrichModalForm[l.id]?.rep_pain_points ?? l.rep_pain_points ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], rep_pain_points: e.target.value } }))}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                                  placeholder="Known pain points"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Quick wins</label>
                                <textarea
                                  value={enrichModalForm[l.id]?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], quick_wins: e.target.value } }))}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-muted-foreground/60 focus:outline-none focus:border-radiant-gold resize-y"
                                  placeholder="Quick wins"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Company size</label>
                                <select
                                  value={enrichModalForm[l.id]?.employee_count ?? l.employee_count ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], employee_count: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white focus:outline-none focus:border-radiant-gold"
                                >
                                  <option value="">Select</option>
                                  <option value="1-10">1-10</option>
                                  <option value="11-50">11-50</option>
                                  <option value="51-200">51-200</option>
                                  <option value="201-500">201-500</option>
                                  <option value="501-1000">501-1000</option>
                                  <option value="1000+">1000+</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Meeting Context: attributed meeting_records + Read.ai (when email present) */}
                          <div className="pt-3 border-t border-silicon-slate">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setMeetingSectionExpanded((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
                                  className="flex items-center gap-2 flex-1 text-left"
                                >
                                  <CalendarCheck size={16} className="text-cyan-400" />
                                  <h4 className="text-sm font-medium text-muted-foreground flex-1">
                                    Meeting Context
                                    {(meetingsByLead[l.id]?.length ?? 0) > 0 && (
                                      <span className="ml-2 text-xs text-cyan-400">
                                        ({meetingsByLead[l.id].length} found)
                                      </span>
                                    )}
                                  </h4>
                                  {meetingsLoading[l.id] ? (
                                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                                  ) : (
                                    <ChevronRight
                                      size={14}
                                      className={`text-muted-foreground transition-transform ${meetingSectionExpanded[l.id] ? 'rotate-90' : ''}`}
                                    />
                                  )}
                                </button>
                                {!meetingsLoading[l.id] && (
                                  <div className="flex items-center gap-1.5">
                                    {l.email && getReadAiCacheAge(l.email) && (
                                      <span className="text-[10px] text-muted-foreground/80">{getReadAiCacheAge(l.email)}</span>
                                    )}
                                    <button
                                      type="button"
                                      title={l.email ? 'Refresh linked meetings and Read.ai' : 'Refresh linked meetings'}
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        const session = await getCurrentSession()
                                        if (session) {
                                          if (l.email) bustReadAiCache(l.email)
                                          fetchMeetingsForLead(l.id, l.email ?? null, session.access_token, true)
                                        }
                                      }}
                                      className="p-1 rounded hover:bg-silicon-slate/60 text-muted-foreground/80 hover:text-cyan-400 transition-colors"
                                    >
                                      <RefreshCw size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {meetingSectionExpanded[l.id] && (
                                <div className="mt-2 space-y-2">
                                  {meetingsLoading[l.id] && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                      <Loader2 size={14} className="animate-spin" />
                                      {l.email
                                        ? `Loading linked meetings and Read.ai matches for ${l.email}…`
                                        : 'Loading linked meetings…'}
                                    </div>
                                  )}

                                  {!meetingsLoading[l.id] && (meetingsByLead[l.id]?.length ?? 0) === 0 && (
                                    <p className="text-sm text-muted-foreground/90 py-1">
                                      {l.email
                                        ? `No meetings are linked to this lead in Meeting records, and nothing turned up in Read.ai for ${l.email} in the last 30 days.`
                                        : 'No meetings are linked to this lead in Meeting records.'}
                                    </p>
                                  )}

                                  {(meetingsByLead[l.id] || []).map((m) => {
                                    const isSelected = selectedMeetingIds[l.id]?.has(m.id) ?? false
                                    const date = new Date(m.start_time_ms)
                                    return (
                                      <label
                                        key={m.id}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                          isSelected
                                            ? 'border-cyan-500 bg-cyan-900/20'
                                            : 'border-silicon-slate/60 bg-silicon-slate/30 hover:border-silicon-slate'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleToggleMeeting(l.id, m.id)}
                                          className="mt-1 rounded border-silicon-slate bg-silicon-slate/50 text-cyan-400 focus:ring-cyan-400"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">{m.title}</span>
                                            <span className="text-xs text-muted-foreground/90 shrink-0">
                                              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground/90 mt-0.5">
                                            {m.participants.map((p) => p.name).filter(Boolean).join(', ')}
                                            {m.platform && (
                                              <span className="ml-1 capitalize">
                                                · {m.platform === 'record' ? 'Record' : m.platform}
                                              </span>
                                            )}
                                          </div>
                                          {m.summary && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.summary}</p>
                                          )}
                                        </div>
                                      </label>
                                    )
                                  })}

                                  {(selectedMeetingIds[l.id]?.size ?? 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleImportMeetings(l.id)}
                                      disabled={meetingImportLoading}
                                      className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                      {meetingImportLoading ? (
                                        <><Loader2 size={14} className="animate-spin" /> Importing...</>
                                      ) : (
                                        <>Import {selectedMeetingIds[l.id].size} meeting{selectedMeetingIds[l.id].size > 1 ? 's' : ''} into enrichment</>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                          {/* Review Meeting Notes — pending approval */}
                          {(pendingMeetingImports[l.id]?.length ?? 0) > 0 && (
                            <div className="pt-3 border-t border-silicon-slate">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                                  <AlertTriangle size={14} />
                                  Review Meeting Notes ({pendingMeetingImports[l.id].length} pending)
                                </h4>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAllMeetingImports(l.id)}
                                    className="px-2 py-1 text-xs font-medium rounded bg-green-900/50 text-green-400 border border-green-700 hover:bg-green-800/50"
                                  >
                                    Approve all
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeclineAllMeetingImports(l.id)}
                                    className="px-2 py-1 text-xs font-medium rounded bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-800/50"
                                  >
                                    Decline all
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {pendingMeetingImports[l.id].map((item, idx) => (
                                  <div
                                    key={`${item.meetingId}-${item.type}-${idx}`}
                                    className="p-3 rounded-lg border border-amber-700/50 bg-amber-900/10"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                                          item.type === 'pain_points'
                                            ? 'bg-red-900/50 text-red-400'
                                            : 'bg-green-900/50 text-green-400'
                                        }`}>
                                          {item.type === 'pain_points' ? 'Pain point' : 'Quick win'}
                                        </span>
                                        <span className="text-xs text-muted-foreground/90">
                                          {item.meetingTitle} ({item.meetingDate})
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleApproveMeetingImport(l.id, idx)}
                                          className="p-1 rounded hover:bg-green-900/50 text-green-400 transition-colors"
                                          title="Approve"
                                        >
                                          <CheckCircle size={16} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeclineMeetingImport(l.id, idx)}
                                          className="p-1 rounded hover:bg-red-900/50 text-red-400 transition-colors"
                                          title="Decline"
                                        >
                                          <XCircle size={16} />
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                                      {item.content}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Classified pain points preview */}
                          {(enrichClassifiedItems[l.id]?.length ?? 0) > 0 && (
                            <div className="pt-3 border-t border-silicon-slate">
                              <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                                <BarChart3 size={14} />
                                Classified Pain Points ({enrichClassifiedItems[l.id].length})
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {enrichClassifiedItems[l.id].map((item, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 rounded text-xs bg-purple-900/30 text-purple-300 border border-purple-700/50"
                                    title={`${item.text}\n\nCategory: ${item.categoryDisplayName}\nConfidence: ${(item.confidence * 100).toFixed(0)}%\nMethod: ${item.method}`}
                                  >
                                    {item.categoryDisplayName} ({(item.confidence * 100).toFixed(0)}%)
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {enrichModalLeads.length === 1 && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="unified-rerun-enrichment"
                            checked={unifiedModalReRunEnrichment}
                            onChange={(e) => setUnifiedModalReRunEnrichment(e.target.checked)}
                            className="rounded border-silicon-slate bg-silicon-slate/50 text-radiant-gold focus:ring-radiant-gold"
                          />
                          <label htmlFor="unified-rerun-enrichment" className="text-sm text-muted-foreground">
                            Re-run enrichment (send updated data to lead qualification workflow)
                          </label>
                        </div>
                      )}
                      {unifiedModalSaveError && (
                        <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm flex items-center gap-2">
                          <AlertTriangle size={16} />
                          {unifiedModalSaveError}
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-silicon-slate flex flex-col gap-2">
                      {(() => {
                        const allLeadsAlreadyHaveEvidence =
                          enrichModalLeads.length > 0 &&
                          enrichModalLeads.every((l) => (l.evidence_count ?? 0) > 0)
                        const showClassifyPrimary =
                          enrichModalVepPushCompleted || allLeadsAlreadyHaveEvidence
                        const hasClassifyPayload = enrichModalLeads.some((l) => {
                          const f = enrichModalForm[l.id]
                          const pain = (f?.rep_pain_points ?? l.rep_pain_points ?? '').trim()
                          const qw = (f?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)).trim()
                          return Boolean(pain || qw)
                        })
                        const anyExtractable = enrichModalLeads.some((l) => l.has_extractable_text)

                        return (
                          <>
                            {showClassifyPrimary && enrichModalVepPushCompleted && !allLeadsAlreadyHaveEvidence ? (
                              <p className="text-xs text-muted-foreground text-right">
                                Push started. Next, classify pain points and quick wins to store structured evidence.
                              </p>
                            ) : null}
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => !pushLoading && !unifiedModalSaveLoading && setShowEnrichModal(false)}
                                disabled={pushLoading || unifiedModalSaveLoading}
                                className="px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={
                                  pushLoading ||
                                  unifiedModalSaveLoading ||
                                  enrichModalLeads.some((l) => !(enrichModalForm[l.id]?.name ?? l.name)?.trim())
                                }
                                onClick={async () => {
                                  const session = await getCurrentSession()
                                  if (!session) return
                                  setUnifiedModalSaveError(null)
                                  setUnifiedModalSaveLoading(true)
                                  try {
                                    for (const l of enrichModalLeads) {
                                      const f = enrichModalForm[l.id]
                                      const name = (f?.name ?? l.name ?? '').trim()
                                      if (!name) continue
                                      const payload = {
                                        name,
                                        email: (f?.email ?? l.email ?? '').trim() || undefined,
                                        company: (f?.company ?? l.company ?? '').trim() || undefined,
                                        company_domain: (f?.company_domain ?? l.company_domain ?? '').trim() || undefined,
                                        linkedin_url: (f?.linkedin_url ?? l.linkedin_url ?? '').trim() || undefined,
                                        job_title: (f?.job_title ?? l.job_title ?? '').trim() || undefined,
                                        industry: (f?.industry ?? l.industry ?? '').trim() || undefined,
                                        phone_number: (f?.phone_number ?? l.phone_number ?? '').trim() || undefined,
                                        message: (f?.message ?? l.message ?? '').trim() || undefined,
                                        input_type: f?.input_type ?? inputTypeFromLeadSource(l.lead_source),
                                        employee_count: (f?.employee_count ?? l.employee_count ?? '').trim() || undefined,
                                        quick_wins:
                                          (f?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)).trim() ||
                                          undefined,
                                        rep_pain_points: (f?.rep_pain_points ?? l.rep_pain_points ?? '').trim() || undefined,
                                        re_run_enrichment: enrichModalLeads.length === 1 ? unifiedModalReRunEnrichment : false,
                                      }
                                      const res = await fetch(`/api/admin/outreach/leads/${l.id}`, {
                                        method: 'PATCH',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                        body: JSON.stringify(payload),
                                      })
                                      const data = await res.json().catch(() => ({}))
                                      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
                                    }
                                    setShowEnrichModal(false)
                                    setSelectedLeadIds(new Set())
                                    await fetchLeads()
                                  } catch (err) {
                                    setUnifiedModalSaveError(err instanceof Error ? err.message : 'Failed to save')
                                  } finally {
                                    setUnifiedModalSaveLoading(false)
                                  }
                                }}
                                className="px-4 py-2 bg-silicon-slate hover:bg-silicon-slate rounded-lg font-medium disabled:opacity-50"
                              >
                                {unifiedModalSaveLoading ? 'Saving...' : 'Save changes'}
                              </button>
                              {showClassifyPrimary ? (
                                <button
                                  type="button"
                                  disabled={
                                    !hasClassifyPayload ||
                                    Object.values(enrichClassifyLoading).some(Boolean) ||
                                    pushLoading ||
                                    unifiedModalSaveLoading
                                  }
                                  title={
                                    !hasClassifyPayload
                                      ? 'Add pain points or quick wins above to classify'
                                      : undefined
                                  }
                                  onClick={async () => {
                                    const session = await getCurrentSession()
                                    if (!session) return
                                    for (const l of enrichModalLeads) {
                                      const form = enrichModalForm[l.id]
                                      const painPoints = form?.rep_pain_points ?? l.rep_pain_points ?? ''
                                      const quickWins =
                                        form?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown)
                                      if (!painPoints.trim() && !quickWins.trim()) continue
                                      setEnrichClassifyLoading((prev) => ({ ...prev, [l.id]: true }))
                                      try {
                                        const res = await fetch('/api/admin/meetings/classify-pain-points', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${session.access_token}`,
                                          },
                                          body: JSON.stringify({
                                            pain_points: painPoints,
                                            quick_wins: quickWins,
                                            contact_submission_id: l.id,
                                            insert_evidence: true,
                                          }),
                                        })
                                        const data = await res.json()
                                        if (res.ok && data.classified) {
                                          setEnrichClassifiedItems((prev) => ({ ...prev, [l.id]: data.classified }))
                                        }
                                      } catch (err) {
                                        console.error('Classify failed:', err)
                                      } finally {
                                        setEnrichClassifyLoading((prev) => ({ ...prev, [l.id]: false }))
                                      }
                                    }
                                  }}
                                  className="px-4 py-2 bg-purple-600/80 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg font-medium"
                                >
                                  {Object.values(enrichClassifyLoading).some(Boolean)
                                    ? 'Classifying...'
                                    : 'Classify & Store Evidence'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={pushLoading || unifiedModalSaveLoading || !anyExtractable}
                                  title={
                                    !anyExtractable
                                      ? 'Add notes, diagnostic, or report data before pushing'
                                      : undefined
                                  }
                                  onClick={async () => {
                                    const session = await getCurrentSession()
                                    if (!session) return
                                    setPushLoading(true)
                                    try {
                                      const leadsPayload = enrichModalLeads.map((l) => {
                                        const form = enrichModalForm[l.id]
                                        const base = { contact_submission_id: l.id }
                                        const vals = {
                                          rep_pain_points: form?.rep_pain_points ?? l.rep_pain_points,
                                          message: form?.message ?? l.message,
                                          quick_wins:
                                            form?.quick_wins ?? quickWinsToEditableString(l.quick_wins as unknown),
                                          industry: form?.industry ?? l.industry,
                                          employee_count: form?.employee_count ?? l.employee_count,
                                          company: form?.company ?? l.company,
                                          company_domain: form?.company_domain ?? l.company_domain,
                                        }
                                        return {
                                          ...base,
                                          ...Object.fromEntries(
                                            Object.entries(vals).filter(([, v]) => v != null && String(v).trim())
                                          ),
                                        }
                                      })
                                      const res = await fetch('/api/admin/value-evidence/extract-leads', {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                        body: JSON.stringify({ leads: leadsPayload }),
                                      })
                                      const data = await res.json()
                                      if (!res.ok) throw new Error(data.error || 'Request failed')
                                      setEnrichModalVepPushCompleted(true)
                                      startVepPolling()
                                      setSelectedLeadIds(new Set())
                                      await fetchLeads()
                                    } catch (e) {
                                      console.error(e)
                                    } finally {
                                      setPushLoading(false)
                                    }
                                  }}
                                  className="px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 rounded-lg font-medium"
                                >
                                  {pushLoading ? 'Pushing...' : 'Push to Value Evidence'}
                                </button>
                              )}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

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
                      <Link
                        href="/admin/value-evidence?tab=dashboard&highlight=vep001"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-colors"
                      >
                        <ExternalLink size={14} aria-hidden />
                        Open Value Evidence
                      </Link>
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
                {selectedLeadIds.size === 0 && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-silicon-slate bg-silicon-slate/25 px-3 py-2.5 text-sm text-muted-foreground">
                    <span className="min-w-0">
                      Workflow progress, cancel, and run history: use the Value Evidence dashboard (not this list).
                    </span>
                    <Link
                      href="/admin/value-evidence?tab=dashboard&highlight=vep001"
                      className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-colors"
                    >
                      <ExternalLink size={14} aria-hidden />
                      Open Value Evidence
                    </Link>
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
                                href={`/admin/outreach?tab=queue&contact=${lead.id}`}
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-blue-300 transition-colors underline decoration-dotted decoration-blue-400/50 underline-offset-2 hover:decoration-blue-300"
                                title={`Open message queue (${lead.messages_count} messages, ${lead.messages_sent} sent)`}
                                aria-label={`Open message queue for ${lead.name}`}
                              >
                                <MessageSquare size={12} className="shrink-0" aria-hidden />
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
                                  className="px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-700 hover:bg-green-800/50"
                                >
                                  Evidence: {lead.evidence_count}
                                </button>
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

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {lead.evidence_count > 0 && (
                              <button
                                type="button"
                                onClick={async () => {
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
                                    const data = await res.json()
                                    if (res.ok) {
                                      // Start polling for extraction status
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
                                disabled={pushLoading}
                                className="px-3 py-2 bg-silicon-slate/50 hover:bg-silicon-slate text-foreground rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                              >
                                <RefreshCw size={14} />
                                Refresh evidence
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSocialIntelLeadId(lead.id)}
                              title="Run social intel for this lead"
                              className="px-3 py-2 bg-cyan-900/50 hover:bg-cyan-800/50 text-cyan-300 border border-cyan-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                            >
                              <Globe size={14} />
                              Social Intel
                            </button>
                            {lead.last_vep_status === 'pending' && lead.evidence_count === 0 && (
                              <button
                                type="button"
                                onClick={async () => {
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
                                disabled={pushLoading}
                                className="px-3 py-2 bg-amber-900/50 hover:bg-amber-800/50 text-amber-300 border border-amber-700 rounded-lg text-sm font-medium transition-colors"
                              >
                                Cancel extraction
                              </button>
                            )}
                            {!lead.do_not_contact && !lead.removed_at && (
                              <>
                                <button
                                  type="button"
                                  title="Trigger n8n workflow (WF-CLG-002)"
                                  onClick={async () => {
                                    const session = await getCurrentSession()
                                    if (!session) return
                                    setGenerateOutreachLoading(lead.id)
                                    try {
                                      const res = await fetch(`/api/admin/outreach/leads/${lead.id}/generate`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                      })
                                      const data = await res.json()
                                      if (res.ok && data.triggered) {
                                        setGenerateOutreachToast(`Email generation started for ${lead.name}`)
                                        setTimeout(() => setGenerateOutreachToast(null), 4000)
                                      }
                                    } catch (err) {
                                      console.error('Generate outreach failed:', err)
                                    } finally {
                                      setGenerateOutreachLoading(null)
                                    }
                                  }}
                                  disabled={generateOutreachLoading === lead.id || generateInAppLoading === lead.id}
                                  className="px-3 py-2 bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                  {generateOutreachLoading === lead.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Mail size={14} />
                                  )}
                                  Generate Email
                                </button>
                                <button
                                  type="button"
                                  title="Create draft in the app (OpenAI + Message Queue). No n8n."
                                  onClick={async () => {
                                    const session = await getCurrentSession()
                                    if (!session) return
                                    setGenerateInAppLoading(lead.id)
                                    try {
                                      const res = await fetch(
                                        `/api/admin/outreach/leads/${lead.id}/generate-in-app`,
                                        {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${session.access_token}`,
                                          },
                                          body: JSON.stringify({}),
                                        }
                                      )
                                      const data = await res.json().catch(() => ({}))
                                      if (res.ok && data.outcome === 'created') {
                                        setGenerateOutreachToast(
                                          `Draft saved for ${lead.name} — open Message Queue to review`
                                        )
                                        setTimeout(() => setGenerateOutreachToast(null), 6000)
                                        await fetchData()
                                      } else if (res.status === 409 && data.error) {
                                        setGenerateOutreachToast(data.error)
                                        setTimeout(() => setGenerateOutreachToast(null), 8000)
                                      } else if (data.error) {
                                        setGenerateOutreachToast(data.error)
                                        setTimeout(() => setGenerateOutreachToast(null), 6000)
                                      }
                                    } catch (err) {
                                      console.error('In-app generate failed:', err)
                                      setGenerateOutreachToast(
                                        'We could not create that draft. Please try again.'
                                      )
                                      setTimeout(() => setGenerateOutreachToast(null), 6000)
                                    } finally {
                                      setGenerateInAppLoading(null)
                                    }
                                  }}
                                  disabled={generateOutreachLoading === lead.id || generateInAppLoading === lead.id}
                                  className="px-3 py-2 bg-violet-900/30 hover:bg-violet-800/50 text-violet-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                  {generateInAppLoading === lead.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={14} />
                                  )}
                                  Draft in app
                                </button>
                              </>
                            )}
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
                                  className="absolute right-0 top-full mt-1 z-50 min-w-[13rem] py-1 rounded-lg border border-silicon-slate bg-background shadow-xl"
                                >
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
                            <button
                              onClick={() =>
                                setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)
                              }
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
                                    {lead.company && (
                                      <div className="flex items-center gap-2">
                                        <Building2 size={14} className="text-muted-foreground" />
                                        <span className="text-foreground">{lead.company}</span>
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
                                    const quickWinsText = formatQuickWinsForDisplay(lead.quick_wins as unknown)
                                    if (!quickWinsText) return null
                                    return (
                                      <div className="mt-3 bg-background/60 rounded-lg p-3">
                                        <div className="text-muted-foreground text-xs mb-1">Quick Wins</div>
                                        <div className="text-sm text-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">
                                          {quickWinsText}
                                        </div>
                                      </div>
                                    )
                                  })()}

                                  {/* Related meetings for this lead */}
                                  {expandedLeadId === lead.id && (leadMeetingsLoading || leadMeetings.length > 0) && (
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
                                          {leadMeetings.map((m) => (
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
