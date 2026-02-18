'use client'

import { motion } from 'framer-motion'
import { User, Bot, Headphones, Mic } from 'lucide-react'

export interface ChatMessageProps {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp?: string
  isTyping?: boolean
  isVoice?: boolean
}

export function ChatMessage({ role, content, timestamp, isTyping, isVoice }: ChatMessageProps) {
  const isUser = role === 'user'
  const isSupport = role === 'support'

  const getRoleIcon = () => {
    if (isUser) return <User size={14} />
    if (isSupport) return <Headphones size={14} />
    return <Bot size={14} />
  }

  const getRoleLabel = () => {
    if (isUser) return 'You'
    if (isSupport) return 'Support'
    return 'AI Assistant'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-blue-500 text-white'
            : isSupport
            ? 'bg-emerald-500 text-white'
            : 'bg-gray-200 text-gray-700'
        }`}
      >
        {getRoleIcon()}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Role Label */}
        <span className="text-[10px] font-medium text-gray-400 uppercase mb-1 px-1">
          {getRoleLabel()}
        </span>

        {/* Content */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-blue-500 text-white'
              : isSupport
              ? 'bg-emerald-100 border border-emerald-200 text-gray-800'
              : 'bg-gray-100 border border-gray-200 text-gray-800'
          } ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        >
          {isTyping ? (
            <div className="flex items-center gap-1 py-1">
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                className="w-2 h-2 rounded-full bg-gray-400"
              />
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="w-2 h-2 rounded-full bg-gray-400"
              />
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                className="w-2 h-2 rounded-full bg-gray-400"
              />
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
          )}
        </div>

        {/* Timestamp and Voice Indicator */}
        {timestamp && !isTyping && (
          <div className={`flex items-center gap-1 mt-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {isVoice && (
              <Mic size={10} className="text-gray-400" />
            )}
            <span className="text-[10px] text-gray-400">
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
