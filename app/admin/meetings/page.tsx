'use client'

import { Fragment, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Video,
  Loader2,
  RefreshCw,
  Calendar,
  User,
  Folder,
  FileText,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Plus,
  Pencil,
  Unlink,
  ExternalLink,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { adminCreateUrl } from '@/lib/admin-create-context'
import { buildAdminReturnPath } from '@/lib/admin-return-context'
import { ViewDiagnosticLink } from '@/components/admin/ViewDiagnosticLink'

const CREATE_LEAD_SENTINEL = '__create_lead__'
const CREATE_PROJECT_SENTINEL = '__create_project__'

interface MeetingRow {
  id: string
  meeting_type: string | null
  meeting_date: string | null
  duration_minutes: number | null
  contact_submission_id: number | null
  client_project_id: string | null
  transcript_preview: string | null
  transcript_length: number
  summary: string | null
  lead_name: string | null
  lead_email: string | null
  project_name: string | null
  client_name: string | null
  created_at: string
}

interface LeadOption {
  id: number
  name: string
  email: string | null
}

interface ProjectOption {
  id: string
  project_name: string | null
  client_name: string | null
}

interface MeetingStats {
  total: number
  not_attributed: number
  attributed: number
}

type AttributionFilter = 'all' | 'not_attributed' | 'attributed'

export default function AdminMeetingsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <MeetingsContent />
    </ProtectedRoute>
  )
}

function MeetingsContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const contactIdFromUrl = searchParams.get('contact_submission_id')
  const meetingsReturnPath = useMemo(
    () => buildAdminReturnPath(pathname, searchParams.toString()),
    [pathname, searchParams],
  )

  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<MeetingStats>({ total: 0, not_attributed: 0, attributed: 0 })
  const [loading, setLoading] = useState(true)
  const [attributionFilter, setAttributionFilter] = useState<AttributionFilter>(
    contactIdFromUrl ? 'all' : 'not_attributed'
  )
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Lead / project options (shared across bulk and row actions)
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])
  const [optionsLoaded, setOptionsLoaded] = useState(false)

  // Per-row action state ('attribute' or 'audit' inline form on a single row)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [rowActionType, setRowActionType] = useState<'attribute' | 'audit'>('attribute')
  const [attributeMode, setAttributeMode] = useState<'lead' | 'project'>('lead')
  const [attributeValue, setAttributeValue] = useState('')
  const [attributingInProgress, setAttributingInProgress] = useState(false)
  const [rowAuditMode, setRowAuditMode] = useState<'lead' | 'project'>('lead')
  const [rowAuditValue, setRowAuditValue] = useState('')
  /** When false, row audit uses attributed lead/project only (no Lead/Project/search UI). */
  const [rowAuditPickerOpen, setRowAuditPickerOpen] = useState(false)
  const [leadSearchQuery, setLeadSearchQuery] = useState('')
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [comboboxHighlightIdx, setComboboxHighlightIdx] = useState(-1)
  const comboboxInputRef = useRef<HTMLInputElement>(null)
  const rowAuditInputRef = useRef<HTMLInputElement>(null)

  // Bulk action state (only shown when 2+ selected)
  const [bulkAction, setBulkAction] = useState<'attribute' | 'audit' | null>(null)
  const [bulkMode, setBulkMode] = useState<'lead' | 'project'>('lead')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkInProgress, setBulkInProgress] = useState(false)
  const [bulkAuditMode, setBulkAuditMode] = useState<'lead' | 'project'>('lead')
  const [bulkAuditValue, setBulkAuditValue] = useState('')

  // Build audit state
  const [buildAuditInProgress, setBuildAuditInProgress] = useState(false)
  const [buildAuditError, setBuildAuditError] = useState<string | null>(null)
  const [buildAuditSuccess, setBuildAuditSuccess] = useState<{ auditId: string; meetingsUsed: number } | null>(null)
  /** After a successful build, rows for this lead/project show View diagnostic instead of Build (session only). */
  const [recentAuditByTarget, setRecentAuditByTarget] = useState<{
    auditId: string
    mode: 'lead' | 'project'
    targetId: string
  } | null>(null)
  /** Row that launched the last row-level build (e.g. unattributed meeting + picked lead). */
  const [recentAuditSourceMeetingId, setRecentAuditSourceMeetingId] = useState<string | null>(null)

  const auditBuildPillBase =
    'inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-all'
  const auditBuildPillReady =
    'bg-gray-900/50 border-gray-800 hover:border-emerald-600/40 text-emerald-300 hover:bg-gray-800/80'
  const auditBuildPillLoading =
    'bg-gray-800 border-gray-600 ring-1 ring-emerald-500/40 text-emerald-200 cursor-wait'
  const auditViewPillRow =
    'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all'
  const auditViewPillProminent =
    `${auditBuildPillBase} bg-gray-800 border-gray-600 ring-1 ring-emerald-500/50 text-emerald-300 px-4 py-2 hover:border-emerald-500/60 hover:bg-gray-800/90`

  const rowShowsViewAudit = useCallback(
    (m: MeetingRow) => {
      if (!recentAuditByTarget) return false
      if (recentAuditSourceMeetingId === m.id) return true
      if (recentAuditByTarget.mode === 'lead') {
        return (
          m.contact_submission_id != null &&
          String(m.contact_submission_id) === recentAuditByTarget.targetId
        )
      }
      return m.client_project_id === recentAuditByTarget.targetId
    },
    [recentAuditByTarget, recentAuditSourceMeetingId],
  )

  // Transcript expand
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getHeaders = useCallback(async () => {
    const session = await getCurrentSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }, [])

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (contactIdFromUrl) {
        params.set('contact_submission_id', contactIdFromUrl)
      } else if (attributionFilter === 'not_attributed') {
        params.set('unlinked_only', 'true')
      } else if (attributionFilter === 'attributed') {
        params.set('attributed_only', 'true')
      }
      if (search.trim()) params.set('q', search.trim())
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      params.set('limit', '50')
      const headers = await getHeaders()
      const res = await fetch(`/api/admin/meetings?${params}`, { headers })
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.meetings ?? [])
        setTotal(data.total ?? 0)
        if (data.stats) setStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
    } finally {
      setLoading(false)
    }
  }, [getHeaders, contactIdFromUrl, attributionFilter, search, dateFrom, dateTo])

  const fetchOptions = useCallback(async () => {
    if (optionsLoaded) return
    try {
      const headers = await getHeaders()
      const [leadsRes, projectsRes] = await Promise.all([
        fetch('/api/admin/contact-submissions?limit=200', { headers }),
        fetch('/api/admin/client-projects?limit=200', { headers }),
      ])
      if (leadsRes.ok) {
        const data = await leadsRes.json()
        setLeadOptions(
          (data.submissions || []).map((s: { id: number; name: string; email: string | null }) => ({
            id: s.id,
            name: s.name,
            email: s.email,
          }))
        )
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json()
        setProjectOptions(
          (data.projects || []).map(
            (p: { id: string; project_name: string | null; client_name: string | null }) => ({
              id: p.id,
              project_name: p.project_name ?? null,
              client_name: p.client_name ?? null,
            })
          )
        )
      }
      setOptionsLoaded(true)
    } catch {
      /* options will be empty */
    }
  }, [getHeaders, optionsLoaded])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      fetchMeetings()
    }, 400)
  }

  const navigateToCreateLead = () => {
    router.push(adminCreateUrl('leads', { returnTo: '/admin/meetings' }))
  }

  const navigateToCreateProject = () => {
    router.push(adminCreateUrl('client-projects', { returnTo: '/admin/meetings' }))
  }

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === meetings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(meetings.map((m) => m.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkMode('lead')
    setBulkValue('')
    setBulkAuditValue('')
  }

  const openRowAction = (
    meetingId: string,
    type: 'attribute' | 'audit',
    opts?: { attributeSeedMode?: 'lead' | 'project' },
  ) => {
    setRowActionId(meetingId)
    setRowActionType(type)
    setAttributeMode(opts?.attributeSeedMode ?? 'lead')
    setAttributeValue('')
    setLeadSearchQuery('')
    setProjectSearchQuery('')
    setComboboxHighlightIdx(-1)

    if (type === 'audit') {
      const row = meetings.find((x) => x.id === meetingId)
      const hasLead = row?.contact_submission_id != null
      const hasProject = !!row?.client_project_id
      if (hasLead) {
        setRowAuditMode('lead')
        setRowAuditValue(String(row!.contact_submission_id))
        setRowAuditPickerOpen(false)
      } else if (hasProject) {
        setRowAuditMode('project')
        setRowAuditValue(row!.client_project_id as string)
        setRowAuditPickerOpen(false)
      } else {
        setRowAuditMode('lead')
        setRowAuditValue('')
        setRowAuditPickerOpen(true)
      }
    } else {
      setRowAuditMode('lead')
      setRowAuditValue('')
      setRowAuditPickerOpen(false)
    }
  }

  const handleClearAttribution = async (meetingId: string) => {
    setAttributingInProgress(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`/api/meetings/${meetingId}/assign-lead`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ contact_submission_id: null }),
      })
      if (res.ok) await fetchMeetings()
    } catch (err) {
      console.error('Failed to clear attribution:', err)
    } finally {
      setAttributingInProgress(false)
    }
  }

  const filteredLeadOptions = leadOptions.filter((l) => {
    if (!leadSearchQuery.trim()) return true
    const q = leadSearchQuery.toLowerCase()
    return (l.name?.toLowerCase().includes(q)) || (l.email?.toLowerCase().includes(q))
  })

  const filteredProjectOptions = projectOptions.filter((p) => {
    if (!projectSearchQuery.trim()) return true
    const q = projectSearchQuery.toLowerCase()
    return (
      (p.client_name?.toLowerCase().includes(q)) ||
      (p.project_name?.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    )
  })

  const handleRowAttribute = async () => {
    if (!rowActionId || !attributeValue) return
    setAttributingInProgress(true)
    try {
      const headers = await getHeaders()
      if (attributeMode === 'lead') {
        const csId = attributeValue === 'null' ? null : Number(attributeValue)
        const res = await fetch(`/api/meetings/${rowActionId}/assign-lead`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ contact_submission_id: csId }),
        })
        if (!res.ok) return
      } else {
        const res = await fetch(`/api/admin/meetings/bulk-assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            meeting_ids: [rowActionId],
            client_project_id: attributeValue,
          }),
        })
        if (!res.ok) return
      }
      setRowActionId(null)
      setAttributeValue('')
      await fetchMeetings()
    } catch (err) {
      console.error('Failed to attribute meeting:', err)
    } finally {
      setAttributingInProgress(false)
    }
  }

  const handleRowAudit = async () => {
    if (!rowActionId || !rowAuditValue) return
    const sourceMeetingId = rowActionId
    setBuildAuditError(null)
    setBuildAuditSuccess(null)
    setBuildAuditInProgress(true)
    try {
      const headers = await getHeaders()
      const body: Record<string, unknown> =
        rowAuditMode === 'lead'
          ? { contact_submission_id: Number(rowAuditValue) }
          : { client_project_id: rowAuditValue }
      const res = await fetch('/api/admin/audit-from-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBuildAuditError(data.error || 'Could not build audit. Please try again.')
        return
      }
      setBuildAuditSuccess({ auditId: data.auditId, meetingsUsed: data.meetingsUsed ?? 0 })
      setRecentAuditByTarget({
        auditId: data.auditId,
        mode: rowAuditMode,
        targetId: rowAuditMode === 'lead' ? String(Number(rowAuditValue)) : rowAuditValue,
      })
      setRecentAuditSourceMeetingId(sourceMeetingId)
      setRowActionId(null)
      setRowAuditPickerOpen(false)
      setRowAuditValue('')
    } catch {
      setBuildAuditError('Something went wrong. Please try again.')
    } finally {
      setBuildAuditInProgress(false)
    }
  }

  const dismissRowAttributeForm = useCallback(() => {
    setRowActionId(null)
    setAttributeValue('')
    setLeadSearchQuery('')
    setProjectSearchQuery('')
    setComboboxHighlightIdx(-1)
  }, [])

  const dismissRowAuditForm = useCallback(() => {
    setRowActionId(null)
    setRowAuditValue('')
    setRowAuditPickerOpen(false)
    setLeadSearchQuery('')
    setProjectSearchQuery('')
    setComboboxHighlightIdx(-1)
    setBuildAuditError(null)
  }, [])

  // Bulk attribute
  const handleBulkAttribute = async () => {
    if (selectedIds.size === 0 || !bulkValue) return
    setBulkInProgress(true)
    try {
      const headers = await getHeaders()
      const body: Record<string, unknown> = { meeting_ids: Array.from(selectedIds) }
      if (bulkMode === 'lead') {
        body.contact_submission_id = Number(bulkValue)
      } else {
        body.client_project_id = bulkValue
      }
      const res = await fetch('/api/admin/meetings/bulk-assign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        clearSelection()
        await fetchMeetings()
      }
    } catch (err) {
      console.error('Bulk attribute failed:', err)
    } finally {
      setBulkInProgress(false)
    }
  }

  // Build audit from selected meetings
  const handleBuildAuditFromSelected = async () => {
    setBuildAuditError(null)
    setBuildAuditSuccess(null)
    const targetId = bulkAuditValue.trim()
    if (!targetId) {
      setBuildAuditError('Select a lead or project.')
      return
    }
    setBuildAuditInProgress(true)
    try {
      const headers = await getHeaders()
      const body: Record<string, unknown> =
        bulkAuditMode === 'lead'
          ? { contact_submission_id: Number(targetId) }
          : { client_project_id: targetId }
      const res = await fetch('/api/admin/audit-from-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBuildAuditError(data.error || 'Could not build audit. Please try again.')
        return
      }
      setBuildAuditSuccess({ auditId: data.auditId, meetingsUsed: data.meetingsUsed ?? 0 })
      setRecentAuditByTarget({
        auditId: data.auditId,
        mode: bulkAuditMode,
        targetId: bulkAuditMode === 'lead' ? String(Number(targetId)) : targetId,
      })
      setRecentAuditSourceMeetingId(null)
      clearSelection()
    } catch {
      setBuildAuditError('Something went wrong. Please try again.')
    } finally {
      setBuildAuditInProgress(false)
    }
  }

  const selectedCount = selectedIds.size
  const allSelected = meetings.length > 0 && selectedIds.size === meetings.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < meetings.length

  const statPills: { key: AttributionFilter; label: string; count: number; color: string; activeRing: string }[] = [
    { key: 'all', label: 'All', count: stats.total, color: 'text-gray-300', activeRing: 'ring-gray-500' },
    { key: 'not_attributed', label: 'Not attributed', count: stats.not_attributed, color: 'text-amber-400', activeRing: 'ring-amber-500' },
    { key: 'attributed', label: 'Attributed', count: stats.attributed, color: 'text-violet-400', activeRing: 'ring-violet-500' },
  ]

  return (
    <div id="admin-main" className="min-h-screen bg-gray-950 text-gray-100">
      <Breadcrumbs
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Meetings', href: '/admin/meetings' },
        ]}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Video className="w-7 h-7 text-violet-400" />
              Meeting records
            </h1>
            <p className="text-gray-400 text-sm mt-1 max-w-xl">
              Review transcripts from sales calls and discovery sessions. Attribute each meeting to
              a lead or project, then use them to build diagnostic audits.
            </p>
          </div>
          <button
            onClick={() => fetchMeetings()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-600 disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Contact-specific banner */}
        {contactIdFromUrl && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-violet-900/30 border border-violet-700/50 text-sm text-violet-200 flex items-center gap-2 flex-wrap">
            Showing meetings for lead (ID: {contactIdFromUrl}).{' '}
            <Link href="/admin/meetings" className="text-violet-400 hover:underline">
              Show all
            </Link>
            <span className="text-violet-600">·</span>
            <Link href={`/admin/outreach?tab=leads&id=${contactIdFromUrl}`} className="text-violet-400 hover:underline">
              Back to lead
            </Link>
          </div>
        )}

        {/* Stats pills */}
        {!contactIdFromUrl && (
          <div className="flex flex-wrap gap-3 mb-5">
            {statPills.map((pill) => (
              <button
                key={pill.key}
                onClick={() => {
                  setAttributionFilter(pill.key)
                  setSelectedIds(new Set())
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  attributionFilter === pill.key
                    ? `bg-gray-800 border-gray-600 ring-1 ${pill.activeRing}`
                    : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                }`}
              >
                <span className={pill.color}>{pill.count}</span>
                <span className="text-gray-400">{pill.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filter panel */}
        <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-3 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, transcript, or type..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchMeetings()}
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-500 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:border-gray-600 focus:outline-none [color-scheme:dark]"
                title="From date"
              />
              <span className="text-gray-600 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:border-gray-600 focus:outline-none [color-scheme:dark]"
                title="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="text-gray-500 hover:text-gray-300"
                  title="Clear dates"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bulk action bar — only when 2+ selected */}
        {selectedCount >= 2 && (
          <div className="rounded-lg border border-violet-700/40 bg-violet-950/20 p-4 mb-5">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm text-violet-200 font-medium">
                {selectedCount} meetings selected
              </span>
              <button
                onClick={clearSelection}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <X size={12} />
                Clear
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setBulkAction(bulkAction === 'attribute' ? null : 'attribute')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    bulkAction === 'attribute'
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <User size={14} />
                  Attribute
                </button>
                <button
                  onClick={() => setBulkAction(bulkAction === 'audit' ? null : 'audit')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    bulkAction === 'audit'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Sparkles size={14} />
                  Build audit
                </button>
              </div>
            </div>

            {/* Attribute form */}
            {bulkAction === 'attribute' && (
              <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <select
                    value={bulkMode}
                    onChange={(e) => { setBulkMode(e.target.value as 'lead' | 'project'); setBulkValue('') }}
                    className="rounded bg-gray-800 border border-gray-700 text-gray-200 text-sm py-1.5 px-2"
                  >
                    <option value="lead">To lead</option>
                    <option value="project">To project</option>
                  </select>
                  <select
                    value={bulkValue}
                    onChange={(e) => {
                      if (e.target.value === CREATE_LEAD_SENTINEL) {
                        navigateToCreateLead()
                        return
                      }
                      if (e.target.value === CREATE_PROJECT_SENTINEL) {
                        navigateToCreateProject()
                        return
                      }
                      setBulkValue(e.target.value)
                    }}
                    className="rounded bg-gray-800 border border-gray-700 text-gray-200 text-sm py-1.5 px-2 min-w-[200px]"
                  >
                    <option value="">{bulkMode === 'lead' ? 'Select lead...' : 'Select project...'}</option>
                    {bulkMode === 'lead' && <option value={CREATE_LEAD_SENTINEL}>+ Create new lead...</option>}
                    {bulkMode === 'project' && (
                      <option value={CREATE_PROJECT_SENTINEL}>+ Create new project...</option>
                    )}
                    {bulkMode === 'lead'
                      ? leadOptions.map((l) => (
                          <option key={l.id} value={String(l.id)}>{l.name} {l.email ? `(${l.email})` : ''}</option>
                        ))
                      : projectOptions.map((p) => (
                          <option key={p.id} value={p.id}>{p.client_name || p.project_name || p.id}</option>
                        ))}
                  </select>
                  <button
                    onClick={handleBulkAttribute}
                    disabled={bulkInProgress || !bulkValue}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium flex items-center gap-1.5"
                  >
                    {bulkInProgress ? <Loader2 size={14} className="animate-spin" /> : null}
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Build audit form */}
            {bulkAction === 'audit' && (
              <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <select
                    value={bulkAuditMode}
                    onChange={(e) => { setBulkAuditMode(e.target.value as 'lead' | 'project'); setBulkAuditValue('') }}
                    className="rounded bg-gray-800 border border-gray-700 text-gray-200 text-sm py-1.5 px-2"
                  >
                    <option value="lead">For lead</option>
                    <option value="project">For project</option>
                  </select>
                  <select
                    value={bulkAuditValue}
                    onChange={(e) => {
                      if (e.target.value === CREATE_LEAD_SENTINEL) {
                        navigateToCreateLead()
                        return
                      }
                      if (e.target.value === CREATE_PROJECT_SENTINEL) {
                        navigateToCreateProject()
                        return
                      }
                      setBulkAuditValue(e.target.value)
                    }}
                    className="rounded bg-gray-800 border border-gray-700 text-gray-200 text-sm py-1.5 px-2 min-w-[200px]"
                  >
                    <option value="">{bulkAuditMode === 'lead' ? 'Select lead...' : 'Select project...'}</option>
                    {bulkAuditMode === 'lead' && <option value={CREATE_LEAD_SENTINEL}>+ Create new lead...</option>}
                    {bulkAuditMode === 'project' && (
                      <option value={CREATE_PROJECT_SENTINEL}>+ Create new project...</option>
                    )}
                    {bulkAuditMode === 'lead'
                      ? leadOptions.map((l) => (
                          <option key={l.id} value={String(l.id)}>{l.name} {l.email ? `(${l.email})` : ''}</option>
                        ))
                      : projectOptions.map((p) => (
                          <option key={p.id} value={p.id}>{p.client_name || p.project_name || p.id}</option>
                        ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleBuildAuditFromSelected}
                    disabled={buildAuditInProgress || !bulkAuditValue}
                    aria-busy={buildAuditInProgress}
                    className={`min-h-[2.25rem] px-3 py-1.5 ${auditBuildPillBase} ${
                      buildAuditInProgress
                        ? auditBuildPillLoading
                        : 'bg-emerald-950/40 border-emerald-600/45 text-emerald-50 hover:bg-emerald-900/35 hover:border-emerald-500/55'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {buildAuditInProgress ? (
                      <>
                        <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
                        <span>Building audit…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="shrink-0" aria-hidden />
                        <span>Build audit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {buildAuditError && (
              <p className="mt-3 text-sm text-red-400" role="alert">{buildAuditError}</p>
            )}
            {buildAuditSuccess && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-sm text-emerald-200/90">
                  Audit ready — used {buildAuditSuccess.meetingsUsed} meeting
                  {buildAuditSuccess.meetingsUsed === 1 ? '' : 's'}.
                </p>
                <ViewDiagnosticLink
                  auditId={buildAuditSuccess.auditId}
                  returnPath={meetingsReturnPath}
                  className={auditViewPillProminent}
                >
                  <ExternalLink size={14} className="shrink-0" aria-hidden />
                  View diagnostic
                </ViewDiagnosticLink>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No meetings found</p>
            <p className="text-sm mt-1">
              {attributionFilter === 'not_attributed'
                ? 'All meetings have been attributed.'
                : 'Meeting records appear here automatically from your connected calendar.'}
            </p>
            {attributionFilter !== 'all' && (
              <button
                onClick={() => setAttributionFilter('all')}
                className="mt-3 text-sm text-violet-400 hover:text-violet-300"
              >
                Show all meetings
              </button>
            )}
          </div>
        ) : (
          <div className="border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900/80 text-gray-400 text-left">
                    <th className="px-3 py-3 w-10">
                      <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-300">
                        {allSelected ? (
                          <CheckSquare size={16} />
                        ) : someSelected ? (
                          <MinusSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">Date / Type</th>
                    <th className="px-4 py-3 font-medium">Summary / Transcript</th>
                    <th className="px-4 py-3 font-medium">Attributed to</th>
                    <th className="px-4 py-3 font-medium min-w-[168px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {meetings.map((m) => {
                    const isSelected = selectedIds.has(m.id)
                    const isAttributed = m.contact_submission_id != null || m.client_project_id != null
                    return (
                      <Fragment key={m.id}>
                        <tr className={`hover:bg-gray-900/30 ${isSelected ? 'bg-violet-950/10' : ''}`}>
                          {/* Checkbox */}
                          <td className="px-3 py-3 align-top">
                            <button
                              onClick={() => toggleSelect(m.id)}
                              className="text-gray-500 hover:text-gray-300"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-violet-400" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>

                          {/* Date / Type */}
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-2 text-gray-300">
                              <Calendar size={14} className="text-gray-500 shrink-0" />
                              {m.meeting_date
                                ? new Date(m.meeting_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 capitalize">
                              {(m.meeting_type ?? 'meeting').replace(/_/g, ' ')}
                              {m.duration_minutes != null &&
                                m.duration_minutes > 0 &&
                                ` · ${m.duration_minutes} min`}
                            </div>
                          </td>

                          {/* Summary / Transcript */}
                          <td className="px-4 py-3 align-top max-w-md">
                            {m.summary && (
                              <p className="text-gray-400 text-xs mb-1 line-clamp-2">{m.summary}</p>
                            )}
                            {m.transcript_preview ? (
                              <button
                                type="button"
                                onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                                className="text-left text-gray-500 text-xs block hover:text-gray-400"
                              >
                                {m.transcript_preview}
                                {m.transcript_length > 200 && (
                                  <span className="text-violet-400 ml-1">
                                    {expandedId === m.id ? ' (collapse)' : '... (expand)'}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <span className="text-gray-600 text-xs">No transcript</span>
                            )}
                          </td>

                          {/* Attributed to — single source of truth for identity (Actions stay verb-only) */}
                          <td className="px-4 py-3 align-top max-w-[260px]">
                            {m.contact_submission_id ? (
                              <div
                                className="min-w-0"
                                title={[m.lead_name, m.lead_email].filter(Boolean).join(' · ') || undefined}
                              >
                                <div className="flex items-start gap-1.5 text-violet-400 min-w-0">
                                  <User size={12} className="shrink-0 mt-0.5" aria-hidden />
                                  <span className="truncate font-medium">{m.lead_name ?? 'Lead'}</span>
                                </div>
                                {m.lead_email ? (
                                  <p className="text-gray-500 text-xs truncate mt-0.5 pl-[18px]">{m.lead_email}</p>
                                ) : null}
                              </div>
                            ) : m.client_project_id ? (
                              <div
                                className="min-w-0"
                                title={[m.client_name, m.project_name].filter(Boolean).join(' · ') || undefined}
                              >
                                <div className="flex items-start gap-1.5 text-gray-400 min-w-0">
                                  <Folder size={12} className="shrink-0 mt-0.5 text-amber-500/80" aria-hidden />
                                  <span className="truncate font-medium">
                                    {m.client_name || m.project_name || 'Project'}
                                  </span>
                                </div>
                                {m.client_name &&
                                m.project_name &&
                                m.project_name !== m.client_name ? (
                                  <p className="text-gray-500 text-xs truncate mt-0.5 pl-[18px]">
                                    {m.project_name}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 align-top">
                            {rowActionId === m.id && rowActionType === 'attribute' ? (
                              <div className="flex flex-col gap-2 min-w-[220px]">
                                <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-700/80">
                                  <p className="text-xs font-semibold text-violet-200 min-w-0 pr-1">
                                    Change attribution
                                  </p>
                                  <button
                                    type="button"
                                    onClick={dismissRowAttributeForm}
                                    className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-700"
                                    aria-label="Close without saving changes"
                                    title="Close"
                                  >
                                    <X size={14} aria-hidden />
                                  </button>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAttributeMode('lead')
                                      setAttributeValue('')
                                      setLeadSearchQuery('')
                                      setProjectSearchQuery('')
                                      setComboboxHighlightIdx(-1)
                                    }}
                                    className={`px-2 py-0.5 rounded text-xs ${
                                      attributeMode === 'lead'
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-gray-800 text-gray-400'
                                    }`}
                                  >
                                    Lead
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAttributeMode('project')
                                      setAttributeValue('')
                                      setLeadSearchQuery('')
                                      setProjectSearchQuery('')
                                      setComboboxHighlightIdx(-1)
                                    }}
                                    className={`px-2 py-0.5 rounded text-xs ${
                                      attributeMode === 'project'
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-gray-800 text-gray-400'
                                    }`}
                                  >
                                    Project
                                  </button>
                                </div>
                                {attributeValue ? (
                                  <div className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 flex items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                      {attributeMode === 'lead' ? (
                                        <>
                                          <div className="flex items-center gap-1 text-xs text-violet-300">
                                            <User size={12} className="shrink-0" />
                                            <span className="font-medium truncate">
                                              {leadOptions.find((l) => String(l.id) === attributeValue)?.name ?? attributeValue}
                                            </span>
                                          </div>
                                          {leadOptions.find((l) => String(l.id) === attributeValue)?.email && (
                                            <p className="text-[11px] text-gray-500 truncate mt-0.5 pl-4">
                                              {leadOptions.find((l) => String(l.id) === attributeValue)?.email}
                                            </p>
                                          )}
                                        </>
                                      ) : (
                                        <div className="flex items-center gap-1 text-xs text-gray-200">
                                          <Folder size={12} className="shrink-0 text-amber-500/70" />
                                          <span className="font-medium truncate">
                                            {projectOptions.find((p) => p.id === attributeValue)?.client_name ||
                                              projectOptions.find((p) => p.id === attributeValue)?.project_name ||
                                              attributeValue}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAttributeValue('')
                                        setLeadSearchQuery('')
                                        setProjectSearchQuery('')
                                        setComboboxHighlightIdx(-1)
                                        setTimeout(() => comboboxInputRef.current?.focus(), 0)
                                      }}
                                      className="text-xs text-violet-400 hover:text-violet-300 shrink-0"
                                    >
                                      Change
                                    </button>
                                  </div>
                                ) : (
                                  <div className="relative">
                                    <div className="flex items-center gap-1 rounded bg-gray-800 border border-gray-700 px-2 py-1">
                                      <Search size={12} className="text-gray-500 shrink-0" />
                                      <input
                                        ref={comboboxInputRef}
                                        type="text"
                                        value={attributeMode === 'lead' ? leadSearchQuery : projectSearchQuery}
                                        onChange={(e) => {
                                          if (attributeMode === 'lead') setLeadSearchQuery(e.target.value)
                                          else setProjectSearchQuery(e.target.value)
                                          setComboboxHighlightIdx(-1)
                                        }}
                                        onKeyDown={(e) => {
                                          const items = attributeMode === 'lead' ? filteredLeadOptions : filteredProjectOptions
                                          if (e.key === 'ArrowDown') {
                                            e.preventDefault()
                                            setComboboxHighlightIdx((prev) => Math.min(prev + 1, items.length - 1))
                                          } else if (e.key === 'ArrowUp') {
                                            e.preventDefault()
                                            setComboboxHighlightIdx((prev) => Math.max(prev - 1, -1))
                                          } else if (e.key === 'Enter' && comboboxHighlightIdx >= 0) {
                                            e.preventDefault()
                                            if (attributeMode === 'lead') {
                                              const lead = filteredLeadOptions[comboboxHighlightIdx]
                                              if (lead) setAttributeValue(String(lead.id))
                                            } else {
                                              const proj = filteredProjectOptions[comboboxHighlightIdx]
                                              if (proj) setAttributeValue(proj.id)
                                            }
                                          } else if (e.key === 'Escape') {
                                            dismissRowAttributeForm()
                                          }
                                        }}
                                        placeholder={attributeMode === 'lead' ? 'Search leads...' : 'Search projects...'}
                                        className="bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none w-full"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="absolute z-20 mt-1 w-full rounded bg-gray-800 border border-gray-700 shadow-lg flex flex-col max-h-56">
                                      <ul className="overflow-y-auto flex-1 py-1">
                                        {(attributeMode === 'lead' ? filteredLeadOptions : filteredProjectOptions).length === 0 ? (
                                          <li className="px-2 py-2 text-xs text-gray-500">
                                            No {attributeMode === 'lead' ? 'leads' : 'projects'} match &ldquo;{attributeMode === 'lead' ? leadSearchQuery : projectSearchQuery}&rdquo;
                                          </li>
                                        ) : attributeMode === 'lead' ? (
                                          filteredLeadOptions.map((l, idx) => {
                                            const isCurrentAttributed =
                                              m.contact_submission_id != null && l.id === m.contact_submission_id
                                            const isKbHighlight = comboboxHighlightIdx === idx
                                            return (
                                              <li
                                                key={l.id}
                                                onClick={() => setAttributeValue(String(l.id))}
                                                onMouseEnter={() => setComboboxHighlightIdx(idx)}
                                                className={`px-2 py-1.5 text-xs text-gray-200 cursor-pointer border-l-2 flex items-center justify-between gap-2 ${
                                                  isCurrentAttributed
                                                    ? 'border-violet-500 bg-violet-950/45'
                                                    : 'border-transparent'
                                                } ${
                                                  isKbHighlight
                                                    ? isCurrentAttributed
                                                      ? 'bg-violet-900/55'
                                                      : 'bg-gray-700'
                                                    : ''
                                                } ${
                                                  !isKbHighlight && !isCurrentAttributed ? 'hover:bg-gray-700' : ''
                                                } ${
                                                  !isKbHighlight && isCurrentAttributed ? 'hover:bg-violet-900/50' : ''
                                                }`}
                                              >
                                                <span className="min-w-0">
                                                  <span className="font-medium">{l.name}</span>
                                                  {l.email && (
                                                    <span className="text-gray-500 ml-1">({l.email})</span>
                                                  )}
                                                </span>
                                                {isCurrentAttributed ? (
                                                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                                                    Current
                                                  </span>
                                                ) : null}
                                              </li>
                                            )
                                          })
                                        ) : (
                                          filteredProjectOptions.map((p, idx) => {
                                            const isCurrentAttributed =
                                              m.client_project_id != null && p.id === m.client_project_id
                                            const isKbHighlight = comboboxHighlightIdx === idx
                                            return (
                                              <li
                                                key={p.id}
                                                onClick={() => setAttributeValue(p.id)}
                                                onMouseEnter={() => setComboboxHighlightIdx(idx)}
                                                className={`px-2 py-1.5 text-xs text-gray-200 cursor-pointer border-l-2 flex items-center justify-between gap-2 ${
                                                  isCurrentAttributed
                                                    ? 'border-amber-500/80 bg-amber-950/25'
                                                    : 'border-transparent'
                                                } ${
                                                  isKbHighlight
                                                    ? isCurrentAttributed
                                                      ? 'bg-amber-950/40'
                                                      : 'bg-gray-700'
                                                    : ''
                                                } ${
                                                  !isKbHighlight && !isCurrentAttributed ? 'hover:bg-gray-700' : ''
                                                } ${
                                                  !isKbHighlight && isCurrentAttributed ? 'hover:bg-amber-950/35' : ''
                                                }`}
                                              >
                                                <span className="min-w-0 truncate">
                                                  {p.client_name || p.project_name || p.id}
                                                </span>
                                                {isCurrentAttributed ? (
                                                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-400/90">
                                                    Current
                                                  </span>
                                                ) : null}
                                              </li>
                                            )
                                          })
                                        )}
                                      </ul>
                                      {attributeMode === 'lead' && (
                                        <div className="px-2 py-1.5 border-t border-gray-700 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => navigateToCreateLead()}
                                            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 w-full"
                                          >
                                            <Plus size={12} /> Create new lead...
                                          </button>
                                        </div>
                                      )}
                                      {attributeMode === 'project' && (
                                        <div className="px-2 py-1.5 border-t border-gray-700 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => navigateToCreateProject()}
                                            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 w-full"
                                          >
                                            <Plus size={12} /> Create new project...
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-1">
                                  <button
                                    onClick={handleRowAttribute}
                                    disabled={!attributeValue || attributingInProgress}
                                    className="flex-1 py-1 rounded text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white"
                                  >
                                    {attributingInProgress ? '...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={dismissRowAttributeForm}
                                    className="py-1 px-2 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : rowActionId === m.id && rowActionType === 'audit' ? (
                              <div className="flex flex-col gap-2 min-w-[220px]">
                                <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-700/80">
                                  <p className="text-xs font-semibold text-emerald-200 min-w-0 pr-1">
                                    Build diagnostic audit
                                  </p>
                                  <button
                                    type="button"
                                    onClick={dismissRowAuditForm}
                                    className="shrink-0 p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-700"
                                    aria-label="Close without building audit"
                                    title="Close"
                                  >
                                    <X size={14} aria-hidden />
                                  </button>
                                </div>

                                {!rowAuditPickerOpen && rowAuditValue ? (
                                  <>
                                    <div className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2">
                                      {rowAuditMode === 'lead' ? (
                                        <>
                                          <div className="flex items-center gap-1 text-xs text-emerald-300">
                                            <User size={12} className="shrink-0" aria-hidden />
                                            <span className="font-medium truncate">
                                              {leadOptions.find((l) => String(l.id) === rowAuditValue)?.name ??
                                                m.lead_name ??
                                                rowAuditValue}
                                            </span>
                                          </div>
                                          {(leadOptions.find((l) => String(l.id) === rowAuditValue)?.email ||
                                            m.lead_email) && (
                                            <p className="text-[11px] text-gray-500 truncate mt-0.5 pl-4">
                                              {leadOptions.find((l) => String(l.id) === rowAuditValue)?.email ??
                                                m.lead_email}
                                            </p>
                                          )}
                                        </>
                                      ) : (
                                        <div className="flex items-center gap-1 text-xs text-gray-200">
                                          <Folder size={12} className="shrink-0 text-amber-500/70" aria-hidden />
                                          <span className="font-medium truncate">
                                            {projectOptions.find((p) => p.id === rowAuditValue)?.client_name ||
                                              projectOptions.find((p) => p.id === rowAuditValue)?.project_name ||
                                              m.client_name ||
                                              m.project_name ||
                                              rowAuditValue}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRowAuditPickerOpen(true)
                                        setRowAuditValue('')
                                        setLeadSearchQuery('')
                                        setProjectSearchQuery('')
                                        setComboboxHighlightIdx(-1)
                                        setTimeout(() => rowAuditInputRef.current?.focus(), 0)
                                      }}
                                      className="text-left text-[10px] text-gray-500 hover:text-emerald-400 transition-colors"
                                      aria-label="Pick a different lead or project for this audit"
                                    >
                                      Change target
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRowAuditMode('lead')
                                          setRowAuditValue('')
                                          setLeadSearchQuery('')
                                          setProjectSearchQuery('')
                                          setComboboxHighlightIdx(-1)
                                        }}
                                        className={`px-2 py-0.5 rounded text-xs ${
                                          rowAuditMode === 'lead'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-gray-800 text-gray-400'
                                        }`}
                                      >
                                        Lead
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRowAuditMode('project')
                                          setRowAuditValue('')
                                          setLeadSearchQuery('')
                                          setProjectSearchQuery('')
                                          setComboboxHighlightIdx(-1)
                                        }}
                                        className={`px-2 py-0.5 rounded text-xs ${
                                          rowAuditMode === 'project'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-gray-800 text-gray-400'
                                        }`}
                                      >
                                        Project
                                      </button>
                                    </div>
                                    {rowAuditValue ? (
                                      <div className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-2 flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                          {rowAuditMode === 'lead' ? (
                                            <>
                                              <div className="flex items-center gap-1 text-xs text-emerald-300">
                                                <User size={12} className="shrink-0" />
                                                <span className="font-medium truncate">
                                                  {leadOptions.find((l) => String(l.id) === rowAuditValue)?.name ??
                                                    rowAuditValue}
                                                </span>
                                              </div>
                                              {leadOptions.find((l) => String(l.id) === rowAuditValue)?.email && (
                                                <p className="text-[11px] text-gray-500 truncate mt-0.5 pl-4">
                                                  {leadOptions.find((l) => String(l.id) === rowAuditValue)?.email}
                                                </p>
                                              )}
                                            </>
                                          ) : (
                                            <div className="flex items-center gap-1 text-xs text-gray-200">
                                              <Folder size={12} className="shrink-0 text-amber-500/70" />
                                              <span className="font-medium truncate">
                                                {projectOptions.find((p) => p.id === rowAuditValue)?.client_name ||
                                                  projectOptions.find((p) => p.id === rowAuditValue)?.project_name ||
                                                  rowAuditValue}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRowAuditValue('')
                                            setLeadSearchQuery('')
                                            setProjectSearchQuery('')
                                            setComboboxHighlightIdx(-1)
                                            setTimeout(() => rowAuditInputRef.current?.focus(), 0)
                                          }}
                                          className="text-xs text-emerald-400 hover:text-emerald-300 shrink-0"
                                        >
                                          Change
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="relative">
                                        <div className="flex items-center gap-1 rounded bg-gray-800 border border-gray-700 px-2 py-1">
                                          <Search size={12} className="text-gray-500 shrink-0" />
                                          <input
                                            ref={rowAuditInputRef}
                                            type="text"
                                            value={rowAuditMode === 'lead' ? leadSearchQuery : projectSearchQuery}
                                            onChange={(e) => {
                                              if (rowAuditMode === 'lead') setLeadSearchQuery(e.target.value)
                                              else setProjectSearchQuery(e.target.value)
                                              setComboboxHighlightIdx(-1)
                                            }}
                                            onKeyDown={(e) => {
                                              const items =
                                                rowAuditMode === 'lead'
                                                  ? filteredLeadOptions
                                                  : filteredProjectOptions
                                              if (e.key === 'ArrowDown') {
                                                e.preventDefault()
                                                setComboboxHighlightIdx((prev) =>
                                                  Math.min(prev + 1, items.length - 1),
                                                )
                                              } else if (e.key === 'ArrowUp') {
                                                e.preventDefault()
                                                setComboboxHighlightIdx((prev) => Math.max(prev - 1, -1))
                                              } else if (e.key === 'Enter' && comboboxHighlightIdx >= 0) {
                                                e.preventDefault()
                                                if (rowAuditMode === 'lead') {
                                                  const lead = filteredLeadOptions[comboboxHighlightIdx]
                                                  if (lead) setRowAuditValue(String(lead.id))
                                                } else {
                                                  const proj = filteredProjectOptions[comboboxHighlightIdx]
                                                  if (proj) setRowAuditValue(proj.id)
                                                }
                                              } else if (e.key === 'Escape') {
                                                dismissRowAuditForm()
                                              }
                                            }}
                                            placeholder={
                                              rowAuditMode === 'lead' ? 'Search leads...' : 'Search projects...'
                                            }
                                            className="bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none w-full"
                                            autoFocus
                                          />
                                        </div>
                                        <div className="absolute z-20 mt-1 w-full rounded bg-gray-800 border border-gray-700 shadow-lg flex flex-col max-h-56">
                                          <ul className="overflow-y-auto flex-1 py-1">
                                            {(rowAuditMode === 'lead'
                                              ? filteredLeadOptions
                                              : filteredProjectOptions
                                            ).length === 0 ? (
                                              <li className="px-2 py-2 text-xs text-gray-500">
                                                No {rowAuditMode === 'lead' ? 'leads' : 'projects'} match &ldquo;
                                                {rowAuditMode === 'lead' ? leadSearchQuery : projectSearchQuery}
                                                &rdquo;
                                              </li>
                                            ) : rowAuditMode === 'lead' ? (
                                              filteredLeadOptions.map((l, idx) => (
                                                <li
                                                  key={l.id}
                                                  onClick={() => setRowAuditValue(String(l.id))}
                                                  onMouseEnter={() => setComboboxHighlightIdx(idx)}
                                                  className={`px-2 py-1.5 text-xs text-gray-200 cursor-pointer ${
                                                    comboboxHighlightIdx === idx ? 'bg-gray-700' : 'hover:bg-gray-700'
                                                  }`}
                                                >
                                                  {l.name}
                                                  {l.email && (
                                                    <span className="text-gray-500 ml-1">({l.email})</span>
                                                  )}
                                                </li>
                                              ))
                                            ) : (
                                              filteredProjectOptions.map((p, idx) => (
                                                <li
                                                  key={p.id}
                                                  onClick={() => setRowAuditValue(p.id)}
                                                  onMouseEnter={() => setComboboxHighlightIdx(idx)}
                                                  className={`px-2 py-1.5 text-xs text-gray-200 cursor-pointer ${
                                                    comboboxHighlightIdx === idx ? 'bg-gray-700' : 'hover:bg-gray-700'
                                                  }`}
                                                >
                                                  {p.client_name || p.project_name || p.id}
                                                </li>
                                              ))
                                            )}
                                          </ul>
                                          {rowAuditMode === 'lead' && (
                                            <div className="px-2 py-1.5 border-t border-gray-700 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => navigateToCreateLead()}
                                                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 w-full"
                                              >
                                                <Plus size={12} /> Create new lead...
                                              </button>
                                            </div>
                                          )}
                                          {rowAuditMode === 'project' && (
                                            <div className="px-2 py-1.5 border-t border-gray-700 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => navigateToCreateProject()}
                                                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 w-full"
                                              >
                                                <Plus size={12} /> Create new project...
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={handleRowAudit}
                                    disabled={!rowAuditValue || buildAuditInProgress}
                                    aria-busy={buildAuditInProgress}
                                    className={`flex-1 min-h-[2.25rem] py-2 px-3 ${auditBuildPillBase} text-xs ${
                                      buildAuditInProgress
                                        ? auditBuildPillLoading
                                        : 'bg-emerald-950/40 border-emerald-600/45 text-emerald-50 hover:bg-emerald-900/35 hover:border-emerald-500/55'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {buildAuditInProgress ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                                        <span>Building audit…</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden />
                                        <span>Build audit</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={dismissRowAuditForm}
                                    disabled={buildAuditInProgress}
                                    className="py-2 px-2 rounded-lg text-xs border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                {buildAuditError && rowActionId === m.id && (
                                  <p className="text-xs text-red-400">{buildAuditError}</p>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                {isAttributed ? (
                                  <>
                                    {recentAuditByTarget && rowShowsViewAudit(m) ? (
                                      <ViewDiagnosticLink
                                        auditId={recentAuditByTarget.auditId}
                                        returnPath={meetingsReturnPath}
                                        className={auditViewPillRow}
                                        title="Open diagnostic workspace for this lead or project"
                                        aria-label="View diagnostic"
                                      >
                                        <ExternalLink size={12} aria-hidden />
                                        View diagnostic
                                      </ViewDiagnosticLink>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openRowAction(m.id, 'audit')}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                        title="Build audit from meetings for this lead or project"
                                        aria-label="Build audit from meetings for this lead or project"
                                      >
                                        <Sparkles size={12} aria-hidden />
                                        Audit
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openRowAction(m.id, 'attribute', {
                                          attributeSeedMode: m.contact_submission_id ? 'lead' : 'project',
                                        })
                                      }
                                      className="inline-flex items-center justify-center p-1.5 rounded-md border border-gray-600 bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white"
                                      title="Change attribution"
                                      aria-label="Change attribution"
                                    >
                                      <Pencil size={14} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleClearAttribution(m.id)}
                                      disabled={attributingInProgress}
                                      className="inline-flex items-center justify-center p-1.5 rounded-md border border-gray-600 bg-gray-800/80 text-gray-400 hover:bg-red-950/50 hover:text-red-400 hover:border-red-900/50 disabled:opacity-50"
                                      title="Remove attribution"
                                      aria-label={`Remove attribution for this meeting${m.meeting_date ? ` (${new Date(m.meeting_date).toLocaleDateString()})` : ''}`}
                                    >
                                      <Unlink size={14} aria-hidden />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openRowAction(m.id, 'attribute')}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                      title="Link to lead or project"
                                      aria-label="Link meeting to lead or project"
                                    >
                                      <User size={12} aria-hidden />
                                      Attribute
                                    </button>
                                    {recentAuditByTarget && rowShowsViewAudit(m) ? (
                                      <ViewDiagnosticLink
                                        auditId={recentAuditByTarget.auditId}
                                        returnPath={meetingsReturnPath}
                                        className={auditViewPillRow}
                                        title="Open diagnostic workspace for this lead or project"
                                        aria-label="View diagnostic"
                                      >
                                        <ExternalLink size={12} aria-hidden />
                                        View diagnostic
                                      </ViewDiagnosticLink>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openRowAction(m.id, 'audit')}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                        title="Build audit — choose which lead or project to attach it to"
                                        aria-label="Build audit — choose lead or project"
                                      >
                                        <Sparkles size={12} aria-hidden />
                                        Audit
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {expandedId === m.id && m.transcript_preview && (
                          <tr>
                            <td colSpan={5} className="px-4 py-2 bg-gray-900/50">
                              <div className="flex items-start gap-2 ml-10">
                                <FileText size={14} className="text-gray-500 shrink-0 mt-0.5" />
                                <pre className="text-xs text-gray-500 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                                  {m.transcript_preview}
                                  {m.transcript_length > 200 &&
                                    ` ... (${m.transcript_length} chars total)`}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {total > meetings.length && (
              <div className="px-4 py-2 bg-gray-900/50 text-xs text-gray-500 border-t border-gray-800">
                Showing {meetings.length} of {total} meetings
              </div>
            )}
          </div>
        )}

        {buildAuditSuccess && selectedCount < 2 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-gray-800 bg-gray-900/50">
            <p className="text-sm text-gray-300 flex-1 min-w-[200px]">
              Audit ready — {buildAuditSuccess.meetingsUsed} meeting
              {buildAuditSuccess.meetingsUsed === 1 ? '' : 's'} processed.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <ViewDiagnosticLink
                auditId={buildAuditSuccess.auditId}
                returnPath={meetingsReturnPath}
                className={auditViewPillProminent}
              >
                <ExternalLink size={14} className="shrink-0" aria-hidden />
                View diagnostic
              </ViewDiagnosticLink>
              <button
                type="button"
                onClick={() => {
                  setBuildAuditSuccess(null)
                  setRecentAuditSourceMeetingId(null)
                }}
                className="p-2 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                aria-label="Dismiss notice"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500">
          Once attributed, meetings appear in the contact&apos;s sales conversation (
          <Link href="/admin/sales" className="text-violet-400 hover:text-violet-300">
            Sales Dashboard
          </Link>
          ) under &quot;Previous meetings & tasks.&quot; You can also manage action items in{' '}
          <Link href="/admin/meeting-tasks" className="text-violet-400 hover:text-violet-300">
            Meeting Tasks
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
