'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { User, Bot, Headphones, Mic } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface ChatMessageProps {
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp?: string
  isTyping?: boolean
  isVoice?: boolean
}

const URL_REGEX = /https?:\/\/[^\s<]+/g

function renderUserContent(text: string) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-radiant-gold hover:text-gold-light transition-colors"
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  URL_REGEX.lastIndex = 0
  return parts
}

const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-radiant-gold hover:text-gold-light transition-colors"
    >
      {children}
    </a>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-platinum-white">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="bg-imperial-navy/50 px-1 py-0.5 rounded text-xs text-radiant-gold/80">{children}</code>
  ),
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
          ) : isUser ? (
              <p className="text-sm font-body leading-relaxed whitespace-pre-wrap">{renderUserContent(content)}</p>
            ) : (
              <div className="text-sm font-body leading-relaxed prose-chat">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
        </div>

        {/* Timestamp and Voice Indicator */}
        {timestamp && !isTyping && (
          <div className={`flex items-center gap-1 mt-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {isVoice && (
              <Mic size={10} className="text-radiant-gold/50" />
            )}
            <span className="text-[10px] text-platinum-white/30">
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
