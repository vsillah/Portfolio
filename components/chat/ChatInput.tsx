'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2 } from 'lucide-react'
import type { DiagnosticCategory } from '@/lib/n8n'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
  isDiagnosticMode?: boolean
  currentCategory?: DiagnosticCategory | null
}

export function ChatInput({ 
  onSend, 
  disabled, 
  isLoading, 
  placeholder = 'Type your message...',
  isDiagnosticMode = false,
  currentCategory = null
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled && !isLoading) {
      onSend(message.trim())
      setMessage('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-end gap-2 p-2 bg-silicon-slate/20 rounded-xl border border-radiant-gold/10 focus-within:border-radiant-gold/30 transition-colors">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-platinum-white text-sm font-body placeholder:text-platinum-white/30 focus:outline-none resize-none min-h-[40px] max-h-[120px] py-2 px-2 disabled:opacity-50"
        />
        <motion.button
          type="submit"
          disabled={!message.trim() || disabled || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
            message.trim() && !disabled && !isLoading
              ? 'bg-gradient-to-br from-radiant-gold to-bronze text-imperial-navy hover:shadow-lg hover:shadow-radiant-gold/20'
              : 'bg-silicon-slate/30 text-platinum-white/30 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </motion.button>
      </div>
      {/* Diagnostic mode hint */}
      {isDiagnosticMode && currentCategory && (
        <p className="text-[10px] text-radiant-gold/70 mt-2 text-center">
          Answering questions about: {currentCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </p>
      )}
      {!isDiagnosticMode && (
        <p className="text-[10px] text-platinum-white/30 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      )}
      {isDiagnosticMode && !currentCategory && (
        <p className="text-[10px] text-platinum-white/30 mt-2 text-center">
          Starting diagnostic assessment...
        </p>
      )}
    </form>
  )
}
