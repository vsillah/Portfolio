'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { SessionCard, FilterSidebar } from '@/components/admin/chat-eval'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { MessageCircle, TrendingUp, CheckCircle, FileText, CheckSquare, X, Sparkles, Loader2, Bug } from 'lucide-react'

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
  const handleDiagnoseErrors = async () => {
    if (selectedWithBadRatings.length === 0) {
      setDiagnoseError('No selected sessions have bad ratings')
      return
    }

    setIsDiagnosing(true)
    setDiagnoseError(null)

    try {
      const session = await getCurrentSession()
      const response = await fetch('/api/admin/chat-eval/diagnose/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          session_ids: selectedWithBadRatings.map(s => s.session_id),
          provider: 'anthropic',
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to diagnose errors')
      }

      const data = await response.json()
      
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
            />
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
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
            onClick={() => router.push('/admin/chat-eval/axial-codes')}
            className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl
              hover:border-radiant-gold/30 transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-purple-400" />
              <h3 className="font-heading text-lg">Axial Codes</h3>
            </div>
            <p className="text-sm text-platinum-white/60">Review generated categories</p>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/admin/chat-eval/diagnoses')}
            className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl
              hover:border-radiant-gold/30 transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <Bug size={18} className="text-red-400" />
              <h3 className="font-heading text-lg">Error Diagnoses</h3>
            </div>
            <p className="text-sm text-platinum-white/60">AI-powered root cause analysis</p>
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

        {/* Floating Action Bar - appears when sessions are selected */}
        <AnimatePresence>
          {selectedSessions.size > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="flex items-center gap-4 px-6 py-4 bg-imperial-navy/95 backdrop-blur-lg border border-radiant-gold/30 rounded-2xl shadow-2xl">
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

                {/* Divider */}
                <div className="w-px h-10 bg-platinum-white/20" />

                {/* Generate Axial Codes button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGenerateAxialCodes}
                  disabled={selectedWithOpenCodes.length === 0 || isGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 
                    disabled:bg-purple-600/50 disabled:cursor-not-allowed
                    rounded-lg text-white font-medium transition-colors"
                >
                  {isGenerating ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Axial Codes'}
                </motion.button>

                {/* Diagnose Errors button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDiagnoseErrors}
                  disabled={selectedWithBadRatings.length === 0 || isDiagnosing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 
                    disabled:bg-red-600/50 disabled:cursor-not-allowed
                    rounded-lg text-white font-medium transition-colors"
                >
                  {isDiagnosing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Bug size={18} />
                  )}
                  {isDiagnosing ? 'Diagnosing...' : `Diagnose Errors (${selectedWithBadRatings.length})`}
                </motion.button>

                {/* Error messages */}
                {generateError && (
                  <div className="text-red-400 text-sm max-w-48">
                    {generateError}
                  </div>
                )}
                {diagnoseError && (
                  <div className="text-red-400 text-sm max-w-48">
                    {diagnoseError}
                  </div>
                )}

                {/* Clear selection */}
                <button
                  onClick={clearSelection}
                  className="p-2 hover:bg-platinum-white/10 rounded-lg transition-colors"
                >
                  <X size={18} className="text-platinum-white/60" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
