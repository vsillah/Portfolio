'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { 
  MessageThread, 
  RatingPanel, 
  VoiceSessionMeta,
  SessionCard
} from '@/components/admin/chat-eval'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { 
  Filter,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface Session {
  id: string
  session_id: string
  visitor_name?: string
  visitor_email?: string
  is_escalated?: boolean
  created_at: string
  channel: 'text' | 'voice'
  message_count: number
  evaluation?: {
    rating?: 'good' | 'bad'
  } | null
}

interface SessionDetail {
  session_id: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'support'
    content: string
    timestamp: string
    metadata?: any
  }>
  voice_data?: any
  evaluation?: {
    rating?: 'good' | 'bad'
    notes?: string
    tags?: string[]
    category_id?: string
    open_code?: string
  }
}

interface Category {
  id: string
  name: string
  color: string
}

export default function AnnotationQueuePage() {
  return (
    <ProtectedRoute requireAdmin>
      <AnnotationQueueContent />
    </ProtectedRoute>
  )
}

function AnnotationQueueContent() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showUnannotated, setShowUnannotated] = useState(true)
  const [showMetadata, setShowMetadata] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      
      const params = new URLSearchParams({
        limit: '50',
      })
      
      if (showUnannotated) {
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
        if (data.sessions.length > 0 && selectedIndex === 0) {
          fetchSessionDetail(data.sessions[0].session_id)
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }, [user, showUnannotated])

  const fetchSessionDetail = async (sessionId: string) => {
    setLoadingDetail(true)
    try {
      const session = await getCurrentSession()
      
      const response = await fetch(`/api/admin/chat-eval/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentSession(data)
      }
    } catch (error) {
      console.error('Error fetching session detail:', error)
    } finally {
      setLoadingDetail(false)
    }
  }

  const fetchCategories = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      
      const response = await fetch('/api/admin/chat-eval/categories', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [user])

  useEffect(() => {
    fetchSessions()
    fetchCategories()
  }, [fetchSessions, fetchCategories])

  const handleSessionSelect = (index: number) => {
    setSelectedIndex(index)
    if (sessions[index]) {
      fetchSessionDetail(sessions[index].session_id)
    }
  }

  const handleSaveEvaluation = async (data: {
    rating: 'good' | 'bad' | null
    notes: string
    tags: string[]
    category_id: string | null
    open_code: string | null
  }) => {
    if (!currentSession) return

    const session = await getCurrentSession()
    
    const response = await fetch(`/api/admin/chat-eval/${currentSession.session_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to save evaluation')
    }

    // Update local state
    setSessions(prev => prev.map((s, i) => 
      i === selectedIndex 
        ? { ...s, evaluation: { rating: data.rating || undefined } }
        : s
    ))
    
    // Refresh current session
    fetchSessionDetail(currentSession.session_id)
  }

  const handleNavigate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? Math.max(0, selectedIndex - 1)
      : Math.min(sessions.length - 1, selectedIndex + 1)
    handleSessionSelect(newIndex)
  }

  const unannotatedCount = sessions.filter(s => !s.evaluation?.rating).length

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white">
      <div className="flex h-screen">
        {/* Left panel: Session list */}
        <div className="w-80 flex-shrink-0 border-r border-radiant-gold/10 flex flex-col">
          <div className="p-4 border-b border-radiant-gold/10">
            <Breadcrumbs items={[
              { label: 'Chat Eval', href: '/admin/chat-eval' },
              { label: 'Queue' }
            ]} />
            
            <div className="flex items-center justify-between mt-4">
              <h2 className="font-heading text-lg">
                {showUnannotated ? 'Unannotated' : 'All'} Sessions
                <span className="ml-2 px-2 py-0.5 bg-radiant-gold/20 rounded text-sm text-radiant-gold">
                  {sessions.length}
                </span>
              </h2>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowUnannotated(!showUnannotated)}
              className={`
                mt-2 px-3 py-1.5 rounded-lg text-sm border transition-colors
                ${showUnannotated 
                  ? 'bg-radiant-gold/10 border-radiant-gold/30 text-radiant-gold' 
                  : 'bg-silicon-slate/20 border-radiant-gold/10 text-platinum-white/70'
                }
              `}
            >
              <Filter size={14} className="inline mr-1" />
              Show Unannotated
            </motion.button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-radiant-gold" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-platinum-white/50 text-sm">
                No sessions to annotate
              </div>
            ) : (
              sessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSessionSelect(index)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-all border
                    ${index === selectedIndex 
                      ? 'bg-radiant-gold/10 border-radiant-gold/40' 
                      : 'bg-silicon-slate/10 border-transparent hover:border-radiant-gold/20'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-platinum-white/70 truncate">
                      {session.session_id.substring(0, 20)}...
                    </span>
                    {session.evaluation?.rating === 'good' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
                    )}
                    {session.evaluation?.rating === 'bad' && (
                      <span className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">✕</span>
                    )}
                  </div>
                  <div className="text-xs text-platinum-white/50 mt-1">
                    {new Date(session.created_at).toLocaleDateString()}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Center panel: Conversation detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-radiant-gold" />
            </div>
          ) : currentSession ? (
            <div className="space-y-4">
              {/* Metadata toggle */}
              <div className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="flex items-center justify-between w-full"
                >
                  <span className="font-heading text-sm uppercase tracking-wider text-platinum-white/70">
                    AI Settings & Metadata
                  </span>
                  {showMetadata ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showMetadata && (
                  <div className="mt-3 pt-3 border-t border-radiant-gold/10 text-sm text-platinum-white/60">
                    Session ID: {currentSession.session_id}
                  </div>
                )}
              </div>

              {/* Voice data */}
              {currentSession.voice_data && (
                <VoiceSessionMeta voiceData={currentSession.voice_data} />
              )}

              {/* Messages */}
              <div className="p-4 bg-silicon-slate/10 border border-radiant-gold/10 rounded-xl">
                <MessageThread messages={currentSession.messages} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-platinum-white/50">
              Select a session to view
            </div>
          )}
        </div>

        {/* Right panel: Rating */}
        <div className="w-80 flex-shrink-0 border-l border-radiant-gold/10 p-4 overflow-y-auto">
          {currentSession && (
            <RatingPanel
              sessionId={currentSession.session_id}
              currentRating={currentSession.evaluation?.rating}
              currentNotes={currentSession.evaluation?.notes}
              currentTags={currentSession.evaluation?.tags}
              currentCategoryId={currentSession.evaluation?.category_id}
              currentOpenCode={currentSession.evaluation?.open_code}
              categories={categories}
              onSave={handleSaveEvaluation}
              onNavigate={handleNavigate}
              canNavigatePrev={selectedIndex > 0}
              canNavigateNext={selectedIndex < sessions.length - 1}
            />
          )}
        </div>
      </div>
    </div>
  )
}
