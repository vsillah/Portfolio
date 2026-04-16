'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getBackUrl, buildLinkWithReturn } from '@/lib/admin-return-context'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import Pagination from '@/components/admin/Pagination'
import { getCurrentSession } from '@/lib/auth'
import { EMAIL_TEMPLATE_KEYS, PROMPT_DISPLAY_NAMES, type EmailTemplateKey } from '@/lib/constants/prompt-keys'
import {
  User, Mail, Building2, Calendar, ExternalLink, FileText,
  Video, BarChart3, Send, Loader2, CheckCircle, AlertCircle, Clock,
  ChevronDown, ChevronUp, Sparkles, Plus, Eye, MessageSquare,
  RefreshCw, Copy, Check, Linkedin, Filter, Search, Trash2, X,
} from 'lucide-react'

/* ───────── Types ───────── */

interface Contact {
  id: number
  name: string
  email: string
  company: string | null
  industry: string | null
  lead_source: string | null
  lead_score: number | null
  outreach_status: string | null
  created_at: string
  employee_count: string | null
}

interface GammaReport { id: string; report_type: string; title: string | null; gamma_url: string | null; status: string; created_at: string }
interface VideoJob { id: string; script_source: string; heygen_status: string | null; video_url: string | null; thumbnail_url: string | null; channel: string; gamma_report_id: string | null; created_at: string }
interface ValueReport { id: string; title: string | null; report_type: string; created_at: string }
interface Audit { id: number; status: string; created_at: string }
interface OutreachItem { id: string; channel: string; subject: string | null; status: string; created_at: string }
interface Delivery { id: string; subject: string; recipient_email: string; asset_ids: unknown; dashboard_token: string | null; sent_at: string; status: string }
interface DashboardAccess { access_token: string; client_email: string }
interface SalesSession { id: string; created_at: string }
interface TimelineEvent { type: string; date: string; title: string; detail?: string; id?: string }

interface Communication {
  id: string
  channel: string
  direction: string
  message_type: string
  subject: string | null
  body: string
  source_system: string
  source_id: string | null
  prompt_key: string | null
  status: string
  sent_at: string | null
  sent_by: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface ContactData {
  contact: Contact
  gammaReports: GammaReport[]
  videos: VideoJob[]
  valueReports: ValueReport[]
  audits: Audit[]
  outreach: OutreachItem[]
  deliveries: Delivery[]
  communications: Communication[]
  dashboardAccess: DashboardAccess | null
  salesSessions: SalesSession[]
  timeline: TimelineEvent[]
  suggestedTemplate: EmailTemplateKey
}

interface AssetRef { type: 'gamma_report' | 'video' | 'value_report'; id: string }

type AssetTypeFilter = 'all' | 'gamma_report' | 'video' | 'value_report'
type AssetSortKey = 'date_desc' | 'date_asc' | 'type' | 'status' | 'title_asc' | 'title_desc'

interface UnifiedAsset {
  id: string
  assetType: 'gamma_report' | 'video' | 'value_report'
  title: string
  subtitle: string
  status: string
  created_at: string
  url: string | null
  urlLabel: string
}

function buildUnifiedAssets(
  gammaReports: GammaReport[],
  videos: VideoJob[],
  valueReports: ValueReport[],
): UnifiedAsset[] {
  const assets: UnifiedAsset[] = []
  for (const g of gammaReports) {
    assets.push({
      id: g.id,
      assetType: 'gamma_report',
      title: g.title || g.report_type,
      subtitle: g.report_type,
      status: g.status,
      created_at: g.created_at,
      url: g.gamma_url,
      urlLabel: 'View deck',
    })
  }
  for (const v of videos) {
    assets.push({
      id: v.id,
      assetType: 'video',
      title: `Video (${v.channel})`,
      subtitle: v.script_source,
      status: v.heygen_status || 'unknown',
      created_at: v.created_at,
      url: v.video_url,
      urlLabel: 'Watch',
    })
  }
  for (const vr of valueReports) {
    assets.push({
      id: vr.id,
      assetType: 'value_report',
      title: vr.title || vr.report_type,
      subtitle: vr.report_type,
      status: 'completed',
      created_at: vr.created_at,
      url: `/admin/value-evidence/reports/${vr.id}`,
      urlLabel: 'View report',
    })
  }
  return assets
}

const ASSET_TYPE_LABELS: Record<AssetTypeFilter, string> = {
  all: 'All Types',
  gamma_report: 'Decks',
  video: 'Videos',
  value_report: 'Value Reports',
}

const ASSET_TYPE_ICON_MAP: Record<string, typeof FileText> = {
  gamma_report: FileText,
  video: Video,
  value_report: BarChart3,
}

const ASSET_TYPE_COLORS: Record<string, string> = {
  gamma_report: 'text-emerald-400',
  video: 'text-amber-400',
  value_report: 'text-purple-400',
}

const ASSET_TYPE_TABLE_LABEL: Record<UnifiedAsset['assetType'], string> = {
  gamma_report: 'Deck',
  video: 'Video',
  value_report: 'Value report',
}

/* ───────── Helpers ───────── */

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
    generating: 'bg-amber-900/50 text-amber-400 border-amber-800',
    pending: 'bg-blue-900/50 text-blue-400 border-blue-800',
    failed: 'bg-red-900/50 text-red-400 border-red-800',
    sent: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
    approved: 'bg-teal-900/50 text-teal-400 border-teal-800',
    draft: 'bg-gray-800/50 text-gray-400 border-gray-700',
  }
  const cls = colors[status] || 'bg-gray-800/50 text-gray-400 border-gray-700'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const timelineIcons: Record<string, typeof User> = {
  contact: User, audit: BarChart3, gamma: FileText, video: Video,
  value_report: BarChart3, outreach: MessageSquare, delivery: Send, sales: Sparkles,
}

