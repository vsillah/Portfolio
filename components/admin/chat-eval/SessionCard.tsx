'use client'

import { motion } from 'framer-motion'
import { MessageCircle, Mic, Check, X, ChevronRight, AlertTriangle, Clock, Square, CheckSquare, Trash2, Bot, Mail } from 'lucide-react'

interface SessionCardProps {
  session: {
    id: string
    session_id: string
    visitor_name?: string
    visitor_email?: string
    is_escalated?: boolean
    created_at: string
    updated_at: string
    channel: 'text' | 'voice' | 'chatbot' | 'email'
    message_count: number
    prompt_version?: number
    call_duration_seconds?: number
    evaluation?: {
      rating?: 'good' | 'bad'
      category_name?: string
      category_color?: string
      open_code?: string
    } | null
  }
  isSelected?: boolean
  selectionMode?: boolean
  onSelect?: (selected: boolean) => void
  onClick?: () => void
  onDelete?: (sessionId: string) => void
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case 'voice': return Mic
    case 'chatbot': return Bot
    case 'email': return Mail
    default: return MessageCircle // text (SMS) or fallback
  }
}

export function SessionCard({ session, isSelected, selectionMode, onSelect, onClick, onDelete }: SessionCardProps) {
  const ChannelIcon = getChannelIcon(session.channel)
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect?.(!isSelected)
  }

  const handleCardClick = () => {
    if (selectionMode) {
      onSelect?.(!isSelected)
    } else {
      onClick?.()
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(session.session_id)
  }

  return (
    <motion.div
      onClick={handleCardClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`
        p-4 rounded-xl border cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-radiant-gold/10 border-radiant-gold/50' 
          : 'bg-silicon-slate/20 border-radiant-gold/10 hover:border-radiant-gold/30'
        }
      `}
    >
      <div className="flex items-start justify-between">
        {/* Checkbox for selection mode */}
        {selectionMode && (
          <div 
            className="mr-3 flex-shrink-0"
            onClick={handleCheckboxClick}
          >
            {isSelected ? (
              <CheckSquare size={20} className="text-radiant-gold" />
            ) : (
              <Square size={20} className="text-platinum-white/40 hover:text-platinum-white/60" />
            )}
          </div>
        )}
        
        {/* Left side: Session info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Channel icon */}
            <div className={`
              w-6 h-6 rounded-md flex items-center justify-center
              ${session.channel === 'voice' ? 'bg-purple-500/20' : session.channel === 'chatbot' ? 'bg-orange-500/20' : session.channel === 'email' ? 'bg-blue-500/20' : 'bg-emerald-500/20'}
            `}>
              <ChannelIcon size={14} className={session.channel === 'voice' ? 'text-purple-400' : session.channel === 'chatbot' ? 'text-orange-400' : session.channel === 'email' ? 'text-blue-400' : 'text-emerald-400'} />
            </div>
            
            {/* Session ID (truncated) */}
            <span className="font-mono text-sm text-platinum-white truncate">
              {session.session_id.substring(0, 20)}...
            </span>
            
            {/* Escalation badge */}
            {session.is_escalated && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded text-xs text-orange-400">
                <AlertTriangle size={10} />
                Escalated
              </span>
            )}
          </div>
          
          {/* Visitor info */}
          {(session.visitor_name || session.visitor_email) && (
            <div className="text-xs text-platinum-white/60 mb-2">
              {session.visitor_name && <span>{session.visitor_name}</span>}
              {session.visitor_name && session.visitor_email && <span> • </span>}
              {session.visitor_email && <span>{session.visitor_email}</span>}
            </div>
          )}
          
          {/* Timestamps and stats */}
          <div className="flex items-center gap-3 text-xs text-platinum-white/50 flex-wrap">
            <span>Created: {formatDate(session.created_at)}</span>
            <span>•</span>
            <span>{session.message_count} messages</span>
            {session.prompt_version != null && (
              <>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-platinum-white/10 text-platinum-white/70 border border-platinum-white/20 font-medium">
                  v{session.prompt_version}
                </span>
              </>
            )}
            {(session.channel === 'voice' && session.call_duration_seconds) && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatDuration(session.call_duration_seconds)}
                </span>
              </>
            )}
          </div>
          
          {/* Category badge or open code if evaluated */}
          {(session.evaluation?.category_name || session.evaluation?.open_code) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {session.evaluation?.category_name && (
                <span 
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ 
                    backgroundColor: `${session.evaluation.category_color}20`,
                    color: session.evaluation.category_color,
                    borderColor: `${session.evaluation.category_color}40`,
                    borderWidth: 1,
                  }}
                >
                  {session.evaluation.category_name}
                </span>
              )}
              {session.evaluation?.open_code && (
                <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                  {session.evaluation.open_code}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Right side: Rating status, delete, chevron */}
        <div className="flex items-center gap-3 ml-4">
          {/* Rating indicator */}
          {session.evaluation?.rating === 'good' ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check size={14} className="text-white" />
            </div>
          ) : session.evaluation?.rating === 'bad' ? (
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
              <X size={14} className="text-white" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-platinum-white/20" />
          )}
          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="p-1.5 rounded-lg text-platinum-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete session"
            >
              <Trash2 size={16} />
            </button>
          )}
          <ChevronRight size={16} className="text-platinum-white/40" />
        </div>
      </div>
    </motion.div>
  )
}
