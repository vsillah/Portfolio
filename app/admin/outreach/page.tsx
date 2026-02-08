'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import Link from 'next/link'

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

export default function OutreachAdminPage() {
  return (
    <ProtectedRoute requireAdmin>
      <OutreachContent />
    </ProtectedRoute>
  )
}

function OutreachContent() {
  const [items, setItems] = useState<OutreachItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('draft')
  const [channelFilter, setChannelFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const params = new URLSearchParams({
        status: statusFilter,
        channel: channelFilter,
        ...(search && { search }),
      })

      const response = await fetch(`/api/admin/outreach?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setItems(data.items)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch outreach data:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, channelFilter, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const getScoreBadgeColor = (score: number | null) => {
    if (!score) return 'bg-gray-700 text-gray-300'
    if (score >= 70) return 'bg-green-900/50 text-green-400 border border-green-700'
    if (score >= 40) return 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
    return 'bg-red-900/50 text-red-400 border border-red-700'
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-blue-900/50 text-blue-400 border border-blue-700',
      approved: 'bg-green-900/50 text-green-400 border border-green-700',
      sent: 'bg-purple-900/50 text-purple-400 border border-purple-700',
      replied: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700',
      bounced: 'bg-red-900/50 text-red-400 border border-red-700',
      cancelled: 'bg-gray-800 text-gray-400 border border-gray-600',
      rejected: 'bg-red-900/50 text-red-400 border border-red-700',
    }
    return colors[status] || 'bg-gray-800 text-gray-400'
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Outreach Review' },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Outreach Review
            </h1>
            <p className="text-gray-400 mt-1">
              Review and approve AI-generated outreach messages before sending
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/outreach/dashboard">
              <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-purple-600 border border-orange-500/50 rounded-lg hover:from-orange-700 hover:to-purple-700 transition-colors">
                <BarChart3 size={16} />
                Dashboard & Triggers
              </button>
            </Link>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

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
                      ? 'bg-white/10 border-blue-500'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-gray-400 capitalize">{key}</div>
                </button>
              ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Channels</option>
              <option value="email">Email Only</option>
              <option value="linkedin">LinkedIn Only</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && statusFilter === 'draft' && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-400">
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
            <span className="text-sm text-gray-400">Select all</span>
          </div>
        )}

        {/* Items List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-gray-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
            <h3 className="text-xl font-medium text-gray-400">
              No {statusFilter} messages
            </h3>
            <p className="text-gray-500 mt-2">
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
                  className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
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
                          ? 'bg-blue-900/30 text-blue-400'
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
                        <span className="text-xs text-gray-500">
                          Step {item.sequence_step}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
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
                        <p className="mt-2 text-sm text-gray-300">
                          <span className="text-gray-500">Subject:</span>{' '}
                          {item.subject}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {item.status === 'draft' && (
                        <>
                          <button
                            onClick={() => startEditing(item)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
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
                          className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <Send size={14} />
                          Send Now
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === item.id ? null : item.id)
                        }
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400"
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
                        className="border-t border-white/10"
                      >
                        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Message Preview */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1">
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
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Subject"
                                  />
                                )}
                                <textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  rows={8}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-y"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEdit(item.id)}
                                    disabled={actionLoading}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                  >
                                    Save Changes
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-black/50 rounded-lg p-4 text-sm whitespace-pre-wrap text-gray-300 max-h-64 overflow-y-auto">
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
                            <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1">
                              <Star size={14} />
                              Lead Research Brief
                            </h4>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-black/50 rounded-lg p-3">
                                  <div className="text-gray-500 text-xs">Lead Score</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.lead_score || 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-black/50 rounded-lg p-3">
                                  <div className="text-gray-500 text-xs">AI Readiness</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.ai_readiness_score || 'N/A'}/10
                                  </div>
                                </div>
                                <div className="bg-black/50 rounded-lg p-3">
                                  <div className="text-gray-500 text-xs">Competitive Pressure</div>
                                  <div className="text-lg font-bold">
                                    {item.contact_submissions?.competitive_pressure_score || 'N/A'}/10
                                  </div>
                                </div>
                                <div className="bg-black/50 rounded-lg p-3">
                                  <div className="text-gray-500 text-xs">Source</div>
                                  <div className="text-sm font-medium">
                                    {item.contact_submissions?.lead_source || 'N/A'}
                                  </div>
                                </div>
                              </div>

                              {item.contact_submissions?.quick_wins && (
                                <div className="bg-black/50 rounded-lg p-3">
                                  <div className="text-gray-500 text-xs mb-1">Quick Wins</div>
                                  <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
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
                            <div className="mt-4 text-xs text-gray-600 space-y-1">
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
      </div>
    </div>
  )
}
