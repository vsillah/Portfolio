'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Share2,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Image as ImageIcon,
  Volume2,
  Linkedin,
  Play,
  Zap,
  AlertCircle,
  Info,
  ThumbsUp,
  ThumbsDown,
  Square,
  Search,
  Calendar,
  CheckSquare,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { ExtractionStatusChip } from '@/components/admin/ExtractionStatusChip'
import { useExtractionStatus } from '@/lib/hooks/useExtractionStatus'
import { getCurrentSession } from '@/lib/auth'
import {
  STATUS_CONFIG,
  CONTENT_STATUSES,
  PLATFORMS,
  truncateForPreview,
  formatHashtags,
} from '@/lib/social-content'
import type { SocialContentItem, ContentStatus, SocialPlatform } from '@/lib/social-content'
import Link from 'next/link'

interface Stats {
  draft: number
  approved: number
  scheduled: number
  published: number
  rejected: number
  total: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface MeetingRecord {
  id: string
  meeting_type: string
  meeting_date: string
  created_at: string
  duration_minutes: number | null
  meeting_title: string | null
  source_url: string | null
  snippet: string | null
  queued_count: number
  has_transcript: boolean
}

const MEETINGS_PER_PAGE = 5

function SocialContentQueuePage() {
  const [items, setItems] = useState<SocialContentItem[]>([])
  const [stats, setStats] = useState<Stats>({ draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Extraction trigger state
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [meetingsTotal, setMeetingsTotal] = useState(0)
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingSearch, setMeetingSearch] = useState('')
  const [meetingDateFrom, setMeetingDateFrom] = useState('')
  const [meetingDateTo, setMeetingDateTo] = useState('')
  const [meetingsPage, setMeetingsPage] = useState(1)
  const [selectedMeeting, setSelectedMeeting] = useState<string>('')
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showTriggerPanel, setShowTriggerPanel] = useState(false)

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (platformFilter !== 'all') params.set('platform', platformFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/social-content?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setStats(data.stats)
        setPagination(data.pagination)
      }
    } catch (err) {
      console.error('Failed to fetch social content:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, platformFilter, search])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const extractionStatus = useExtractionStatus(() => fetchItems())

  const fetchMeetings = useCallback(async (pageOverride?: number) => {
    setMeetingsLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const page = pageOverride ?? meetingsPage
      const offset = (page - 1) * MEETINGS_PER_PAGE
      const params = new URLSearchParams({ limit: String(MEETINGS_PER_PAGE), offset: String(offset) })
      if (meetingSearch) params.set('q', meetingSearch)
      if (meetingDateFrom) params.set('from', meetingDateFrom)
      if (meetingDateTo) params.set('to', meetingDateTo)
      const res = await fetch(`/api/admin/social-content/trigger?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.meetings ?? [])
        setMeetingsTotal(data.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
    } finally {
      setMeetingsLoading(false)
    }
  }, [meetingSearch, meetingDateFrom, meetingDateTo, meetingsPage])

  useEffect(() => {
    if (showTriggerPanel) fetchMeetings()
  }, [showTriggerPanel, fetchMeetings])

  // Debounced meeting search — reset to page 1 on filter change
  useEffect(() => {
    if (!showTriggerPanel) return
    const timer = setTimeout(() => { setMeetingsPage(1); fetchMeetings(1) }, 350)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingSearch, meetingDateFrom, meetingDateTo])

  const handleTriggerExtraction = async () => {
    setTriggerLoading(true)
    setTriggerResult(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const body: Record<string, string> = {}
      if (selectedMeeting) body.meeting_record_id = selectedMeeting
      const res = await fetch('/api/admin/social-content/trigger', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setTriggerResult({
        success: data.success ?? false,
        message: data.message ?? (res.ok ? 'Extraction triggered' : 'Failed to trigger extraction'),
      })
      if (data.success) {
        extractionStatus.onTriggerStarted(data.run_id)
      }
    } catch {
      setTriggerResult({ success: false, message: 'Network error — could not reach the server.' })
    } finally {
      setTriggerLoading(false)
    }
  }

  const handleQuickApprove = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setActionLoading(itemId)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/social-content/${itemId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        fetchItems(pagination.page)
      }
    } catch (err) {
      console.error('Failed to approve:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleQuickReject = async (e: React.MouseEvent, itemId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setActionLoading(itemId)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(`/api/admin/social-content/${itemId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected' }),
      })
      if (res.ok) {
        fetchItems(pagination.page)
      }
    } catch (err) {
      console.error('Failed to reject:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const platformIcon = (platform: string) => {
    if (platform === 'linkedin') return <Linkedin className="w-4 h-4 text-blue-400" />
    return <Share2 className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Social Content' }]} />

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center">
          <Share2 className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Social Content Queue</h1>
          <p className="text-gray-400 text-sm">AI-generated posts from meeting transcripts — review, edit, and publish</p>
        </div>
      </div>

      {/* Extraction Trigger */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTriggerPanel((p) => !p)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-500 hover:to-orange-500 transition-all"
          >
            <Zap className="w-4 h-4" />
            Run Extraction
          </button>
          <ExtractionStatusChip
            state={extractionStatus.state}
            currentRun={extractionStatus.currentRun}
            recentRuns={extractionStatus.recentRuns}
            elapsedMs={extractionStatus.elapsedMs}
            isDrawerOpen={extractionStatus.isDrawerOpen}
            isHistoryOpen={extractionStatus.isHistoryOpen}
            toggleDrawer={extractionStatus.toggleDrawer}
            toggleHistory={extractionStatus.toggleHistory}
            markRunFailed={extractionStatus.markRunFailed}
            onRetry={handleTriggerExtraction}
          />
        </div>

        {showTriggerPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-200">Trigger Content Extraction (WF-SOC-001)</h3>
              <span
                className="text-gray-600 hover:text-gray-400 transition-colors cursor-help"
                title="Runs WF-SOC-001 to extract social content from meeting transcripts. Select a specific meeting or extract from all recent."
              >
                <Info className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Search & Date Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-500 mb-1">Search meetings</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={meetingSearch}
                    onChange={(e) => setMeetingSearch(e.target.value)}
                    placeholder="Type, transcript, topic..."
                    className="w-full bg-gray-800 text-gray-300 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-amber-600 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <input
                  type="date"
                  value={meetingDateFrom}
                  onChange={(e) => setMeetingDateFrom(e.target.value)}
                  className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-2 py-2 text-sm w-32 focus:outline-none focus:border-amber-600"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="date"
                  value={meetingDateTo}
                  onChange={(e) => setMeetingDateTo(e.target.value)}
                  className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-2 py-2 text-sm w-32 focus:outline-none focus:border-amber-600"
                />
                {(meetingDateFrom || meetingDateTo) && (
                  <button onClick={() => { setMeetingDateFrom(''); setMeetingDateTo('') }} className="text-xs text-gray-400 hover:text-white">Clear</button>
                )}
              </div>
            </div>

            {/* Meeting List */}
            {meetingsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading meetings...
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500">
                No meetings found.{(meetingSearch || meetingDateFrom) && ' Try adjusting your filters.'}
              </div>
            ) : (
              <>
                {/* Selection header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedMeeting ? (
                      <button
                        onClick={() => setSelectedMeeting('')}
                        className="text-xs px-2 py-1 rounded border border-amber-600/40 text-amber-500 bg-amber-600/10"
                      >
                        Clear selection
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Click a meeting to select it, or extract all recent</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{meetingsTotal} meeting{meetingsTotal !== 1 ? 's' : ''}</span>
                </div>

                {/* Meeting rows */}
                <div className="space-y-1.5">
                  {meetings.map((m) => {
                    const isSelected = selectedMeeting === m.id
                    const date = m.meeting_date ? new Date(m.meeting_date) : null
                    const title = m.meeting_title || m.meeting_type.replace(/_/g, ' ')
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMeeting(isSelected ? '' : m.id)}
                        className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-amber-600/40 bg-amber-600/5'
                            : 'border-gray-800 bg-gray-800/50 hover:bg-gray-800'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-200 font-medium truncate">{title}</span>
                            {m.meeting_type && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-medium">
                                {m.meeting_type.replace(/_/g, ' ')}
                              </span>
                            )}
                            {date && (
                              <span className="text-xs text-gray-500">
                                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {m.duration_minutes && (
                              <span className="text-xs text-gray-500">{m.duration_minutes}m</span>
                            )}
                          </div>
                          {m.snippet && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate">{m.snippet}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.has_transcript && (
                            <span className="text-[9px] px-1 py-0.5 bg-emerald-500/15 text-emerald-400 rounded">Transcript</span>
                          )}
                          {m.queued_count > 0 && (
                            <span className="text-[9px] px-1 py-0.5 bg-blue-500/15 text-blue-400 rounded">
                              {m.queued_count} post{m.queued_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Pagination */}
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(meetingsTotal / MEETINGS_PER_PAGE))
                  if (totalPages <= 1) return null
                  return (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-gray-500">Page {meetingsPage} of {totalPages}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setMeetingsPage((p) => Math.max(1, p - 1))}
                          disabled={meetingsPage === 1}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:border-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-3 h-3" /> Prev
                        </button>
                        <button
                          onClick={() => setMeetingsPage((p) => Math.min(totalPages, p + 1))}
                          disabled={meetingsPage === totalPages}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:border-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
              {extractionStatus.state === 'running' || extractionStatus.state === 'stale' ? (
                <button
                  onClick={() => {
                    if (extractionStatus.currentRun) {
                      extractionStatus.markRunFailed(extractionStatus.currentRun.id, 'Cancelled by user')
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  Cancel Extraction
                </button>
              ) : (
                <button
                  onClick={handleTriggerExtraction}
                  disabled={triggerLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {triggerLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {triggerLoading
                    ? 'Triggering...'
                    : selectedMeeting
                      ? 'Extract from Selected Meeting'
                      : 'Extract All Recent Meetings'
                  }
                </button>
              )}
              {selectedMeeting && (() => {
                const m = meetings.find((mt) => mt.id === selectedMeeting)
                if (!m) return null
                const title = m.meeting_title || m.meeting_type.replace(/_/g, ' ')
                return (
                  <span className="text-xs text-amber-500 truncate max-w-[300px]">
                    Selected: {title}
                  </span>
                )
              })()}
            </div>

            {triggerResult && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                triggerResult.success
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}>
                {triggerResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {triggerResult.message}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Drafts', value: stats.draft, color: 'text-gray-400' },
          { label: 'Approved', value: stats.approved, color: 'text-blue-400' },
          { label: 'Scheduled', value: stats.scheduled, color: 'text-amber-400' },
          { label: 'Published', value: stats.published, color: 'text-green-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'all')}
          className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="all">All Statuses</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as SocialPlatform | 'all')}
          className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No social content yet.</p>
          <p className="text-sm mt-1">Content will appear here when the extraction workflow runs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={`/admin/social-content/${item.id}`}
                  className="block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Image thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                      {item.image_url ? (
                        <Image src={item.image_url} alt="" className="object-cover" fill sizes="64px" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {platformIcon(item.platform)}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusCfg.bgColor} ${statusCfg.color} border ${statusCfg.borderColor}`}>
                          {statusCfg.label}
                        </span>
                        {item.framework_visual_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/50">
                            {item.framework_visual_type}
                          </span>
                        )}
                        {item.voiceover_url && (
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">
                        {truncateForPreview(item.post_text, 200)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        {item.meeting_title && (
                          <span className="flex items-center gap-1 text-blue-400/70 truncate max-w-[250px]">
                            <FileText className="w-3 h-3 flex-shrink-0" />
                            {item.meeting_title}
                          </span>
                        )}
                        {item.hashtags?.length > 0 && (
                          <span className="text-amber-500/70 truncate max-w-[200px]">
                            {formatHashtags(item.hashtags.slice(0, 3))}
                          </span>
                        )}
                        {item.scheduled_for && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Scheduled: {new Date(item.scheduled_for).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-1" onClick={(e) => e.stopPropagation()}>
                      {(item.status === 'draft' || item.status === 'rejected') && (
                        <>
                          <button
                            onClick={(e) => handleQuickApprove(e, item.id)}
                            disabled={actionLoading === item.id}
                            title="Approve"
                            className="p-1.5 rounded-lg bg-green-900/30 hover:bg-green-900/60 text-green-400 border border-green-800/50 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === item.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ThumbsUp className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={(e) => handleQuickReject(e, item.id)}
                            disabled={actionLoading === item.id}
                            title="Reject"
                            className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-800/50 transition-colors disabled:opacity-50"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <Eye className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => fetchItems(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchItems(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SocialContentPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SocialContentQueuePage />
    </ProtectedRoute>
  )
}
