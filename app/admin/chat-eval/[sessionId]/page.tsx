'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { 
  MessageThread, 
  RatingPanel, 
  VoiceSessionMeta 
} from '@/components/admin/chat-eval'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { 
  ArrowLeft, 
  Mic, 
  MessageCircle, 
  AlertTriangle, 
  Bot, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react'

interface AvailableModel {
  id: string
  name: string
  description: string
}

interface AvailableModels {
  anthropic: AvailableModel[]
  openai: AvailableModel[]
}

interface SessionData {
  id: string
  session_id: string
  visitor_name?: string
  visitor_email?: string
  is_escalated?: boolean
  created_at: string
  updated_at: string
  channel: 'text' | 'voice'
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'support'
    content: string
    timestamp: string
    metadata?: any
  }>
  metrics: {
    message_count: number
    user_message_count: number
    assistant_message_count: number
    tool_call_count: number
    avg_latency_ms: number | null
  }
  voice_data?: {
    vapi_call_id?: string
    recording_url?: string
    duration_seconds?: number
    started_at?: string
    ended_at?: string
    ended_reason?: string
    summary?: string
    full_transcript?: string
  }
  evaluation?: {
    id: string
    rating?: 'good' | 'bad'
    notes?: string
    tags?: string[]
    category_id?: string
    open_code?: string
    evaluation_categories?: {
      id: string
      name: string
      color: string
    }
  }
  llm_evaluations: Array<{
    id: string
    rating: 'good' | 'bad'
    reasoning: string
    confidence_score: number
    model_used: string
    human_alignment?: boolean
  }>
}

interface Category {
  id: string
  name: string
  color: string
}

export default function SessionDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SessionDetailContent />
    </ProtectedRoute>
  )
}

