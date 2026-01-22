'use client'

import { motion } from 'framer-motion'
import { User, Bot, Headphones } from 'lucide-react'

export interface ChatMessageProps {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp?: string
  isTyping?: boolean
}

export function ChatMessage({ role, content, timestamp, isTyping }: ChatMessageProps) {
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
            ? 'bg-gradient-to-br from-bronze via-radiant-gold to-gold-light text-imperial-navy'
            : isSupport
            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
            : 'bg-silicon-slate/50 border border-radiant-gold/20 text-radiant-gold'
        }`}
      >
        {getRoleIcon()}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Role Label */}
        <span className="text-[10px] font-heading tracking-wider text-platinum-white/40 uppercase mb-1 px-1">
          {getRoleLabel()}
        </span>

        {/* Content */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-gradient-to-br from-radiant-gold/20 to-bronze/20 border border-radiant-gold/30 text-platinum-white'
              : isSupport
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-platinum-white'
              : 'bg-silicon-slate/30 border border-platinum-white/10 text-platinum-white/90'
          } ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        >
          {isTyping ? (
            <div className="flex items-center gap-1 py-1">
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                className="w-2 h-2 rounded-full bg-radiant-gold"
              />
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="w-2 h-2 rounded-full bg-radiant-gold"
              />
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                className="w-2 h-2 rounded-full bg-radiant-gold"
              />
            </div>
          ) : (
            <p className="text-sm font-body leading-relaxed whitespace-pre-wrap">{content}</p>
          )}
        </div>

        {/* Timestamp */}
        {timestamp && !isTyping && (
          <span className="text-[10px] text-platinum-white/30 mt-1 px-1">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  )
}
