'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { SessionCard, FilterSidebar } from '@/components/admin/chat-eval'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { MessageCircle, TrendingUp, CheckCircle } from 'lucide-react'

interface Session {
  id: string
  session_id: string
  visitor_name?: string
  visitor_email?: string
  is_escalated?: boolean
  created_at: string
  updated_at: string
  channel: 'text' | 'voice'
  message_count: number
  call_duration_seconds?: number
  evaluation?: {
    rating?: 'good' | 'bad'
    category_name?: string
    category_color?: string
  } | null
}

interface Stats {
  total_sessions: number
  evaluated_sessions: number
  success_rate: number
  good_count: number
  bad_count: number
}

export default function ChatEvalPage() {
  return (
    <ProtectedRoute requireAdmin>
      <ChatEvalContent />
    </ProtectedRoute>
  )
}

function ChatEvalContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [selectedRating, setSelectedRating] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      
      if (selectedChannel) params.set('channel', selectedChannel)
      if (selectedRating === 'good' || selectedRating === 'bad') {
        params.set('rating', selectedRating)
      } else if (selectedRating === 'annotated') {
        params.set('annotated', 'true')
      } else if (selectedRating === 'unannotated') {
        params.set('annotated', 'false')
      }

      const response = await fetch(`/api/admin/chat-eval?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }, [user, page, selectedChannel, selectedRating])

  const fetchStats = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      
      const response = await fetch('/api/admin/chat-eval/stats?days=30', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.overview)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [user])

  useEffect(() => {
    fetchSessions()
    fetchStats()
  }, [fetchSessions, fetchStats])

  const handleReset = () => {
    setSelectedChannel(null)
    setSelectedRating(null)
    setPage(1)
  }

  const handleSessionClick = (sessionId: string) => {
    router.push(`/admin/chat-eval/${sessionId}`)
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-heading tracking-wider mb-2">LLM Grader</h1>
              <p className="text-platinum-white/60">Evaluate and annotate chat conversations</p>
            </div>
            
            {/* Stats badges */}
            {stats && (
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <span className="text-sm text-emerald-400">
                      Success Rate: {stats.success_rate}%
                    </span>
                  </div>
                </div>
                <div className="px-4 py-2 bg-silicon-slate/30 border border-radiant-gold/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageCircle size={16} className="text-radiant-gold" />
                    <span className="text-sm text-platinum-white">
                      Total Runs: {stats.total_sessions}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex gap-8">
          {/* Sessions list */}
          <div className="flex-1">
            {/* Select All */}
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 text-sm text-platinum-white/70 cursor-pointer">
                <input type="checkbox" className="rounded" />
                Select All
              </label>
              
              {/* Pagination info */}
              <span className="text-sm text-platinum-white/50">
                Page {page} of {totalPages}
              </span>
            </div>

            {/* Sessions */}
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-platinum-white/50">
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-platinum-white/50">
                  No sessions found. Try adjusting your filters.
                </div>
              ) : (
                sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => handleSessionClick(session.session_id)}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg
                    text-sm disabled:opacity-50 disabled:cursor-not-allowed
                    hover:border-radiant-gold/30"
                >
                  Previous
                </motion.button>
                <span className="px-4 py-2 text-sm text-platinum-white/50">
                  {page} / {totalPages}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg
                    text-sm disabled:opacity-50 disabled:cursor-not-allowed
                    hover:border-radiant-gold/30"
                >
                  Next
                </motion.button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 flex-shrink-0">
            <FilterSidebar
              selectedChannel={selectedChannel}
              selectedRating={selectedRating}
              onChannelChange={setSelectedChannel}
              onRatingChange={setSelectedRating}
              onReset={handleReset}
              onAddToQueue={() => router.push('/admin/chat-eval/queue')}
              stats={stats ? {
                total_sessions: stats.total_sessions,
                success_rate: stats.success_rate,
              } : undefined}
            />
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/admin/chat-eval/queues')}
            className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl
              hover:border-radiant-gold/30 transition-all text-left"
          >
            <h3 className="font-heading text-lg mb-1">Annotation Queues</h3>
            <p className="text-sm text-platinum-white/60">View sessions by channel type</p>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/admin/chat-eval/alignment')}
            className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl
              hover:border-radiant-gold/30 transition-all text-left"
          >
            <h3 className="font-heading text-lg mb-1">LLM Alignment</h3>
            <p className="text-sm text-platinum-white/60">Human vs LLM judge comparison</p>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/admin/chat-eval/queue')}
            className="p-4 bg-radiant-gold/10 border border-radiant-gold/30 rounded-xl
              hover:bg-radiant-gold/20 transition-all text-left"
          >
            <h3 className="font-heading text-lg text-radiant-gold mb-1">Start Annotating</h3>
            <p className="text-sm text-platinum-white/60">Jump into the annotation queue</p>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
