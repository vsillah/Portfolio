'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Share2,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Image as ImageIcon,
  Volume2,
  Linkedin,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
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

function SocialContentQueuePage() {
  const [items, setItems] = useState<SocialContentItem[]>([])
  const [stats, setStats] = useState<Stats>({ draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all')
  const [search, setSearch] = useState('')

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
        <div>
          <h1 className="text-2xl font-bold">Social Content Queue</h1>
          <p className="text-gray-400 text-sm">AI-generated posts from meeting transcripts — review, edit, and publish</p>
        </div>
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
                    <div className="w-16 h-16 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
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
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
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

                    {/* Quick action */}
                    <Eye className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" />
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
