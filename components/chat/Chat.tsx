'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Trash2, AlertCircle, ClipboardCheck, Sparkles, BookOpen, Briefcase, Mic, MessageSquare, RefreshCw, LogIn, Calendar } from 'lucide-react'
import { ChatMessage, type ChatMessageProps } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { VoiceChat } from './VoiceChat'
import { CalendlyEmbed } from './CalendlyEmbed'
import { generateSessionId, CHAT_STORAGE_KEY } from '@/lib/chat-utils'
import { isValidCalendlyUrl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { signInWithOAuth } from '@/lib/auth'
import type { DiagnosticCategory, DiagnosticProgress } from '@/lib/n8n'
import type { VoiceChatMessage } from '@/lib/vapi'
import { isVapiConfigured } from '@/lib/vapi'

type ChatMode = 'text' | 'voice'

interface AuthUser {
  id: string
  email: string
  name: string | null
}

interface Message extends ChatMessageProps {
  id: string
  isVoice?: boolean
  isRetriable?: boolean
  retriableContent?: string
  type?: 'text' | 'calendly_embed'
  calendlyUrl?: string
}

interface ChatProps {
  initialMessage?: string
  visitorEmail?: string
  visitorName?: string
}

// Diagnostic trigger phrases
const DIAGNOSTIC_TRIGGERS = [
  'audit',
  'diagnostic',
  'identify issues',
  'help me identify',
  'self-assessment',
  'business assessment',
  'analyze my',
  'evaluate my',
  'review my',
]

function detectDiagnosticIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  return DIAGNOSTIC_TRIGGERS.some(trigger => lowerMessage.includes(trigger))
}