const TIMELINE_PAGE_SIZE = 10

/* ───────── Page ───────── */

function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const backUrl = getBackUrl(searchParams, '/admin/outreach')
  const [data, setData] = useState<ContactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateKey>('email_asset_delivery')
  const [selectedAssets, setSelectedAssets] = useState<AssetRef[]>([])
  const [customNote, setCustomNote] = useState('')
  const [includeDashboard, setIncludeDashboard] = useState(true)
  const [drafting, setDrafting] = useState(false)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Asset management
  const [assetSearch, setAssetSearch] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetTypeFilter>('all')
  const [assetSort, setAssetSort] = useState<AssetSortKey>('date_desc')
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)

  // Sections
  const [showDeliveries, setShowDeliveries] = useState(false)
  const [showTimeline, setShowTimeline] = useState(true)
  const [timelinePage, setTimelinePage] = useState(1)
  const [showComms, setShowComms] = useState(true)
  const [commsChannelFilter, setCommsChannelFilter] = useState<string>('all')
  const [commsTypeFilter, setCommsTypeFilter] = useState<string>('all')
  const [expandedCommId, setExpandedCommId] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const s = await getCurrentSession()
    return s?.access_token || ''
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/contacts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to load contact')
        return
      }
      const d: ContactData = await res.json()
      setData(d)

      // Pre-select completed assets
      const preselected: AssetRef[] = []
      for (const g of d.gammaReports) {
        if (g.status === 'completed' && g.gamma_url) preselected.push({ type: 'gamma_report', id: g.id })
      }
      for (const v of d.videos) {
        if (v.heygen_status === 'completed' && v.video_url) preselected.push({ type: 'video', id: v.id })
      }
      for (const vr of d.valueReports) {
        preselected.push({ type: 'value_report', id: vr.id })
      }
      setSelectedAssets(preselected)
      if (d.suggestedTemplate) setSelectedTemplate(d.suggestedTemplate)
    } catch {
      setError('Failed to load contact data')
    } finally {
      setLoading(false)
    }
  }, [id, getToken])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    setTimelinePage(1)
  }, [id])

  useEffect(() => {
    const len = data?.timeline?.length
    if (len == null) return
    const maxPage = Math.max(1, Math.ceil(len / TIMELINE_PAGE_SIZE))
    setTimelinePage(p => Math.min(p, maxPage))
  }, [data?.timeline?.length])

  function toggleAsset(ref: AssetRef) {
    setSelectedAssets(prev => {
      const exists = prev.find(a => a.type === ref.type && a.id === ref.id)
      if (exists) return prev.filter(a => !(a.type === ref.type && a.id === ref.id))
      return [...prev, ref]
    })
  }

  function isSelected(type: string, assetId: string) {
    return selectedAssets.some(a => a.type === type && a.id === assetId)
  }

  async function handleGenerateDraft() {
    setDrafting(true)
    setSendResult(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/contacts/${id}/compose-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assetIds: selectedAssets, templateKey: selectedTemplate, customNote, includeDashboardLink: includeDashboard }),
      })
      const d = await res.json()
      if (!res.ok) { setSendResult({ success: false, error: d.error || 'Draft generation failed' }); return }
      setDraftSubject(d.subject || '')
      setDraftBody(d.body || '')
    } catch {
      setSendResult({ success: false, error: 'Failed to generate draft' })
    } finally {
      setDrafting(false)
    }
  }

  async function handleSend() {
    if (!data || !draftSubject || !draftBody) return
    setSending(true)
    setSendResult(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/contacts/${id}/send-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: draftSubject,
          body: draftBody,
          recipientEmail: data.contact.email,
          assetIds: selectedAssets,
          includeDashboardLink: includeDashboard,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setSendResult({ success: false, error: d.error || 'Send failed' }); return }
      setSendResult({ success: true })
      setComposeOpen(false)
      setDraftSubject('')
      setDraftBody('')
      fetchData()
    } catch {
      setSendResult({ success: false, error: 'Unexpected error sending email' })
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteAsset(assetType: string, assetId: string) {
    if (!confirm('Are you sure you want to delete this asset? This cannot be undone.')) return
    setDeletingAssetId(assetId)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin/contacts/${id}/assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assetType, assetId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Failed to delete asset')
        return
      }
      fetchData()
    } catch {
      alert('Failed to delete asset. Please try again.')
    } finally {
      setDeletingAssetId(null)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !data) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen bg-gray-950 p-8">
          <div className="max-w-4xl mx-auto bg-red-900/20 border border-red-800 rounded-lg p-6">
            <p className="text-red-400">{error || 'Contact not found'}</p>
            <Link href={backUrl} className="text-sm text-teal-400 hover:underline mt-2 inline-block">Back</Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const { contact, gammaReports, videos, valueReports, audits, deliveries, dashboardAccess, salesSessions, timeline } = data
  const hasAnyAsset = gammaReports.length > 0 || videos.length > 0 || valueReports.length > 0

  const timelineTotalPages = Math.max(1, Math.ceil(timeline.length / TIMELINE_PAGE_SIZE))
  const safeTimelinePage = Math.min(timelinePage, timelineTotalPages)
  const pagedTimeline = timeline.slice(
    (safeTimelinePage - 1) * TIMELINE_PAGE_SIZE,
    safeTimelinePage * TIMELINE_PAGE_SIZE,
  )

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-950 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">

          <Breadcrumbs items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Outreach', href: '/admin/outreach' },
            { label: contact.name },
          ]} />

          {/* ── Header ── */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <User className="w-6 h-6 text-teal-400" />
                  {contact.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-400">
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{contact.email}</span>
                  {contact.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{contact.company}</span>}
                  {contact.industry && <span className="text-gray-500">({contact.industry})</span>}
                  
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {contact.lead_source && <StatusBadge status={contact.lead_source} />}
                  {contact.outreach_status && <StatusBadge status={contact.outreach_status} />}
                  {contact.lead_score != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-400 border border-purple-800">Score: {contact.lead_score}</span>}
                  <span className="text-[10px] text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />Since {formatDate(contact.created_at)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {dashboardAccess && (
                  <a href={`/client/dashboard/${dashboardAccess.access_token}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-teal-400 rounded-lg flex items-center gap-1.5 transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Client Dashboard
                  </a>
                )}
                <button onClick={fetchData} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg flex items-center gap-1.5 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>
          </div>

          {/* ── Assets ── */}
          {(() => {
            const allAssets = buildUnifiedAssets(gammaReports, videos, valueReports)

            const filtered = allAssets
              .filter(a => {
                if (assetTypeFilter !== 'all' && a.assetType !== assetTypeFilter) return false
                if (assetSearch) {
                  const q = assetSearch.toLowerCase()
                  return (
                    a.title.toLowerCase().includes(q) ||
                    a.subtitle.toLowerCase().includes(q) ||
                    a.status.toLowerCase().includes(q)
                  )
                }
                return true
              })
              .sort((a, b) => {
                switch (assetSort) {
                  case 'date_asc':
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  case 'type':
                    return a.assetType.localeCompare(b.assetType)
                  case 'status':
                    return a.status.localeCompare(b.status)
                  case 'title_asc':
                    return a.title.localeCompare(b.title)
                  case 'title_desc':
                    return b.title.localeCompare(a.title)
                  default:
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                }
              })

            return (
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                {/* Section header */}
                <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-base font-semibold text-white">Assets</h2>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                      {filtered.length}{allAssets.length !== filtered.length ? ` / ${allAssets.length}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={buildLinkWithReturn(`/admin/reports/gamma?contactId=${contact.id}`, `/admin/contacts/${contact.id}`)} className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded-lg flex items-center gap-1.5 transition-colors">
                      <Plus className="w-3 h-3" /> Deck
                    </Link>
                    <Link href={buildLinkWithReturn(`/admin/value-evidence?contactId=${contact.id}`, `/admin/contacts/${contact.id}`)} className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-purple-400 rounded-lg flex items-center gap-1.5 transition-colors">
                      <Plus className="w-3 h-3" /> Value Report
                    </Link>
                    {salesSessions.length === 0 && (
                      <Link href={`/admin/sales?newSession=true&contactId=${contact.id}`} className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-400 rounded-lg flex items-center gap-1.5 transition-colors">
                        <Plus className="w-3 h-3" /> Sales Conversation
                      </Link>
                    )}
                  </div>
                </div>

                {/* Toolbar: search, type filter, sort */}
                {allAssets.length > 0 && (
                  <div className="px-6 pb-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 border-t border-gray-800 pt-3">
                    <div className="relative flex-1 w-full sm:max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search assets..."
                        value={assetSearch}
                        onChange={e => setAssetSearch(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                      />
                      {assetSearch && (
                        <button onClick={() => setAssetSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={assetTypeFilter}
                        onChange={e => setAssetTypeFilter(e.target.value as AssetTypeFilter)}
                        className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                      >
                        {(Object.keys(ASSET_TYPE_LABELS) as AssetTypeFilter[]).map(k => (
                          <option key={k} value={k}>{ASSET_TYPE_LABELS[k]}</option>
                        ))}
                      </select>
                      <select
                        value={assetSort}
                        onChange={e => setAssetSort(e.target.value as AssetSortKey)}
                        className="text-xs bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                      >
                        <option value="date_desc">Newest first</option>
                        <option value="date_asc">Oldest first</option>
                        <option value="type">By type</option>
                        <option value="status">By status</option>
                        <option value="title_asc">Title A–Z</option>
                        <option value="title_desc">Title Z–A</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Scrollable asset table */}
                <div className="px-6 pb-4 max-h-[min(70vh,560px)] overflow-hidden flex flex-col">
                  {filtered.length === 0 && allAssets.length > 0 && (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-500">No assets match your filters.</p>
                      <button type="button" onClick={() => { setAssetSearch(''); setAssetTypeFilter('all') }} className="text-xs text-teal-400 hover:underline mt-1">
                        Clear filters
                      </button>
                    </div>
                  )}
                  {allAssets.length === 0 && (
                    <div className="bg-gray-900/30 border border-dashed border-gray-700 rounded-lg p-8 text-center">
                      <p className="text-gray-500 text-sm">No assets generated yet for this contact.</p>
                    </div>
                  )}
                  {filtered.length > 0 && (
                    <div className="overflow-x-auto overflow-y-auto rounded-lg border border-gray-800 flex-1 min-h-0">
                      <table className="w-full text-left text-xs min-w-[640px]">
                        <thead className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 shadow-[0_1px_0_0_rgb(31_41_55)]">
                          <tr className="text-gray-500">
                            <th className="px-3 py-2.5 w-10 text-center font-medium">Use</th>
                            <th className="px-3 py-2.5 font-medium">
                              <button
                                type="button"
                                onClick={() => setAssetSort('type')}
                                className="inline-flex items-center gap-1 hover:text-teal-400 transition-colors"
                              >
                                Type
                                {assetSort === 'type' ? <ChevronDown className="w-3 h-3 text-teal-500" /> : null}
                              </button>
                            </th>
                            <th className="px-3 py-2.5 font-medium min-w-[140px]">
                              <button
                                type="button"
                                onClick={() =>
                                  setAssetSort(s => (s === 'title_asc' ? 'title_desc' : 'title_asc'))}
                                className="inline-flex items-center gap-1 hover:text-teal-400 transition-colors"
                              >
                                Title
                                {assetSort === 'title_asc' ? <ChevronUp className="w-3 h-3 text-teal-500" /> : null}
                                {assetSort === 'title_desc' ? <ChevronDown className="w-3 h-3 text-teal-500" /> : null}
                              </button>
                            </th>
                            <th className="px-3 py-2.5 font-medium">
                              <button
                                type="button"
                                onClick={() => setAssetSort('status')}
                                className="inline-flex items-center gap-1 hover:text-teal-400 transition-colors"
                              >
                                Status
                                {assetSort === 'status' ? <ChevronDown className="w-3 h-3 text-teal-500" /> : null}
                              </button>
                            </th>
                            <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setAssetSort(s => {
                                    if (s === 'date_desc') return 'date_asc'
                                    if (s === 'date_asc') return 'date_desc'
                                    return 'date_desc'
                                  })}
                                className="inline-flex items-center gap-1 hover:text-teal-400 transition-colors"
                              >
                                Created
                                {assetSort === 'date_desc' ? <ChevronDown className="w-3 h-3 text-teal-500" /> : null}
                                {assetSort === 'date_asc' ? <ChevronUp className="w-3 h-3 text-teal-500" /> : null}
                              </button>
                            </th>
                            <th className="px-3 py-2.5 font-medium">Subtype</th>
                            <th className="px-3 py-2.5 font-medium text-right">Open</th>
                            <th className="px-3 py-2.5 font-medium text-right w-14"> </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/90">
                          {filtered.map(asset => {
                            const Icon = ASSET_TYPE_ICON_MAP[asset.assetType]
                            const iconColor = ASSET_TYPE_COLORS[asset.assetType]
                            const selected = isSelected(asset.assetType, asset.id)
                            const isDeleting = deletingAssetId === asset.id
                            return (
                              <tr
                                key={`${asset.assetType}-${asset.id}`}
                                onClick={() => toggleAsset({ type: asset.assetType, id: asset.id })}
                                className={`cursor-pointer transition-colors ${selected ? 'bg-teal-950/25 hover:bg-teal-950/35' : 'hover:bg-gray-900/80'}`}
                              >
                                <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleAsset({ type: asset.assetType, id: asset.id })}
                                    className="rounded border-gray-600 bg-gray-900 text-teal-500 focus:ring-teal-500/40"
                                    aria-label="Include in delivery"
                                  />
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 text-gray-300">
                                    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                                    {ASSET_TYPE_TABLE_LABEL[asset.assetType]}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-white font-medium max-w-[220px]">
                                  <span className="line-clamp-2" title={asset.title}>{asset.title}</span>
                                </td>
                                <td className="px-3 py-2.5"><StatusBadge status={asset.status} /></td>
                                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(asset.created_at)}</td>
                                <td className="px-3 py-2.5 text-gray-500 max-w-[120px]">
                                  <span className="line-clamp-2" title={asset.subtitle}>{asset.subtitle}</span>
                                </td>
                                <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                                  {asset.url ? (
                                    asset.url.startsWith('http') ? (
                                      <a
                                        href={asset.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {asset.urlLabel}
                                      </a>
                                    ) : (
                                      <Link
                                        href={asset.url}
                                        className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300"
                                      >
                                        <Eye className="w-3 h-3" />
                                        {asset.urlLabel}
                                      </Link>
                                    )
                                  ) : (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAsset(asset.assetType, asset.id)}
                                    disabled={isDeleting}
                                    className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-900/25 transition-colors disabled:opacity-50"
                                    title="Delete asset"
                                  >
                                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* ── Compose Delivery Email ── */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            <button onClick={() => setComposeOpen(!composeOpen)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-teal-400" />
                <span className="text-base font-semibold text-white">Compose Delivery Email</span>
                {selectedAssets.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/50 text-teal-400 border border-teal-800">{selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''} selected</span>}
              </div>
              {composeOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>

            {composeOpen && (
              <div className="px-6 pb-6 space-y-4 border-t border-gray-800 pt-4">
                {/* Template selector */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email template</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedTemplate}
                      onChange={e => setSelectedTemplate(e.target.value as EmailTemplateKey)}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                    >
                      {EMAIL_TEMPLATE_KEYS.map(k => (
                        <option key={k} value={k}>
                          {PROMPT_DISPLAY_NAMES[k] || k}
                          {k === data?.suggestedTemplate ? ' (suggested)' : ''}
                        </option>
                      ))}
                    </select>
                    <Link href={`/admin/prompts/${selectedTemplate}`} target="_blank" className="text-[10px] text-gray-500 hover:text-teal-400 transition-colors whitespace-nowrap">
                      Edit template &rarr;
                    </Link>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input type="checkbox" checked={includeDashboard} onChange={e => setIncludeDashboard(e.target.checked)} className="rounded bg-gray-800 border-gray-600 text-teal-500 focus:ring-teal-500" />
                    Include dashboard link
                  </label>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Custom note (optional)</label>
                  <textarea
                    value={customNote}
                    onChange={e => setCustomNote(e.target.value)}
                    rows={2}
                    placeholder="Any additional context for the AI draft..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 resize-none"
                  />
                </div>

                <button onClick={handleGenerateDraft} disabled={drafting} className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all">
                  {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {drafting ? 'Generating draft...' : 'Generate Draft'}
                </button>

                {(draftSubject || draftBody) && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Subject</label>
                      <input
                        type="text"
                        value={draftSubject}
                        onChange={e => setDraftSubject(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Body</label>
                      <textarea
                        value={draftBody}
                        onChange={e => setDraftBody(e.target.value)}
                        rows={10}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 resize-y font-mono text-xs leading-relaxed"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={handleSend} disabled={sending || !draftSubject || !draftBody} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sending ? 'Sending...' : `Send to ${contact.email}`}
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(`Subject: ${draftSubject}\n\n${draftBody}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg flex items-center gap-1.5 text-xs transition-colors">
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                {sendResult && (
                  <div className={`rounded-lg p-3 flex items-center gap-2 text-sm ${sendResult.success ? 'bg-emerald-900/20 border border-emerald-800 text-emerald-400' : 'bg-red-900/20 border border-red-800 text-red-400'}`}>
                    {sendResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {sendResult.success ? 'Email sent successfully!' : sendResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Delivery History ── */}
          {deliveries.length > 0 && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
              <button onClick={() => setShowDeliveries(!showDeliveries)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span className="text-base font-semibold text-white">Delivery History</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{deliveries.length}</span>
                </div>
                {showDeliveries ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {showDeliveries && (
                <div className="px-6 pb-4 space-y-2 border-t border-gray-800 pt-3">
                  {deliveries.map(d => (
                    <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <div>
                        <p className="text-sm text-white">{d.subject}</p>
                        <p className="text-[10px] text-gray-500">To: {d.recipient_email} &middot; {formatDateTime(d.sent_at)}</p>
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Communications (unified timeline) ── */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            <button onClick={() => setShowComms(!showComms)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <span className="text-base font-semibold text-white">Communications</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{data?.communications?.length ?? 0}</span>
              </div>
              {showComms ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {showComms && (
              <div className="px-6 pb-4 border-t border-gray-800 pt-3">
                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3 h-3 text-gray-500" />
                    <select
                      value={commsChannelFilter}
                      onChange={e => setCommsChannelFilter(e.target.value)}
                      className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                    >
                      <option value="all">All Channels</option>
                      <option value="email">Email</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>
                  <select
                    value={commsTypeFilter}
                    onChange={e => setCommsTypeFilter(e.target.value)}
                    className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                  >
                    <option value="all">All Types</option>
                    <option value="cold_outreach">Cold Outreach</option>
                    <option value="asset_delivery">Asset Delivery</option>
                    <option value="proposal">Proposal</option>
                    <option value="follow_up">Follow-Up</option>
                    <option value="nurture">Nurture</option>
                    <option value="reply">Reply</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>

                {/* Message list */}
                {(() => {
                  const comms = (data?.communications ?? []).filter(c => {
                    if (commsChannelFilter !== 'all' && c.channel !== commsChannelFilter) return false
                    if (commsTypeFilter !== 'all' && c.message_type !== commsTypeFilter) return false
                    return true
                  })
                  if (comms.length === 0) {
                    return <p className="text-sm text-gray-500 py-2">No communications recorded yet.</p>
                  }
                  return (
                    <div className="space-y-0">
                      {comms.map(c => {
                        const isExpanded = expandedCommId === c.id
                        const ChannelIcon = c.channel === 'linkedin' ? Linkedin : Mail
                        const channelColor = c.channel === 'linkedin' ? 'text-blue-400' : 'text-gray-400'
                        const typeColors: Record<string, string> = {
                          cold_outreach: 'bg-blue-900/40 text-blue-300 border-blue-800',
                          asset_delivery: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
                          proposal: 'bg-amber-900/40 text-amber-300 border-amber-800',
                          follow_up: 'bg-purple-900/40 text-purple-300 border-purple-800',
                          nurture: 'bg-cyan-900/40 text-cyan-300 border-cyan-800',
                          reply: 'bg-green-900/40 text-green-300 border-green-800',
                          manual: 'bg-gray-800/50 text-gray-300 border-gray-700',
                        }
                        const typeLabels: Record<string, string> = {
                          cold_outreach: 'Cold Outreach',
                          asset_delivery: 'Asset Delivery',
                          proposal: 'Proposal',
                          follow_up: 'Follow-Up',
                          nurture: 'Nurture',
                          reply: 'Reply',
                          manual: 'Manual',
                        }
                        const sourceLabels: Record<string, string> = {
                          outreach_queue: 'Outreach Queue',
                          delivery_email: 'Delivery Email',
                          proposal: 'Proposal',
                          nurture: 'Nurture',
                          heygen: 'HeyGen',
                          manual: 'Manual',
                        }
                        return (
                          <div key={c.id} className="border-b border-gray-800/30 last:border-0">
                            <button
                              onClick={() => setExpandedCommId(isExpanded ? null : c.id)}
                              className="w-full flex items-start gap-3 py-3 text-left hover:bg-gray-800/20 transition-colors rounded px-1"
                            >
                              <div className="mt-0.5 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                                <ChannelIcon className={`w-3 h-3 ${channelColor}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColors[c.message_type] || typeColors.manual}`}>
                                    {typeLabels[c.message_type] || c.message_type}
                                  </span>
                                  <StatusBadge status={c.status} />
                                  <span className="text-[10px] text-gray-600">{c.direction}</span>
                                </div>
                                <p className="text-sm text-white mt-1 truncate">{c.subject || '(no subject)'}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-gray-500">{formatDateTime(c.sent_at || c.created_at)}</span>
                                  <span className="text-[10px] text-gray-600">via {sourceLabels[c.source_system] || c.source_system}</span>
                                  {c.prompt_key && (
                                    <span className="text-[10px] text-purple-400">prompt: {c.prompt_key}</span>
                                  )}
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-500 mt-1" />}
                            </button>
                            {isExpanded && (
                              <div className="ml-9 mb-3 bg-gray-900/80 rounded-lg p-3 border border-gray-800">
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
                                  {c.body}
                                </pre>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* ── Timeline ── */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            <button onClick={() => setShowTimeline(!showTimeline)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="text-base font-semibold text-white">Activity Timeline</span>
                {timeline.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                    {timeline.length}
                  </span>
                )}
              </div>
              {showTimeline ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {showTimeline && (
              <div className="px-6 pb-4 border-t border-gray-800 pt-3 space-y-2">
                {timeline.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No activity yet.</p>
                ) : (
                  <>
                    <div className="max-h-[min(50vh,420px)] overflow-y-auto rounded-lg border border-gray-800/80 bg-gray-950/40">
                      <div className="space-y-0 px-1">
                        {pagedTimeline.map((event, i) => {
                          const Icon = timelineIcons[event.type] || Clock
                          return (
                            <div key={`${event.type}-${event.id ?? `${safeTimelinePage}-${i}`}`} className="flex items-start gap-3 py-2.5 border-b border-gray-800/30 last:border-0 px-2">
                              <div className="mt-0.5 w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-3 h-3 text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white">{event.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-gray-500">{formatDateTime(event.date)}</span>
                                  {event.detail && <StatusBadge status={event.detail} />}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <Pagination
                      page={safeTimelinePage}
                      totalPages={timelineTotalPages}
                      total={timeline.length}
                      pageSize={TIMELINE_PAGE_SIZE}
                      onPageChange={setTimelinePage}
                    />
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </ProtectedRoute>
  )
}

export default ContactDetailPage
