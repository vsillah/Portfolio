'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { SessionCard, FilterSidebar } from '@/components/admin/chat-eval'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { MessageCircle, TrendingUp, CheckCircle, FileText, CheckSquare, X, Sparkles, Loader2, Bug, Trash2 } from 'lucide-react'

interface Session {
  id: string
  session_id: string
  visitor_name?: string
  visitor_email?: string
  is_escalated?: boolean
  created_at: string
  updated_at: string
  channel: 'text' | 'voice' | 'chatbot' | 'email'
  message_count: number
  prompt_version?: number
  call_duration_seconds?: number
  evaluation?: {
    rating?: 'good' | 'bad'
    category_name?: string
    category_color?: string
    open_code?: string
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
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [filterCounts, setFilterCounts] = useState<{
    channel: { voice: number; text: number; email: number; chatbot: number }
    annotated: number
    unannotated: number
    good: number
    bad: number
  } | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '6',
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
  }, [page, selectedChannel, selectedRating])

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
  }, [])

  const fetchFilterCounts = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      const response = await fetch('/api/admin/chat-eval/counts', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setFilterCounts(data)
      }
    } catch {
      setFilterCounts(null)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    fetchStats()
    fetchFilterCounts()
  }, [fetchSessions, fetchStats, fetchFilterCounts])

  const handleReset = () => {
    setSelectedChannel(null)
    setSelectedRating(null)
    setPage(1)
  }

  const handleSessionClick = (sessionId: string) => {
    router.push(`/admin/chat-eval/${sessionId}`)
  }

  // Selection mode handlers
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    if (selectionMode) {
      setSelectedSessions(new Set())
    }
  }

  const handleSelectSession = (sessionId: string, selected: boolean) => {
    setSelectedSessions(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(sessionId)
      } else {
        next.delete(sessionId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.session_id)))
    }
  }

  const clearSelection = () => {
    setSelectedSessions(new Set())
    setSelectionMode(false)
  }

  // Get sessions with open codes from selection
  const selectedWithOpenCodes = sessions.filter(
    s => selectedSessions.has(s.session_id) && s.evaluation?.open_code
  )

  // Get sessions with bad ratings for diagnosis
  const selectedWithBadRatings = sessions.filter(
    s => selectedSessions.has(s.session_id) && s.evaluation?.rating === 'bad'
  )

  // Diagnose errors
  const handleDeleteSelected = async () => {
    if (selectedSessions.size === 0) return
    const n = selectedSessions.size
    if (!confirm(`Delete ${n} session${n === 1 ? '' : 's'}? This cannot be undone. All messages and evaluations for these sessions will be removed.`)) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const session = await getCurrentSession()
      const res = await fetch('/api/admin/chat-eval/sessions/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ session_ids: Array.from(selectedSessions) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete sessions')
        return
      }
      setSelectedSessions(new Set())
      setSelectionMode(false)
      await fetchSessions()
      await fetchFilterCounts()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDiagnoseErrors = async () => {
    if (selectedWithBadRatings.length === 0) {
      setDiagnoseError('No selected sessions have bad ratings')
      return
    }

    setIsDiagnosing(true)
    setDiagnoseError(null)

    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setDiagnoseError('Please sign in again to run diagnosis.')
        setIsDiagnosing(false)
        return
      }
      const sessionIds = selectedWithBadRatings.map(s => s.session_id)
      const response = await fetch('/api/admin/chat-eval/diagnose/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          session_ids: sessionIds,
          provider: 'anthropic',
        }),
      })

      const rawText = await response.text()
      let data: { error?: string; message?: string; detail?: string; summary?: unknown } = {}
      try {
        if (rawText) data = JSON.parse(rawText)
      } catch {
        data = { error: rawText?.slice(0, 200) || response.statusText }
      }

      if (!response.ok) {
        const msg = data?.error || data?.message || (typeof data?.detail === 'string' ? data.detail : null) || `Request failed (${response.status})`
        throw new Error(msg)
      }
      
      // Navigate to diagnoses page
      router.push('/admin/chat-eval/diagnoses')
    } catch (error) {
      setDiagnoseError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsDiagnosing(false)
    }
  }

  // Generate axial codes
  const handleGenerateAxialCodes = async () => {
    if (selectedWithOpenCodes.length === 0) {
      setGenerateError('No selected sessions have open codes')
      return
    }

    setIsGenerating(true)
    setGenerateError(null)

    try {
      const session = await getCurrentSession()
      const response = await fetch('/api/admin/chat-eval/axial-codes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          session_ids: selectedWithOpenCodes.map(s => s.session_id),
          provider: 'anthropic',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate axial codes')
      }

      const data = await response.json()
      
      // Navigate to the review page
      router.push(`/admin/chat-eval/axial-codes/${data.generation_id}`)
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
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
                      Good Rate: {stats.success_rate}%
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
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {/* Selection mode toggle */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleSelectionMode}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all
                    ${selectionMode 
                      ? 'bg-radiant-gold/20 border border-radiant-gold/50 text-radiant-gold' 
                      : 'bg-silicon-slate/30 border border-radiant-gold/10 text-platinum-white/70 hover:border-radiant-gold/30'
                    }`}
                >
                  <CheckSquare size={16} />
                  {selectionMode ? 'Exit Selection' : 'Select Sessions'}
                </motion.button>

                {/* Select All (only in selection mode) */}
                {selectionMode && (
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-platinum-white/70 hover:text-platinum-white"
                  >
                    {selectedSessions.size === sessions.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              
              {/* Pagination info */}
              <span className="text-sm text-platinum-white/50">
                Page {page} of {totalPages}
              </span>
            </div>

            {/* Inline selection action bar — in document flow, does not block list */}
            <AnimatePresence>
              {selectedSessions.size > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-4 px-4 py-3 mb-3 bg-silicon-slate/30 border border-radiant-gold/30 rounded-xl">
                    {/* Selection count */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-radiant-gold/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-radiant-gold">{selectedSessions.size}</span>
                      </div>
                      <div className="text-sm">
                        <div className="text-platinum-white">sessions selected</div>
                        <div className="text-platinum-white/50">
                          {selectedWithOpenCodes.length} with open codes
                        </div>
                      </div>
                    </div>

                    <div className="w-px h-8 bg-platinum-white/20" />

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGenerateAxialCodes}
                      disabled={selectedWithOpenCodes.length === 0 || isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 
                        disabled:bg-purple-600/50 disabled:cursor-not-allowed
                        rounded-lg text-white font-medium transition-colors text-sm"
                    >
                      {isGenerating ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Sparkles size={18} />
                      )}
                      {isGenerating ? 'Generating...' : 'Generate Axial Codes'}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDiagnoseErrors}
                      disabled={selectedWithBadRatings.length === 0 || isDiagnosing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 
                        disabled:bg-red-600/50 disabled:cursor-not-allowed
                        rounded-lg text-white font-medium transition-colors text-sm"
                    >
                      {isDiagnosing ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Bug size={18} />
                      )}
                      {isDiagnosing ? 'Diagnosing...' : `Diagnose Errors (${selectedWithBadRatings.length})`}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                      className="flex items-center gap-2 px-4 py-2 bg-platinum-white/10 hover:bg-red-600/80 
                        disabled:opacity-50 disabled:cursor-not-allowed
                        border border-platinum-white/20 rounded-lg text-platinum-white font-medium transition-colors text-sm"
                    >
                      {isDeleting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                      {isDeleting ? 'Deleting...' : `Delete ${selectedSessions.size} session${selectedSessions.size === 1 ? '' : 's'}`}
                    </motion.button>

                    {generateError && (
                      <div className="text-red-400 text-sm max-w-48">{generateError}</div>
                    )}
                    {diagnoseError && (
                      <div className="text-red-400 text-sm max-w-48">{diagnoseError}</div>
                    )}
                    {deleteError && (
                      <div className="text-red-400 text-sm max-w-48">{deleteError}</div>
                    )}

                    <button
                      onClick={clearSelection}
                      className="ml-auto p-2 hover:bg-platinum-white/10 rounded-lg transition-colors"
                      aria-label="Clear selection"
                    >
                      <X size={18} className="text-platinum-white/60" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                    selectionMode={selectionMode}
                    isSelected={selectedSessions.has(session.session_id)}
                    onSelect={(selected) => handleSelectSession(session.session_id, selected)}
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
              filterCounts={filterCounts}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
