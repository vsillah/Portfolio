'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Trash2, AlertCircle } from 'lucide-react'
import { ChatMessage, type ChatMessageProps } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { generateSessionId, CHAT_STORAGE_KEY } from '@/lib/chat-utils'

interface Message extends ChatMessageProps {
  id: string
}

interface ChatProps {
  initialMessage?: string
  visitorEmail?: string
  visitorName?: string
}

export function Chat({ initialMessage, visitorEmail, visitorName }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasLoadedHistory = useRef(false)

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

  // Load chat history when session is ready
  useEffect(() => {
    if (sessionId && !hasLoadedHistory.current) {
      hasLoadedHistory.current = true
      loadChatHistory()
    }
  }, [sessionId])

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          sessionId,
          visitorEmail,
          visitorName,
        }),
      })

      const data = await response.json()

      // Remove typing indicator
      setMessages(prev => prev.filter(m => m.id !== typingId))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
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
  }, [sessionId, isLoading, visitorEmail, visitorName])

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
                <span className="text-sm font-heading tracking-wider text-platinum-white">AI Assistant</span>
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
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-radiant-gold/10 bg-silicon-slate/10">
              <ChatInput
                onSend={sendMessage}
                isLoading={isLoading}
                placeholder="Ask me anything..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
