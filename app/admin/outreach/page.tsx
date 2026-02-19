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
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
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
}

interface LeadsResponse {
  leads: Lead[]
  total: number
  page: number
}

type TabType = 'queue' | 'leads'

function EvidenceCard({ evidence }: { evidence: { id: string; display_name: string | null; source_excerpt: string; confidence_score: number; monetary_indicator?: number | null } }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = evidence.source_excerpt.length > 100
  return (
    <li className="p-3 rounded-lg bg-silicon-slate/50 border border-silicon-slate text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{evidence.display_name ?? 'Unknown'}</span>
        <span className="text-xs text-platinum-white/60 ml-2 shrink-0">
          {(evidence.confidence_score * 100).toFixed(0)}%
          {evidence.monetary_indicator != null && ` · $${Number(evidence.monetary_indicator).toLocaleString()}`}
        </span>
      </div>
      <p className={`text-platinum-white/80 mt-1 ${isLong && !expanded ? 'line-clamp-2' : ''}`}>
        {evidence.source_excerpt}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-purple-400 hover:text-purple-300 mt-1"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </li>
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
  
  // Tab management
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = searchParams?.get('tab')
    return (tab === 'leads' || tab === 'queue') ? tab : 'queue'
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

  // VEP extraction polling: track IDs being extracted
  const vepPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [vepPollingActive, setVepPollingActive] = useState(false)

  // Unified lead modal: re-run enrichment (for Save), loading, error
  const [unifiedModalReRunEnrichment, setUnifiedModalReRunEnrichment] = useState(true)
  const [unifiedModalSaveLoading, setUnifiedModalSaveLoading] = useState(false)
  const [unifiedModalSaveError, setUnifiedModalSaveError] = useState<string | null>(null)

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

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchData()
    } else if (activeTab === 'leads') {
      fetchLeads()
    }
  }, [activeTab, fetchData, fetchLeads])

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
      setEnrichModalLeads(data.leads || [])
      setEnrichModalForm({})
      setUnifiedModalReRunEnrichment(true)
      setUnifiedModalSaveError(null)
      setShowEnrichModal(true)
    } catch (e) {
      console.error(e)
    } finally {
      setPushLoading(false)
    }
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
      const payload = {
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
    if (!score) return 'bg-silicon-slate text-platinum-white'
    if (score >= 70) return 'bg-green-900/50 text-green-400 border border-green-700'
    if (score >= 40) return 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
    return 'bg-red-900/50 text-red-400 border border-red-700'
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-radiant-gold/20 text-radiant-gold border border-radiant-gold/50',
      approved: 'bg-green-900/50 text-green-400 border border-green-700',
      sent: 'bg-silicon-slate text-platinum-white border border-silicon-slate',
      replied: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700',
      bounced: 'bg-red-900/50 text-red-400 border border-red-700',
      cancelled: 'bg-silicon-slate/70 text-platinum-white/80 border border-silicon-slate',
      rejected: 'bg-red-900/50 text-red-400 border border-red-700',
    }
    return colors[status] || 'bg-silicon-slate/70 text-platinum-white/80'
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
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              Lead Pipeline
            </h1>
            <p className="text-platinum-white/80 mt-1">
              {activeTab === 'queue' 
                ? 'Review and approve AI-generated outreach messages before sending'
                : 'Manage all leads, view details, and track progress'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/outreach/dashboard">
              <button className="flex items-center gap-2 px-4 py-2 btn-gold text-imperial-navy font-semibold rounded-lg transition-colors">
                <BarChart3 size={16} />
                Dashboard & Triggers
              </button>
            </Link>
            <button
              onClick={activeTab === 'queue' ? fetchData : fetchLeads}
              className="flex items-center gap-2 px-4 py-2 btn-ghost rounded-lg transition-colors"
            >
              <RefreshCw size={16} className={(loading || leadsLoading) ? 'animate-spin' : ''} />
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
                : 'border-transparent text-platinum-white/80 hover:text-foreground'
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
                : 'border-transparent text-platinum-white/80 hover:text-foreground'
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
                  <div className="text-xs text-platinum-white/80 capitalize">{key}</div>
                </button>
              ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-platinum-white/60" />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-platinum-white/60" />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-silicon-slate/50 border border-silicon-slate rounded-lg px-3 py-2 text-white focus:outline-none focus:border-radiant-gold"
            >
              <option value="all">All Channels</option>
              <option value="email">Email Only</option>
              <option value="linkedin">LinkedIn Only</option>
            </select>
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
              <span className="text-sm text-platinum-white/80">
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
            <span className="text-sm text-platinum-white/80">Select all</span>
          </div>
        )}

        {/* Items List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-platinum-white/60" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={48} className="mx-auto text-platinum-white/60 mb-4" />
            <h3 className="text-xl font-medium text-platinum-white/80">
              No {statusFilter} messages
            </h3>
            <p className="text-platinum-white/60 mt-2">
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
                          {item.contact_submissions?.name || 'Unknown'}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs ${getScoreBadgeColor(item.contact_submissions?.lead_score)}`}>
                          Score: {item.contact_submissions?.lead_score || 'N/A'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(item.status)}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-platinum-white/60">
                          Step {item.sequence_step}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-platinum-white/80">
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
                        <p className="mt-2 text-sm text-platinum-white">
                          <span className="text-platinum-white/60">Subject:</span>{' '}
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
                      {item.status === 'draft' && (
                        <>
                          <button
                            onClick={() => startEditing(item)}
                            className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-platinum-white/80 hover:text-white"
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
                        className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-platinum-white/80"
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
                            <h4 className="text-sm font-medium text-platinum-white/80 mb-2 flex items-center gap-1">
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
                              <div className="bg-imperial-navy/60 rounded-lg p-4 text-sm whitespace-pre-wrap text-platinum-white max-h-64 overflow-y-auto">
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
                            <h4 className="text-sm font-medium text-platinum-white/80 mb-2 flex items-center gap-1">
                              <Star size={14} />
                              Lead Research Brief
                            </h4>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-imperial-navy/60 rounded-lg p-3">
                                  <div className="text-platinum-white/60 text-xs">Lead Score</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.lead_score || 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-imperial-navy/60 rounded-lg p-3">
                                  <div className="text-platinum-white/60 text-xs">AI Readiness</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.ai_readiness_score || 'N/A'}/10
                                  </div>
                                </div>
                                <div className="bg-imperial-navy/60 rounded-lg p-3">
                                  <div className="text-platinum-white/60 text-xs">Competitive Pressure</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.competitive_pressure_score || 'N/A'}/10
                                  </div>
                                </div>
                                <div className="bg-imperial-navy/60 rounded-lg p-3">
                                  <div className="text-platinum-white/60 text-xs">Source</div>
                                  <div className="text-sm font-medium">
                                    {item.contact_submissions?.lead_source || 'N/A'}
                                  </div>
                                </div>
                              </div>

                              {item.contact_submissions?.quick_wins && (
                                <div className="bg-imperial-navy/60 rounded-lg p-3">
                                  <div className="text-platinum-white/60 text-xs mb-1">Quick Wins</div>
                                  <div className="text-sm text-platinum-white whitespace-pre-wrap max-h-24 overflow-y-auto">
                                    {item.contact_submissions.quick_wins}
                                  </div>
                                </div>
                              )}

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
                            <div className="mt-4 text-xs text-platinum-white/60 space-y-1">
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
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {/* Temperature Filter */}
              <div className="flex items-center gap-2">
                {[
                  { key: 'all' as const, label: 'All Leads', icon: Users },
                  { key: 'warm' as const, label: 'Warm', icon: Flame },
                  { key: 'cold' as const, label: 'Cold', icon: Snowflake },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setLeadsTempFilter(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      leadsTempFilter === key
                        ? 'bg-silicon-slate border-blue-500 text-white'
                        : 'bg-silicon-slate/50 border-silicon-slate text-platinum-white/80 hover:bg-silicon-slate'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-platinum-white/60" />
                <input
                  type="text"
                  placeholder="Search by name, email, or company..."
                  value={leadsSearch}
                  onChange={(e) => setLeadsSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-platinum-white/60" />
                <select
                  value={leadsStatusFilter}
                  onChange={(e) => setLeadsStatusFilter(e.target.value)}
                  className="bg-silicon-slate/50 border border-silicon-slate rounded-lg px-3 py-2 text-white focus:outline-none focus:border-radiant-gold"
                >
                  <option value="all">All Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="replied">Replied</option>
                  <option value="booked">Booked</option>
                  <option value="opted_out">Opted Out</option>
                </select>
              </div>

              {/* Source Filter */}
              <select
                value={leadsSourceFilter}
                onChange={(e) => setLeadsSourceFilter(e.target.value)}
                className="bg-silicon-slate/50 border border-silicon-slate rounded-lg px-3 py-2 text-white focus:outline-none focus:border-radiant-gold"
              >
                <option value="all">All Sources</option>
                <option value="warm_facebook">Facebook</option>
                <option value="warm_google_contacts">Google Contacts</option>
                <option value="warm_linkedin">LinkedIn</option>
                <option value="cold_apollo">Apollo</option>
              </select>

              {/* Visibility: Active | Do not contact | Removed | All */}
              <select
                value={leadsVisibilityFilter}
                onChange={(e) => setLeadsVisibilityFilter(e.target.value as 'active' | 'do_not_contact' | 'removed' | 'all')}
                className="bg-silicon-slate/50 border border-silicon-slate rounded-lg px-3 py-2 text-white focus:outline-none focus:border-radiant-gold"
                title="Show leads by contact status"
              >
                <option value="active">Active only</option>
                <option value="do_not_contact">Do not contact</option>
                <option value="removed">Removed</option>
                <option value="all">All</option>
              </select>

              {/* Add lead (manual entry) */}
              <button
                type="button"
                onClick={() => {
                  setShowAddLeadModal(true)
                  setAddLeadError(null)
                  setAddLeadSuccessId(null)
                }}
                className="flex items-center gap-2 px-4 py-2 btn-gold text-imperial-navy rounded-lg transition-colors font-medium"
              >
                <Plus size={16} />
                Add lead
              </button>
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
                    className="w-full max-w-md bg-background border border-silicon-slate rounded-xl shadow-xl p-6"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Add lead</h3>
                      <button
                        type="button"
                        onClick={() => !addLeadLoading && setShowAddLeadModal(false)}
                        className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-platinum-white/80"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <form onSubmit={handleAddLeadSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Name *</label>
                        <input
                          type="text"
                          value={addLeadName}
                          onChange={(e) => setAddLeadName(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Email</label>
                        <input
                          type="email"
                          value={addLeadEmail}
                          onChange={(e) => setAddLeadEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="email@company.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Company</label>
                        <input
                          type="text"
                          value={addLeadCompany}
                          onChange={(e) => setAddLeadCompany(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Company name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Company website</label>
                        <input
                          type="text"
                          value={addLeadCompanyWebsite}
                          onChange={(e) => setAddLeadCompanyWebsite(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="company.com or https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">LinkedIn URL</label>
                        <input
                          type="url"
                          value={addLeadLinkedInUrl}
                          onChange={(e) => setAddLeadLinkedInUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Job title</label>
                        <input
                          type="text"
                          value={addLeadJobTitle}
                          onChange={(e) => setAddLeadJobTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="Job title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Industry</label>
                        <input
                          type="text"
                          value={addLeadIndustry}
                          onChange={(e) => setAddLeadIndustry(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="e.g. Technology, Healthcare"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={addLeadPhone}
                          onChange={(e) => setAddLeadPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">How did you get this lead?</label>
                        <select
                          value={addLeadInputType}
                          onChange={(e) => setAddLeadInputType(e.target.value)}
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
                        <label className="block text-sm font-medium text-platinum-white/80 mb-1">Message / notes</label>
                        <textarea
                          value={addLeadMessage}
                          onChange={(e) => setAddLeadMessage(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold resize-y"
                          placeholder="Optional notes"
                        />
                      </div>
                      <div className="border border-silicon-slate rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowVepSection((v) => !v)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-silicon-slate/50 hover:bg-silicon-slate text-left text-sm font-medium text-platinum-white/80"
                        >
                          Value Evidence (optional)
                          {showVepSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {showVepSection && (
                          <div className="p-3 space-y-3 border-t border-silicon-slate">
                            <div>
                              <label className="block text-sm font-medium text-platinum-white/80 mb-1">Company size</label>
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
                              <label className="block text-sm font-medium text-platinum-white/80 mb-1">Quick wins</label>
                              <textarea
                                value={addLeadQuickWins}
                                onChange={(e) => setAddLeadQuickWins(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold resize-y"
                                placeholder="Quick-win AI opportunities with 90-day ROI potential"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-platinum-white/80 mb-1">Known pain points</label>
                              <textarea
                                value={addLeadPainPoints}
                                onChange={(e) => setAddLeadPainPoints(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold resize-y"
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
                      <div className="flex gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={addLeadLoading || !addLeadName.trim()}
                          className="flex-1 px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                        >
                          {addLeadLoading ? 'Adding...' : 'Add lead'}
                        </button>
                        <button
                          type="button"
                          onClick={() => !addLeadLoading && setShowAddLeadModal(false)}
                          className="px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
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
                        className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-platinum-white/80"
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
                              <label className="block text-sm font-medium text-platinum-white/80 mb-1">Name *</label>
                              <input
                                type="text"
                                value={enrichModalForm[l.id]?.name ?? l.name ?? ''}
                                onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], name: e.target.value } }))}
                                required
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                placeholder="Full name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-platinum-white/80 mb-1">Email</label>
                              <input
                                type="email"
                                value={enrichModalForm[l.id]?.email ?? l.email ?? ''}
                                onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], email: e.target.value } }))}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                placeholder="email@company.com"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Company</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.company ?? l.company ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], company: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="Company name"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Company website</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.company_domain ?? l.company_domain ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], company_domain: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="company.com or https://..."
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">LinkedIn URL</label>
                                <input
                                  type="url"
                                  value={enrichModalForm[l.id]?.linkedin_url ?? l.linkedin_url ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], linkedin_url: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="https://linkedin.com/in/..."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Job title</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.job_title ?? l.job_title ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], job_title: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="Job title"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Industry</label>
                                <input
                                  type="text"
                                  value={enrichModalForm[l.id]?.industry ?? l.industry ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], industry: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="e.g. Technology, Healthcare"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Phone</label>
                                <input
                                  type="tel"
                                  value={enrichModalForm[l.id]?.phone_number ?? l.phone_number ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], phone_number: e.target.value } }))}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold"
                                  placeholder="+1 234 567 8900"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-platinum-white/80 mb-1">How did you get this lead?</label>
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
                              <label className="block text-sm font-medium text-platinum-white/80 mb-1">Message / notes</label>
                              <textarea
                                value={enrichModalForm[l.id]?.message ?? l.message ?? ''}
                                onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], message: e.target.value } }))}
                                rows={2}
                                className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold resize-y"
                                placeholder="Optional notes"
                              />
                            </div>
                          </div>
                          {/* Value Evidence section */}
                          <div className="pt-3 border-t border-silicon-slate space-y-3">
                            <h4 className="text-sm font-medium text-platinum-white/80">Value Evidence</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Pain points</label>
                                <textarea
                                  value={enrichModalForm[l.id]?.rep_pain_points ?? l.rep_pain_points ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], rep_pain_points: e.target.value } }))}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold resize-y"
                                  placeholder="Known pain points"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Quick wins</label>
                                <textarea
                                  value={enrichModalForm[l.id]?.quick_wins ?? l.quick_wins ?? ''}
                                  onChange={(e) => setEnrichModalForm((f) => ({ ...f, [l.id]: { ...f[l.id], quick_wins: e.target.value } }))}
                                  rows={2}
                                  className="w-full px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg text-white placeholder-platinum-white/60 focus:outline-none focus:border-radiant-gold resize-y"
                                  placeholder="Quick wins"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-platinum-white/80 mb-1">Company size</label>
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
                          <label htmlFor="unified-rerun-enrichment" className="text-sm text-platinum-white/80">
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
                    <div className="p-4 border-t border-silicon-slate flex flex-wrap justify-end gap-2">
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
                        disabled={pushLoading || unifiedModalSaveLoading || enrichModalLeads.some((l) => !(enrichModalForm[l.id]?.name ?? l.name)?.trim())}
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
                                quick_wins: (f?.quick_wins ?? l.quick_wins ?? '').trim() || undefined,
                                rep_pain_points: (f?.rep_pain_points ?? l.rep_pain_points ?? '').trim() || undefined,
                                re_run_enrichment: enrichModalLeads.length === 1 ? unifiedModalReRunEnrichment : false,
                              }
                              const res = await fetch(`/api/admin/outreach/leads/${l.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
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
                      <button
                        type="button"
                        disabled={pushLoading || unifiedModalSaveLoading}
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
                                quick_wins: form?.quick_wins ?? l.quick_wins,
                                industry: form?.industry ?? l.industry,
                                employee_count: form?.employee_count ?? l.employee_count,
                                company: form?.company ?? l.company,
                                company_domain: form?.company_domain ?? l.company_domain,
                              }
                              return { ...base, ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v != null && String(v).trim())) }
                            })
                            const res = await fetch('/api/admin/value-evidence/extract-leads', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                              body: JSON.stringify({ leads: leadsPayload }),
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(data.error || 'Request failed')
                            setShowEnrichModal(false)
                            // Start polling for extraction status
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
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Evidence drawer */}
            <AnimatePresence>
              {evidenceDrawerContactId != null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex justify-end bg-imperial-navy/60"
                  onClick={() => setEvidenceDrawerContactId(null)}
                >
                  <motion.div
                    initial={{ x: 400 }}
                    animate={{ x: 0 }}
                    exit={{ x: 400 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-background border-l border-silicon-slate shadow-xl flex flex-col max-h-full"
                  >
                    <div className="p-4 border-b border-silicon-slate flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Value Evidence</h3>
                      <button
                        type="button"
                        onClick={() => setEvidenceDrawerContactId(null)}
                        className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-platinum-white/80"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {evidenceDrawerLoading ? (
                        <div className="flex justify-center py-8">
                          <RefreshCw size={24} className="animate-spin text-platinum-white/60" />
                        </div>
                      ) : evidenceDrawerData ? (
                        <>
                          <div>
                            <h4 className="text-sm font-medium text-platinum-white/80 mb-2">Pain point evidence</h4>
                            {evidenceDrawerData.evidence.length === 0 ? (
                              <p className="text-sm text-platinum-white/60">No evidence yet.</p>
                            ) : (
                              <ul className="space-y-2">
                                {evidenceDrawerData.evidence.map((e) => (
                                  <EvidenceCard key={e.id} evidence={e} />
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-platinum-white/80 mb-2">Value reports</h4>
                            {evidenceDrawerData.reports.length === 0 ? (
                              <p className="text-sm text-platinum-white/60">No reports yet.</p>
                            ) : (
                              <ul className="space-y-2">
                                {evidenceDrawerData.reports.map((r) => (
                                  <li key={r.id}>
                                    <Link
                                      href={`/admin/value-evidence/reports/${r.id}`}
                                      className="block p-2 rounded-lg bg-silicon-slate/50 border border-silicon-slate text-sm hover:bg-silicon-slate hover:border-white/20 transition-colors"
                                      onClick={() => setEvidenceDrawerContactId(null)}
                                    >
                                      <span className="text-white">{r.title ?? 'Report'}</span>
                                      <span className="text-platinum-white/80 ml-2">
                                        {r.total_annual_value != null ? `$${r.total_annual_value}` : ''} · {new Date(r.created_at).toLocaleDateString()}
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {evidenceDrawerData.reports.length === 0 && evidenceDrawerContactId && (
                            <button
                              type="button"
                              onClick={async () => {
                                const session = await getCurrentSession()
                                if (!session || !evidenceDrawerContactId) return
                                const res = await fetch('/api/admin/value-evidence/reports/generate', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${session.access_token}`,
                                  },
                                  body: JSON.stringify({
                                    contact_submission_id: evidenceDrawerContactId,
                                  }),
                                })
                                if (res.ok) {
                                  const r = await fetch(
                                    `/api/admin/value-evidence/evidence?contact_id=${evidenceDrawerContactId}`,
                                    { headers: { Authorization: `Bearer ${session.access_token}` } }
                                  )
                                  const d = await r.json()
                                  if (r.ok) setEvidenceDrawerData(d)
                                }
                              }}
                              className="w-full px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 rounded-lg font-medium text-sm"
                            >
                              Generate report
                            </button>
                          )}
                          {evidenceDrawerContactId && (
                            <button
                              type="button"
                              onClick={async () => {
                                const session = await getCurrentSession()
                                if (!session) return
                                const extractRes = await fetch('/api/admin/value-evidence/extract-leads', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${session.access_token}`,
                                  },
                                  body: JSON.stringify({
                                    leads: [{ contact_submission_id: evidenceDrawerContactId }],
                                  }),
                                })
                                if (extractRes.ok) {
                                  startVepPolling()
                                  await fetchLeads()
                                }
                                const r = await fetch(
                                  `/api/admin/value-evidence/evidence?contact_id=${evidenceDrawerContactId}`,
                                  { headers: { Authorization: `Bearer ${session.access_token}` } }
                                )
                                const d = await r.json()
                                if (r.ok) setEvidenceDrawerData(d)
                              }}
                              className="w-full px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg font-medium text-sm flex items-center justify-center gap-1"
                            >
                              <RefreshCw size={14} />
                              Refresh evidence
                            </button>
                          )}
                          {evidenceDrawerContactId && evidenceDrawerData && evidenceDrawerData.evidence.length > 0 && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Clear all evidence for this lead? This cannot be undone.')) return
                                const session = await getCurrentSession()
                                if (!session) return
                                const res = await fetch(
                                  `/api/admin/value-evidence/evidence?contact_id=${evidenceDrawerContactId}`,
                                  { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }
                                )
                                if (res.ok) {
                                  setEvidenceDrawerData({ evidence: [], reports: evidenceDrawerData.reports, totalEvidenceCount: 0 })
                                  await fetchLeads()
                                }
                              }}
                              className="w-full px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-lg font-medium text-sm text-red-400 flex items-center justify-center gap-1"
                            >
                              <X size={14} />
                              Clear evidence
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-platinum-white/60">Could not load evidence.</p>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Leads List */}
            {leadsLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={24} className="animate-spin text-platinum-white/60" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-20">
                <Users size={48} className="mx-auto text-platinum-white/60 mb-4" />
                <h3 className="text-xl font-medium text-platinum-white/80">
                  No leads found
                </h3>
                <p className="text-platinum-white/60 mt-2">
                  Try adjusting your filters or trigger lead scraping from the dashboard
                </p>
              </div>
            ) : (
              <>
                {selectedLeadIds.size > 0 && (
                  <div className="sticky top-0 z-10 mb-4 p-3 bg-background/95 border border-silicon-slate rounded-xl flex items-center justify-between gap-4">
                    <span className="text-sm text-platinum-white">
                      {selectedLeadIds.size} lead(s) selected
                    </span>
                    <div className="flex items-center gap-2">
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
                        className="text-sm text-platinum-white/80 hover:text-white"
                      >
                        Clear selection
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <label className="flex items-center gap-2 text-sm text-platinum-white/80 cursor-pointer">
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
                        className="bg-silicon-slate/50 border border-silicon-slate rounded-xl overflow-hidden"
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
                                {lead.name}
                              </h3>
                              {lead.lead_score !== null && (
                                <span className={`px-2 py-0.5 rounded text-xs ${getScoreBadgeColor(lead.lead_score)}`}>
                                  Score: {lead.lead_score}
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-gray-800 text-platinum-white rounded text-xs">
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
                            <div className="flex items-center gap-3 mt-1 text-sm text-platinum-white/80">
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
                              <span className="flex items-center gap-1">
                                <MessageSquare size={12} />
                                {lead.messages_count} messages ({lead.messages_sent} sent)
                              </span>
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
                              {lead.last_vep_status === 'pending' && lead.evidence_count === 0 && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-700 flex items-center gap-1">
                                    <RefreshCw size={12} className="animate-spin" />
                                    Extracting...
                                  </span>
                              )}
                              {lead.last_vep_status === 'pending' &&
                                lead.evidence_count === 0 &&
                                lead.last_vep_triggered_at &&
                                Date.now() - new Date(lead.last_vep_triggered_at).getTime() > 10 * 60 * 1000 && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-700">
                                    Push may have failed
                                  </span>
                                )}
                              {lead.last_vep_status === 'failed' && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-700">
                                  Push failed
                                </span>
                              )}
                              {lead.evidence_count === 0 &&
                                lead.last_vep_status !== 'pending' &&
                                lead.last_vep_status !== 'failed' &&
                                (!lead.last_vep_triggered_at ||
                                  (lead.last_vep_status !== 'pending' && lead.last_vep_status !== 'success')) && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-platinum-white/80">
                                    No evidence
                                  </span>
                                )}
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
                                className="px-3 py-2 bg-silicon-slate/50 hover:bg-silicon-slate text-platinum-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                              >
                                <RefreshCw size={14} />
                                Refresh evidence
                              </button>
                            )}
                            {/* Show Push/Retry only when not pending, or pending and >10min (then Retry) */}
                            {lead.evidence_count === 0 &&
                              (lead.last_vep_status !== 'pending' ||
                                (lead.last_vep_triggered_at &&
                                  Date.now() - new Date(lead.last_vep_triggered_at).getTime() > 10 * 60 * 1000)) && (
                              <button
                                type="button"
                                onClick={() => openReviewEnrichModal([lead.id])}
                                disabled={pushLoading || !lead.has_extractable_text}
                                className="px-3 py-2 bg-purple-600/80 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                {lead.last_vep_status === 'failed' ||
                                (lead.last_vep_status === 'pending' &&
                                  lead.last_vep_triggered_at &&
                                  Date.now() - new Date(lead.last_vep_triggered_at).getTime() > 10 * 60 * 1000)
                                  ? 'Retry'
                                  : 'Push to Value Evidence'}
                              </button>
                            )}
                            {lead.last_vep_status === 'pending' && lead.evidence_count === 0 && (
                              <>
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
                                <span className="px-3 py-2 text-sm text-platinum-white/60">Extracting...</span>
                              </>
                            )}
                            <button
                              onClick={() => openReviewEnrichModal([lead.id])}
                              className="px-3 py-2 bg-silicon-slate/50 hover:bg-silicon-slate text-platinum-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                            >
                              <Edit3 size={14} />
                              Edit
                            </button>
                            {!lead.do_not_contact && !lead.removed_at && (
                              <button
                                type="button"
                                onClick={() => updateLeadDncOrRemoved(lead.id, { do_not_contact: true })}
                                disabled={leadActionId === lead.id}
                                className="px-3 py-2 bg-amber-900/30 hover:bg-amber-800/50 text-amber-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                title="Do not contact: will not be overwritten by future ingest"
                              >
                                <ShieldOff size={14} />
                                Do not contact
                              </button>
                            )}
                            {!lead.removed_at && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Remove "${lead.name}" from the lead list? You can restore from "Removed" view.`)) {
                                    updateLeadDncOrRemoved(lead.id, { removed_at: new Date().toISOString() })
                                  }
                                }}
                                disabled={leadActionId === lead.id}
                                className="px-3 py-2 bg-red-900/30 hover:bg-red-800/50 text-red-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                title="Remove from active list"
                              >
                                <Trash2 size={14} />
                                Remove
                              </button>
                            )}
                            {lead.removed_at && (
                              <button
                                type="button"
                                onClick={() => updateLeadDncOrRemoved(lead.id, { removed_at: null })}
                                disabled={leadActionId === lead.id}
                                className="px-3 py-2 bg-green-900/30 hover:bg-green-800/50 text-green-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                                title="Restore to active list"
                              >
                                <RotateCcw size={14} />
                                Restore
                              </button>
                            )}
                            <Link
                              href={`/admin/outreach?tab=queue&contact=${lead.id}`}
                              className="px-3 py-2 bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                            >
                              <MessageSquare size={14} />
                              View Messages
                            </Link>
                            <button
                              onClick={() =>
                                setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)
                              }
                              className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate transition-colors text-platinum-white/80"
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
                              className="border-t border-silicon-slate"
                            >
                              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Contact Info */}
                                <div>
                                  <h4 className="text-sm font-medium text-platinum-white/80 mb-3">Contact Information</h4>
                                  <div className="space-y-2 text-sm">
                                    {lead.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail size={14} className="text-platinum-white/60" />
                                        <a href={`mailto:${lead.email}`} className="text-blue-400 hover:text-blue-300">
                                          {lead.email}
                                        </a>
                                      </div>
                                    )}
                                    {lead.linkedin_url && (
                                      <div className="flex items-center gap-2">
                                        <Linkedin size={14} className="text-platinum-white/60" />
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
                                        <Building2 size={14} className="text-platinum-white/60" />
                                        <span className="text-platinum-white">{lead.company}</span>
                                      </div>
                                    )}
                                    {lead.job_title && (
                                      <div className="flex items-center gap-2">
                                        <User size={14} className="text-platinum-white/60" />
                                        <span className="text-platinum-white">{lead.job_title}</span>
                                      </div>
                                    )}
                                    {lead.phone_number && (
                                      <div className="flex items-center gap-2">
                                        <Phone size={14} className="text-platinum-white/60" />
                                        <a href={`tel:${lead.phone_number}`} className="text-platinum-white hover:text-white">
                                          {lead.phone_number}
                                        </a>
                                      </div>
                                    )}
                                    {lead.industry && (
                                      <div className="flex items-center gap-2">
                                        <Briefcase size={14} className="text-platinum-white/60" />
                                        <span className="text-platinum-white">{lead.industry}</span>
                                      </div>
                                    )}
                                    {lead.company_domain && (
                                      <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-platinum-white/60" />
                                        <a
                                          href={lead.company_domain.startsWith('http') ? lead.company_domain : `https://${lead.company_domain}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                          {lead.company_domain}
                                          <ExternalLink size={12} />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Scores & Status */}
                                <div>
                                  <h4 className="text-sm font-medium text-platinum-white/80 mb-3">Lead Intelligence</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    {lead.lead_score !== null && (
                                      <div className="bg-imperial-navy/60 rounded-lg p-3">
                                        <div className="text-platinum-white/60 text-xs">Lead Score</div>
                                        <div className="text-lg font-bold">{lead.lead_score}</div>
                                      </div>
                                    )}
                                    {lead.ai_readiness_score !== null && (
                                      <div className="bg-imperial-navy/60 rounded-lg p-3">
                                        <div className="text-platinum-white/60 text-xs">AI Readiness</div>
                                        <div className="text-lg font-bold">{lead.ai_readiness_score}/10</div>
                                      </div>
                                    )}
                                    {lead.competitive_pressure_score !== null && (
                                      <div className="bg-imperial-navy/60 rounded-lg p-3">
                                        <div className="text-platinum-white/60 text-xs">Competitive Pressure</div>
                                        <div className="text-lg font-bold">{lead.competitive_pressure_score}/10</div>
                                      </div>
                                    )}
                                    <div className="bg-imperial-navy/60 rounded-lg p-3">
                                      <div className="text-platinum-white/60 text-xs">Status</div>
                                      <div className="text-sm font-medium capitalize">{lead.outreach_status.replace('_', ' ')}</div>
                                    </div>
                                  </div>

                                  {lead.quick_wins && (
                                    <div className="mt-3 bg-imperial-navy/60 rounded-lg p-3">
                                      <div className="text-platinum-white/60 text-xs mb-1">Quick Wins</div>
                                      <div className="text-sm text-platinum-white whitespace-pre-wrap max-h-24 overflow-y-auto">
                                        {lead.quick_wins}
                                      </div>
                                    </div>
                                  )}

                                  {lead.has_sales_conversation ? (
                                    <div className="mt-3">
                                      <Link
                                        href={lead.latest_session_id ? `/admin/sales/conversation/${lead.latest_session_id}` : '/admin/sales'}
                                        className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300"
                                      >
                                        <CheckCircle size={14} />
                                        View Sales Conversation
                                        {lead.session_count > 1 && <span className="text-xs text-platinum-white/60">({lead.session_count} sessions)</span>}
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
                                              router.push(`/admin/sales/conversation/${data.data.id}`)
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
                    <div className="text-sm text-platinum-white/80">
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
                      <span className="text-sm text-platinum-white/80">
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
      </div>
    </div>
  )
}
