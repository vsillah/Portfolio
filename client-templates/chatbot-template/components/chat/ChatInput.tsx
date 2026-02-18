'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  isLoading?: boolean
  placeholder?: string
}

export function ChatInput({ 
  onSend, 
  disabled, 
  isLoading, 
  placeholder = 'Type your message...',
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
      <div className="flex items-end gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-300 transition-colors">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none resize-none min-h-[40px] max-h-[120px] py-2 px-2 disabled:opacity-50"
        />
        <motion.button
          type="submit"
          disabled={!message.trim() || disabled || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
            message.trim() && !disabled && !isLoading
              ? 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </motion.button>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  )
}
