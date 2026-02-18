'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Trash2, AlertCircle, Mic, MessageSquare } from 'lucide-react'
import { ChatMessage, type ChatMessageProps } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { VoiceChat } from './VoiceChat'
import { generateSessionId, CHAT_STORAGE_KEY } from '@/lib/chat-utils'
import type { VoiceChatMessage } from '@/lib/vapi'
import { isVapiConfigured } from '@/lib/vapi'

type ChatMode = 'text' | 'voice'

interface Message extends ChatMessageProps {
  id: string
  isVoice?: boolean
}

interface ChatProps {
  /** Initial welcome message */
  initialMessage?: string
  /** Pre-fill visitor email if known */
  visitorEmail?: string
  /** Pre-fill visitor name if known */
  visitorName?: string
  /** Custom suggested actions */
  suggestedActions?: Array<{
    id: string
    label: string
    message: string
    description?: string
  }>
}

export function Chat({ 
  initialMessage = "Hi! I'm here to help. How can I assist you today?",
  visitorEmail, 
  visitorName,
  suggestedActions = [
    { id: 'services', label: 'Learn About Services', message: 'What services do you offer?', description: 'Explore our offerings' },
    { id: 'pricing', label: 'Get Pricing', message: 'Can you tell me about pricing?', description: 'View pricing options' },
    { id: 'contact', label: 'Contact Us', message: 'I would like to speak with someone', description: 'Get in touch' },
  ]
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [chatMode, setChatMode] = useState<ChatMode>('text')
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasLoadedHistory = useRef(false)
  
  // Check if voice chat is available
  const voiceEnabled = isVapiConfigured()

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
        content: initialMessage,
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

      // Extract response text
      let responseText = data.response
      if (typeof responseText === 'object' && responseText !== null) {
        responseText = responseText.response || responseText.text || responseText.message || ''
      }
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: data.escalated ? 'support' : 'assistant',
        content: String(responseText || ''),
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
        content: "I apologize, but I'm having trouble connecting right now. Please try again.",
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
      setShowSuggestions(true)
      
      // Reset messages with welcome
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: initialMessage,
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
            className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 shadow-sm"
          >
            <MessageCircle size={20} className="text-blue-500" />
            <span className="font-medium text-sm">Chat with AI Assistant</span>
          </motion.button>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg"
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isVoiceCallActive ? 'bg-blue-500' : 'bg-emerald-500'} animate-pulse`} />
                <span className="text-sm font-medium text-gray-700">
                  {isVoiceCallActive ? 'Voice Active' : 'AI Assistant'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Voice/Text Mode Toggle */}
                {voiceEnabled && (
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5 mr-2">
                    <motion.button
                      onClick={() => setChatMode('text')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`p-1.5 rounded-md transition-all duration-200 ${
                        chatMode === 'text' 
                          ? 'bg-white text-blue-500 shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700'
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
                          ? 'bg-white text-blue-500 shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title="Voice chat"
                    >
                      <Mic size={14} />
                    </motion.button>
                  </div>
                )}
                <motion.button
                  onClick={clearChat}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear chat"
                >
                  <Trash2 size={16} />
                </motion.button>
                <motion.button
                  onClick={() => setIsExpanded(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
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
                  className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2"
                >
                  <AlertCircle size={14} className="text-red-500" />
                  <span className="text-xs text-red-600">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages Container */}
            <div className="h-[350px] overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  timestamp={message.timestamp}
                  isTyping={message.isTyping}
                  isVoice={message.isVoice}
                />
              ))}
              
              {/* Suggested Actions */}
              <AnimatePresence>
                {showSuggestions && messages.length <= 1 && !isLoading && suggestedActions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-2"
                  >
                    <span className="text-xs font-medium text-gray-400 uppercase">
                      Quick Actions
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {suggestedActions.map((action) => (
                        <motion.button
                          key={action.id}
                          onClick={() => handleSuggestionClick(action.message)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex flex-col p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 text-left"
                        >
                          <span className="text-sm font-medium text-gray-700">
                            {action.label}
                          </span>
                          {action.description && (
                            <span className="text-xs text-gray-500 mt-0.5">
                              {action.description}
                            </span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Text or Voice */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
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
                      placeholder="Ask me anything..."
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
