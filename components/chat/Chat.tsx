'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Trash2, AlertCircle, ClipboardCheck, Sparkles, BookOpen, Briefcase, Code } from 'lucide-react'
import { ChatMessage, type ChatMessageProps } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { generateSessionId, CHAT_STORAGE_KEY } from '@/lib/chat-utils'
import type { DiagnosticCategory, DiagnosticProgress } from '@/lib/n8n'

interface Message extends ChatMessageProps {
  id: string
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
  const result = DIAGNOSTIC_TRIGGERS.some(trigger => lowerMessage.includes(trigger))
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Chat.tsx:detectDiagnosticIntent',message:'Diagnostic intent detection',data:{message,lowerMessage,result,triggers:DIAGNOSTIC_TRIGGERS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return result
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasLoadedHistory = useRef(false)

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
  ]

  const handleSuggestionClick = (message: string) => {
    setShowSuggestions(false)
    sendMessage(message)
  }

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

  // Load chat history and diagnostic status when session is ready
  useEffect(() => {
    if (sessionId && !hasLoadedHistory.current) {
      hasLoadedHistory.current = true
      loadChatHistory()
      loadDiagnosticStatus()
    }
  }, [sessionId])

  // Load diagnostic status for current session
  const loadDiagnosticStatus = async () => {
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
  }

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

  const loadChatHistory = async () => {
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
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

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
        visitorEmail,
        visitorName,
        diagnosticMode: isDiagnosticMode || shouldStartDiagnostic,
        diagnosticAuditId: diagnosticAuditId || undefined,
        diagnosticProgress: diagnosticProgress || undefined,
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Chat.tsx:sendMessage',message:'API request payload',data:requestPayload,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      const data = await response.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Chat.tsx:sendMessage',message:'API response',data:{diagnosticMode:data.diagnosticMode,diagnosticAuditId:data.diagnosticAuditId,response:data.response?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Remove typing indicator
      setMessages(prev => prev.filter(m => m.id !== typingId))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
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

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: data.escalated ? 'support' : 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (err) {
      // Remove typing indicator on error
      setMessages(prev => prev.filter(m => m.id !== typingId))
      
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      setError(errorMessage)
      
      // Add error message to chat
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I apologize, but I'm having trouble connecting right now. Please try again or use the contact form to reach out directly.",
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, isLoading, visitorEmail, visitorName, isDiagnosticMode, diagnosticAuditId, diagnosticProgress])

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
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-heading tracking-wider text-platinum-white">
                  {isDiagnosticMode ? 'Diagnostic Mode' : 'AI Assistant'}
                </span>
                {isDiagnosticMode && (
                  <ClipboardCheck size={14} className="text-radiant-gold" />
                )}
              </div>
              <div className="flex items-center gap-2">
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
                  {diagnosticProgress && diagnosticProgress.completedCategories.length > 0 && (
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
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  isTyping={message.isTyping}
                />
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
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-radiant-gold/10 bg-silicon-slate/10">
              <ChatInput
                onSend={sendMessage}
                isLoading={isLoading}
                placeholder={isDiagnosticMode ? "Answer the question above..." : "Ask me anything..."}
                isDiagnosticMode={isDiagnosticMode}
                currentCategory={currentCategory}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