function SessionDetailContent() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const { user } = useAuth()
  
  const [session, setSession] = useState<SessionData | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showMetadata, setShowMetadata] = useState(false)
  const [isRunningLLMJudge, setIsRunningLLMJudge] = useState(false)
  
  // Model selection state
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-20250514')

  const fetchSession = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      
      const response = await fetch(`/api/admin/chat-eval/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSession(data)
      }
    } catch (error) {
      console.error('Error fetching session:', error)
    } finally {
      setLoading(false)
    }
  }, [sessionId, user])

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

  const fetchAvailableModels = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      
      const response = await fetch('/api/admin/llm-judge?models=true', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableModels(data.available_models)
        // Set defaults from API response
        if (data.default_config) {
          setSelectedProvider(data.default_config.provider)
          setSelectedModel(data.default_config.model)
        }
      }
    } catch (error) {
      console.error('Error fetching available models:', error)
    }
  }, [user])

  useEffect(() => {
    fetchSession()
    fetchCategories()
    fetchAvailableModels()
  }, [fetchSession, fetchCategories, fetchAvailableModels])

  const handleSaveEvaluation = async (data: {
    rating: 'good' | 'bad' | null
    notes: string
    tags: string[]
    category_id: string | null
    open_code: string | null
  }) => {
    const session = await getCurrentSession()
    
    const response = await fetch(`/api/admin/chat-eval/${sessionId}`, {
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

    // Refresh session data
    fetchSession()
  }

  const handleRunLLMJudge = async () => {
    setIsRunningLLMJudge(true)
    try {
      const session = await getCurrentSession()
      
      const response = await fetch('/api/admin/llm-judge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId,
          provider: selectedProvider,
          model: selectedModel,
        }),
      })

      if (response.ok) {
        // Refresh session data to show new LLM evaluation
        fetchSession()
      }
    } catch (error) {
      console.error('Error running LLM judge:', error)
    } finally {
      setIsRunningLLMJudge(false)
    }
  }

  // Handle provider change - update model to first available for that provider
  const handleProviderChange = (provider: 'anthropic' | 'openai') => {
    setSelectedProvider(provider)
    if (availableModels) {
      setSelectedModel(availableModels[provider][0].id)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-radiant-gold" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-imperial-navy flex items-center justify-center">
        <div className="text-platinum-white">Session not found</div>
      </div>
    )
  }

  const ChannelIcon = session.channel === 'voice' ? Mic : MessageCircle

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval', href: '/admin/chat-eval' },
          { label: session.session_id.substring(0, 12) + '...' }
        ]} />

        {/* Back button and header */}
        <div className="mb-6">
          <motion.button
            whileHover={{ x: -4 }}
            onClick={() => router.back()}
            className="flex items-center gap-2 text-platinum-white/60 hover:text-platinum-white mb-4"
          >
            <ArrowLeft size={16} />
            Back to sessions
          </motion.button>
          
          <div className="flex items-center gap-4">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${session.channel === 'voice' ? 'bg-purple-500/20' : 'bg-blue-500/20'}
            `}>
              <ChannelIcon size={20} className={session.channel === 'voice' ? 'text-purple-400' : 'text-blue-400'} />
            </div>
            <div>
              <h1 className="text-2xl font-heading tracking-wider">
                {session.visitor_name || 'Anonymous'} Session
              </h1>
              <p className="text-sm text-platinum-white/60 font-mono">
                {session.session_id}
              </p>
            </div>
            {session.is_escalated && (
              <span className="flex items-center gap-1 px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-lg text-sm text-orange-400">
                <AlertTriangle size={14} />
                Escalated
              </span>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex gap-8">
          {/* Left side: Conversation */}
          <div className="flex-1 space-y-6">
            {/* Metadata toggle */}
            <div className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="flex items-center justify-between w-full"
              >
                <h3 className="font-heading text-sm uppercase tracking-wider text-platinum-white/70">
                  AI Settings & Metadata
                </h3>
                {showMetadata ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showMetadata && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-radiant-gold/10 space-y-2 text-sm"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-platinum-white/50">Messages:</span>
                      <span className="ml-2 text-platinum-white">{session.metrics.message_count}</span>
                    </div>
                    <div>
                      <span className="text-platinum-white/50">Tool Calls:</span>
                      <span className="ml-2 text-platinum-white">{session.metrics.tool_call_count}</span>
                    </div>
                    <div>
                      <span className="text-platinum-white/50">Avg Latency:</span>
                      <span className="ml-2 text-platinum-white">
                        {session.metrics.avg_latency_ms ? `${session.metrics.avg_latency_ms}ms` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-platinum-white/50">Created:</span>
                      <span className="ml-2 text-platinum-white">
                        {new Date(session.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {session.visitor_email && (
                    <div>
                      <span className="text-platinum-white/50">Email:</span>
                      <span className="ml-2 text-platinum-white">{session.visitor_email}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Voice data (if voice session) */}
            {session.channel === 'voice' && session.voice_data && (
              <VoiceSessionMeta voiceData={session.voice_data} />
            )}

            {/* Conversation thread */}
            <div className="p-4 bg-silicon-slate/10 border border-radiant-gold/10 rounded-xl">
              <h3 className="font-heading text-sm uppercase tracking-wider text-platinum-white/70 mb-4">
                Conversation
              </h3>
              <MessageThread messages={session.messages} showMetadata={true} />
            </div>

            {/* LLM Judge evaluations */}
            {session.llm_evaluations.length > 0 && (
              <div className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
                <h3 className="font-heading text-sm uppercase tracking-wider text-platinum-white/70 mb-4 flex items-center gap-2">
                  <Bot size={16} className="text-radiant-gold" />
                  LLM Judge Evaluations
                </h3>
                <div className="space-y-3">
                  {session.llm_evaluations.map((eval_) => (
                    <div 
                      key={eval_.id}
                      className={`p-3 rounded-lg border ${
                        eval_.rating === 'good' 
                          ? 'bg-emerald-500/10 border-emerald-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-heading text-sm uppercase ${
                          eval_.rating === 'good' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {eval_.rating}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-platinum-white/50">
                          <span>{eval_.model_used}</span>
                          <span>•</span>
                          <span>Confidence: {Math.round(eval_.confidence_score * 100)}%</span>
                          {eval_.human_alignment !== null && (
                            <>
                              <span>•</span>
                              <span className={eval_.human_alignment ? 'text-emerald-400' : 'text-red-400'}>
                                {eval_.human_alignment ? 'Aligned' : 'Misaligned'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-platinum-white/70">{eval_.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right side: Rating panel */}
          <div className="w-80 flex-shrink-0 space-y-4">
            <RatingPanel
              sessionId={sessionId}
              currentRating={session.evaluation?.rating}
              currentNotes={session.evaluation?.notes}
              currentTags={session.evaluation?.tags}
              currentCategoryId={session.evaluation?.category_id}
              currentOpenCode={session.evaluation?.open_code}
              categories={categories}
              onSave={handleSaveEvaluation}
            />

            {/* LLM Judge Section */}
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="font-heading text-sm uppercase tracking-wider text-purple-400">
                  LLM-as-Judge
                </h3>
              </div>
              
              {/* Provider Selection */}
              <div>
                <label className="text-xs text-platinum-white/50 mb-1 block">Provider</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleProviderChange('anthropic')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                      selectedProvider === 'anthropic'
                        ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                        : 'bg-silicon-slate/30 border border-transparent text-platinum-white/60 hover:border-purple-500/30'
                    }`}
                  >
                    Claude
                  </button>
                  <button
                    onClick={() => handleProviderChange('openai')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                      selectedProvider === 'openai'
                        ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-300'
                        : 'bg-silicon-slate/30 border border-transparent text-platinum-white/60 hover:border-emerald-500/30'
                    }`}
                  >
                    OpenAI
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-xs text-platinum-white/50 mb-1 block">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 bg-silicon-slate/30 border border-radiant-gold/10 rounded-lg
                    text-sm text-platinum-white focus:outline-none focus:border-purple-500/30"
                >
                  {availableModels?.[selectedProvider]?.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                {availableModels?.[selectedProvider]?.find(m => m.id === selectedModel) && (
                  <p className="text-xs text-platinum-white/40 mt-1">
                    {availableModels[selectedProvider].find(m => m.id === selectedModel)?.description}
                  </p>
                )}
              </div>

              {/* Run Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRunLLMJudge}
                disabled={isRunningLLMJudge}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg
                  font-heading text-sm uppercase tracking-wider transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${selectedProvider === 'anthropic' 
                    ? 'bg-purple-500 text-white hover:bg-purple-600' 
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
              >
                {isRunningLLMJudge ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Bot size={16} />
                )}
                {isRunningLLMJudge ? 'Evaluating...' : 'Run Evaluation'}
              </motion.button>
              
              <p className="text-xs text-platinum-white/40 text-center">
                A/B test different models to compare with human ratings
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