export function Chat({ initialMessage, visitorEmail, visitorName }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDiagnosticMode, setIsDiagnosticMode] = useState(false)
  const [diagnosticAuditId, setDiagnosticAuditId] = useState<string | null>(null)
  const [diagnosticProgress, setDiagnosticProgress] = useState<DiagnosticProgress | null>(null)
  const [currentCategory, setCurrentCategory] = useState<DiagnosticCategory | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [showDiagnosticBanner, setShowDiagnosticBanner] = useState(true)
  const [chatMode, setChatMode] = useState<ChatMode>('text')
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [showLoginBanner, setShowLoginBanner] = useState(true)
  const [activeCalendlyUrl, setActiveCalendlyUrl] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasLoadedHistory = useRef(false)
  const sendingRef = useRef(false)
  
  // Check if voice chat is available
  const voiceEnabled = isVapiConfigured()

  // Detect auth state on mount and listen for changes
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setAuthUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
        })
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
        })
      } else {
        setAuthUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const effectiveEmail = authUser?.email || visitorEmail
  const effectiveName = authUser?.name || visitorName

  const handleCalendlyScheduled = useCallback(() => {
    setActiveCalendlyUrl(null)
    const confirmMsg: Message = {
      id: `calendly-confirm-${Date.now()}`,
      role: 'assistant',
      content: 'Your meeting has been booked! You should receive a confirmation email shortly.',
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, confirmMsg])

    if (effectiveEmail) {
      fetch('/api/chat/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: effectiveEmail,
          templateType: 'meeting_confirmation',
          data: { name: effectiveName || 'there' },
          sessionId,
        }),
      }).catch(() => {})
    }
  }, [effectiveEmail, effectiveName, sessionId])

  // Suggested actions/questions
  const suggestedActions = [
    {
      id: 'audit',
      label: 'Perform an AI Audit',
      icon: ClipboardCheck,
      message: 'I want to perform an AI audit',
      description: 'Self-assess your business needs',
    },
    {
      id: 'projects',
      label: 'View Projects',
      icon: Briefcase,
      message: 'Tell me about your projects',
      description: 'Explore portfolio work',
    },
    {
      id: 'services',
      label: 'Learn About Services',
      icon: Sparkles,
      message: 'What services do you offer?',
      description: 'Consulting & solutions',
    },
    {
      id: 'publications',
      label: 'See Publications',
      icon: BookOpen,
      message: 'Show me your publications',
      description: 'Books & articles',
    },
    {
      id: 'schedule',
      label: 'Schedule a Discovery Call',
      icon: Calendar,
      message: "I'd like to schedule a discovery call",
      description: 'Book a free consultation',
    },
  ]

  const handleSuggestionClick = (message: string) => {
    setShowSuggestions(false)
    sendMessage(message)
  }

  // Handle voice messages from VoiceChat component
  const handleVoiceMessage = useCallback((voiceMessage: VoiceChatMessage) => {
    setShowSuggestions(false)
    const message: Message = {
      id: voiceMessage.id,
      role: voiceMessage.role,
      content: voiceMessage.content,
      timestamp: voiceMessage.timestamp,
      isVoice: true,
    }
    setMessages(prev => [...prev, message])
  }, [])

  // Handle voice call state changes
  const handleVoiceCallStart = useCallback(() => {
    setIsVoiceCallActive(true)
    setShowSuggestions(false)
  }, [])

  const handleVoiceCallEnd = useCallback(() => {
    setIsVoiceCallActive(false)
  }, [])

  // Initialize session
  useEffect(() => {
    const storedSession = localStorage.getItem(CHAT_STORAGE_KEY)
    if (storedSession) {
      setSessionId(storedSession)
    } else {
      const newSessionId = generateSessionId()
      setSessionId(newSessionId)
      localStorage.setItem(CHAT_STORAGE_KEY, newSessionId)
    }
  }, [])

  // Load chat history (wrapped in useCallback for exhaustive-deps)
  const loadChatHistory = useCallback(async () => {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((msg: { id: string; role: string; content: string; created_at: string }) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant' | 'support',
              content: msg.content,
              timestamp: msg.created_at,
            }))
          )
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err)
    }
  }, [sessionId])

  // Load diagnostic status for current session
  const loadDiagnosticStatus = useCallback(async () => {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/chat/diagnostic?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.audit) {
          setIsDiagnosticMode(data.audit.status === 'in_progress')
          setDiagnosticAuditId(data.audit.id)
          setCurrentCategory(data.audit.current_category as DiagnosticCategory | null)
          if (data.audit.questions_asked || data.audit.responses_received) {
            setDiagnosticProgress({
              completedCategories: [], // Will be populated from audit data
              questionsAsked: data.audit.questions_asked || [],
              responsesReceived: data.audit.responses_received || {},
            })
          }
        }
      }
    } catch (err) {
      console.error('Failed to load diagnostic status:', err)
    }
  }, [sessionId])

  // Load chat history and diagnostic status when session is ready
  useEffect(() => {
    if (sessionId && !hasLoadedHistory.current) {
      hasLoadedHistory.current = true
      loadChatHistory()
      loadDiagnosticStatus()
    }
  }, [sessionId, loadChatHistory, loadDiagnosticStatus])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Add welcome message when chat is first expanded with no history
  useEffect(() => {
    if (isExpanded && messages.length === 0 && !isLoading && sessionId) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: initialMessage || "Hi! I'm here to help answer any questions about Vambah's work, projects, or services. How can I assist you today?",
        timestamp: new Date().toISOString(),
      }
      setMessages([welcomeMessage])
    }
  }, [isExpanded, messages.length, isLoading, sessionId, initialMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading || sendingRef.current) return
    sendingRef.current = true

    setError(null)

    // Detect diagnostic intent if not already in diagnostic mode
    const shouldStartDiagnostic = !isDiagnosticMode && detectDiagnosticIntent(content)
    if (shouldStartDiagnostic) {
      setIsDiagnosticMode(true)
    }

    // Hide suggestions when user sends a message
    setShowSuggestions(false)

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Add typing indicator
    const typingId = `typing-${Date.now()}`
    setMessages(prev => [...prev, {
      id: typingId,
      role: 'assistant',
      content: '',
      isTyping: true,
    }])

    try {
      const requestPayload = {
        message: content,
        sessionId,
        userId: authUser?.id || undefined,
        visitorEmail: effectiveEmail,
        visitorName: effectiveName,
        diagnosticMode: isDiagnosticMode || shouldStartDiagnostic,
        diagnosticAuditId: diagnosticAuditId || undefined,
        diagnosticProgress: diagnosticProgress || undefined,
      }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60_000)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      let rawData: unknown
      try {
        const text = await response.text()
        rawData = text ? JSON.parse(text) : {}
      } catch {
        throw new Error('Invalid response from server. Please try again.')
      }

      // Remove typing indicator
      setMessages(prev => prev.filter(m => m.id !== typingId))

      if (!response.ok) {
        throw new Error((rawData as { error?: string })?.error || 'Failed to send message')
      }

      const data = rawData as {
        response?: unknown
        sessionId?: string
        escalated?: boolean
        metadata?: { fallback?: boolean; retriable?: boolean; action?: string; calendlyUrl?: string }
        diagnosticMode?: boolean
        diagnosticAuditId?: string
        diagnosticProgress?: DiagnosticProgress
        currentCategory?: DiagnosticCategory
        diagnosticComplete?: boolean
      }

      // Update diagnostic state if in diagnostic mode
      if (data.diagnosticMode || isDiagnosticMode || shouldStartDiagnostic) {
        setIsDiagnosticMode(true)
        if (data.diagnosticAuditId && !diagnosticAuditId) {
          setDiagnosticAuditId(data.diagnosticAuditId)
        }
        if (data.diagnosticProgress) {
          setDiagnosticProgress(data.diagnosticProgress)
        }
        if (data.currentCategory) {
          setCurrentCategory(data.currentCategory)
        }
        if (data.diagnosticComplete) {
          setIsDiagnosticMode(false)
          setCurrentCategory(null)
        }
      }

      // Check for Calendly scheduling action from the AI
      const calendlyUrl = data.metadata?.calendlyUrl
      if (data.metadata?.action === 'schedule_meeting' && calendlyUrl && isValidCalendlyUrl(calendlyUrl)) {
        setActiveCalendlyUrl(calendlyUrl)
      }

      // Extract response text - handle cases where response might be an object or JSON string
      let responseText: string = ''
      const rawResponse = data.response

      if (typeof rawResponse === 'object' && rawResponse !== null) {
        const obj = rawResponse as Record<string, unknown>
        responseText = String(obj.response || obj.text || obj.message || '')
      } else if (typeof rawResponse === 'string') {
        responseText = rawResponse
        try {
          const parsed = JSON.parse(rawResponse)
          if (parsed && typeof parsed === 'object' && parsed.response) {
            responseText = parsed.response || parsed.text || parsed.message || responseText
          }
        } catch {
          // Not JSON, use as-is
        }
      } else {
        responseText = String(rawResponse || '')
      }

      // Determine if this is a fallback / retriable response
      const isFallback = !!(data.metadata?.fallback || data.metadata?.retriable)

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: data.escalated ? 'support' : 'assistant',
        content: String(responseText || ''),
        timestamp: new Date().toISOString(),
        isRetriable: isFallback,
        retriableContent: isFallback ? content : undefined,
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (err) {
      // Remove typing indicator on error
      setMessages(prev => prev.filter(m => m.id !== typingId))

      const errorMessage = err instanceof Error && err.name === 'AbortError'
        ? 'Request took too long. Please try again.'
        : (err instanceof Error ? err.message : 'Something went wrong')
      setError(errorMessage)

      // Add error message to chat with retry button
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I apologize, but I'm having trouble connecting right now. Please try again or use the contact form to reach out directly.",
        timestamp: new Date().toISOString(),
        isRetriable: true,
        retriableContent: content,
      }])
    } finally {
      sendingRef.current = false
      setIsLoading(false)
    }
  }, [sessionId, isLoading, effectiveEmail, effectiveName, authUser?.id, isDiagnosticMode, diagnosticAuditId, diagnosticProgress])

  // Retry a failed message
  const retryMessage = useCallback((messageId: string) => {
    const msg = messages.find(m => m.id === messageId)
    if (!msg?.retriableContent) return

    const content = msg.retriableContent
    // Remove the failed response message before retrying
    setMessages(prev => prev.filter(m => m.id !== messageId))
    sendMessage(content)
  }, [messages, sendMessage])

  const clearChat = async () => {
    if (!sessionId) return

    try {
      await fetch(`/api/chat/history?sessionId=${sessionId}`, {
        method: 'DELETE',
      })
      
      // Generate new session
      const newSessionId = generateSessionId()
      setSessionId(newSessionId)
      localStorage.setItem(CHAT_STORAGE_KEY, newSessionId)
      hasLoadedHistory.current = false
      
      // Reset diagnostic state
      setIsDiagnosticMode(false)
      setDiagnosticAuditId(null)
      setDiagnosticProgress(null)
      setCurrentCategory(null)
      setShowSuggestions(true)
      
      // Reset messages with welcome
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: initialMessage || "Hi! I'm here to help answer any questions about Vambah's work, projects, or services. How can I assist you today?",
        timestamp: new Date().toISOString(),
      }])
    } catch (err) {
      console.error('Failed to clear chat:', err)
    }
  }

  // Exit diagnostic mode without clearing chat
  const exitDiagnosticMode = async () => {
    try {
      // Update diagnostic audit status to 'abandoned' in database
      if (diagnosticAuditId) {
        await fetch('/api/chat/diagnostic', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auditId: diagnosticAuditId,
            status: 'abandoned',
          }),
        })
      }

      // Reset local diagnostic state
      setIsDiagnosticMode(false)
      setDiagnosticAuditId(null)
      setDiagnosticProgress(null)
      setCurrentCategory(null)
      setShowSuggestions(true)
      setShowDiagnosticBanner(true) // Reset for next time
    } catch (err) {
      console.error('Failed to exit diagnostic mode:', err)
      // Still reset local state even if API call fails
      setIsDiagnosticMode(false)
      setDiagnosticAuditId(null)
      setDiagnosticProgress(null)
      setCurrentCategory(null)
      setShowDiagnosticBanner(true) // Reset for next time
    }
  }

  return (
    <div className="w-full">
      {/* Chat Toggle Button */}
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            key="toggle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-silicon-slate/30 border border-radiant-gold/20 rounded-xl text-platinum-white hover:bg-silicon-slate/40 hover:border-radiant-gold/40 transition-all duration-300"
          >
            <MessageCircle size={20} className="text-radiant-gold" />
            <span className="font-heading text-sm tracking-wider uppercase">Chat with AI Assistant</span>
          </motion.button>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-card border border-radiant-gold/20 rounded-xl overflow-hidden"
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-radiant-gold/10 bg-silicon-slate/20">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isVoiceCallActive ? 'bg-radiant-gold' : isDiagnosticMode ? 'bg-radiant-gold' : 'bg-emerald-500'} animate-pulse`} />
                <span className="text-sm font-heading tracking-wider text-platinum-white">
                  {isDiagnosticMode ? 'AI Assessment' : isVoiceCallActive ? 'Voice Active' : 'AI Assistant'}
                </span>
                {isDiagnosticMode && (
                  <>
                    <ClipboardCheck size={14} className="text-radiant-gold" />
                    <span className="text-xs text-platinum-white/50">
                      {diagnosticProgress?.completedCategories?.length || 0}/6
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Voice/Text Mode Toggle - available even in diagnostic mode */}
                {voiceEnabled && (
                  <div className="flex items-center bg-silicon-slate/30 rounded-lg p-0.5 mr-2">
                    <motion.button
                      onClick={() => setChatMode('text')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-1.5 rounded-md transition-all duration-200 ${
                        chatMode === 'text' 
                          ? 'bg-radiant-gold/20 text-radiant-gold' 
                          : 'text-platinum-white/50 hover:text-platinum-white'
                      }`}
                      title="Text chat"
                    >
                      <MessageSquare size={14} />
                    </motion.button>
                    <motion.button
                      onClick={() => setChatMode('voice')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-1.5 rounded-md transition-all duration-200 ${
                        chatMode === 'voice' 
                          ? 'bg-radiant-gold/20 text-radiant-gold' 
                          : 'text-platinum-white/50 hover:text-platinum-white'
                      }`}
                      title="Voice chat"
                    >
                      <Mic size={14} />
                    </motion.button>
                  </div>
                )}
                {isDiagnosticMode && (
                  <motion.button
                    onClick={exitDiagnosticMode}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-2 py-1 text-xs font-medium bg-radiant-gold/20 text-radiant-gold border border-radiant-gold/30 rounded-md hover:bg-radiant-gold/30 transition-colors"
                    title="Exit assessment and return to regular chat"
                  >
                    Exit Assessment
                  </motion.button>
                )}
                <motion.button
                  onClick={clearChat}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 text-platinum-white/50 hover:text-red-400 transition-colors"
                  title="Clear chat"
                >
                  <Trash2 size={16} />
                </motion.button>
                <motion.button
                  onClick={() => setIsExpanded(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 text-platinum-white/50 hover:text-platinum-white transition-colors"
                  title="Minimize chat"
                >
                  <X size={16} />
                </motion.button>
              </div>
            </div>

            {/* Diagnostic Progress Indicator */}
            <AnimatePresence>
              {isDiagnosticMode && currentCategory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-2 bg-radiant-gold/10 border-b border-radiant-gold/20"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck size={12} className="text-radiant-gold" />
                    <span className="text-xs font-heading text-radiant-gold uppercase tracking-wider">
                      Diagnostic in Progress
                    </span>
                  </div>
                  <div className="text-xs text-platinum-white/70">
                    Current: {currentCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  {diagnosticProgress && diagnosticProgress.completedCategories && diagnosticProgress.completedCategories.length > 0 && (
                    <div className="text-xs text-platinum-white/50 mt-1">
                      Completed: {diagnosticProgress.completedCategories.length} of 6 categories
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2"
                >
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="text-xs text-red-400">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages Container */}
            <div className="h-[350px] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-radiant-gold/20 scrollbar-track-transparent">
              {/* Diagnostic Entry Banner */}
              <AnimatePresence>
                {isDiagnosticMode && showDiagnosticBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-radiant-gold/10 border border-radiant-gold/30 rounded-lg"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-radiant-gold">AI Readiness Assessment Started</p>
                        <p className="text-xs text-platinum-white/70 mt-1">
                          I&apos;ll ask questions across 6 categories to understand your needs. 
                          Click &quot;Exit Assessment&quot; in the header anytime to return to regular chat.
                        </p>
                      </div>
                      <button 
                        onClick={() => setShowDiagnosticBanner(false)}
                        className="text-platinum-white/50 hover:text-platinum-white transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Auth Banner — shown when user is not logged in */}
              <AnimatePresence>
                {!authUser && showLoginBanner && !isDiagnosticMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-silicon-slate/40 border border-radiant-gold/20 rounded-lg"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-platinum-white/70">
                          Sign in for personalized help based on your projects and purchases.
                        </p>
                        <button
                          onClick={() => signInWithOAuth('google')}
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-radiant-gold bg-radiant-gold/10 border border-radiant-gold/20 rounded-lg hover:bg-radiant-gold/20 hover:border-radiant-gold/30 transition-all duration-200"
                        >
                          <LogIn size={12} />
                          Sign in with Google
                        </button>
                      </div>
                      <button
                        onClick={() => setShowLoginBanner(false)}
                        className="text-platinum-white/50 hover:text-platinum-white transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {messages.map((message) => (
                <div key={message.id}>
                  <ChatMessage
                    role={message.role}
                    content={message.content}
                    timestamp={message.timestamp}
                    isTyping={message.isTyping}
                    isVoice={message.isVoice}
                  />
                  {/* Retry button for fallback/error responses */}
                  {message.isRetriable && message.retriableContent && !isLoading && (
                    <motion.button
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => retryMessage(message.id)}
                      className="mt-1 ml-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-radiant-gold bg-radiant-gold/10 border border-radiant-gold/20 rounded-lg hover:bg-radiant-gold/20 hover:border-radiant-gold/30 transition-all duration-200"
                    >
                      <RefreshCw size={12} />
                      Try again
                    </motion.button>
                  )}
                </div>
              ))}
              
              {/* Suggested Actions */}
              <AnimatePresence>
                {showSuggestions && messages.length <= 1 && !isLoading && !isDiagnosticMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={14} className="text-radiant-gold" />
                      <span className="text-xs font-heading text-platinum-white/70 uppercase tracking-wider">
                        Things you can ask me
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {suggestedActions.map((action) => {
                        const Icon = action.icon
                        return (
                          <motion.button
                            key={action.id}
                            onClick={() => handleSuggestionClick(action.message)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-start gap-3 p-3 bg-silicon-slate/20 border border-radiant-gold/10 rounded-lg hover:bg-silicon-slate/30 hover:border-radiant-gold/30 transition-all duration-200 text-left group"
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-radiant-gold/10 border border-radiant-gold/20 flex items-center justify-center group-hover:bg-radiant-gold/20 group-hover:border-radiant-gold/30 transition-colors">
                              <Icon size={16} className="text-radiant-gold" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-heading text-platinum-white group-hover:text-radiant-gold transition-colors">
                                {action.label}
                              </div>
                              <div className="text-xs text-platinum-white/50 mt-0.5">
                                {action.description}
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Calendly Embed Widget */}
              <AnimatePresence>
                {activeCalendlyUrl && (
                  <CalendlyEmbed
                    url={activeCalendlyUrl}
                    prefill={{
                      name: effectiveName || undefined,
                      email: effectiveEmail || undefined,
                    }}
                    onEventScheduled={handleCalendlyScheduled}
                    onClose={() => setActiveCalendlyUrl(null)}
                  />
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Text or Voice */}
            <div className="p-4 border-t border-radiant-gold/10 bg-silicon-slate/10">
              <AnimatePresence mode="wait">
                {chatMode === 'text' ? (
                  <motion.div
                    key="text-input"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChatInput
                      onSend={sendMessage}
                      isLoading={isLoading}
                      placeholder={isDiagnosticMode ? "Answer the question above..." : "Ask me anything..."}
                      isDiagnosticMode={isDiagnosticMode}
                      currentCategory={currentCategory}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="voice-input"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <VoiceChat
                      sessionId={sessionId}
                      onMessage={handleVoiceMessage}
                      onCallStart={handleVoiceCallStart}
                      onCallEnd={handleVoiceCallEnd}
                      visitorName={visitorName}
                      visitorEmail={visitorEmail}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
