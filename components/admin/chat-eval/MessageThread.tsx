'use client'

import { motion } from 'framer-motion'
import { User, Bot, Headphones, Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface ToolCall {
  name: string
  arguments: any
  response: any
  success: boolean
  latency_ms?: number
}

interface MessageMetadata {
  source?: string
  latency_ms?: number
  isToolCall?: boolean
  toolCall?: ToolCall
  escalated?: boolean
  diagnosticMode?: boolean
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'support'
  content: string
  timestamp: string
  metadata?: MessageMetadata
}

interface MessageThreadProps {
  messages: Message[]
  showMetadata?: boolean
}

export function MessageThread({ messages, showMetadata = true }: MessageThreadProps) {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <MessageBubble 
          key={message.id} 
          message={message} 
          showMetadata={showMetadata}
          index={index}
        />
      ))}
    </div>
  )
}

function MessageBubble({ 
  message, 
  showMetadata,
  index 
}: { 
  message: Message
  showMetadata: boolean
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isUser = message.role === 'user'
  const isSupport = message.role === 'support'
  const isToolCall = message.metadata?.isToolCall
  
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Determine icon
  const Icon = isUser ? User : isSupport ? Headphones : isToolCall ? Wrench : Bot
  
  // Determine colors
  const bgColor = isUser 
    ? 'bg-radiant-gold/10 border-radiant-gold/20' 
    : isSupport 
      ? 'bg-orange-500/10 border-orange-500/20'
      : isToolCall
        ? 'bg-purple-500/10 border-purple-500/20'
        : 'bg-silicon-slate/30 border-silicon-slate/50'
  
  const iconBg = isUser 
    ? 'bg-radiant-gold/20 text-radiant-gold' 
    : isSupport 
      ? 'bg-orange-500/20 text-orange-400'
      : isToolCall
        ? 'bg-purple-500/20 text-purple-400'
        : 'bg-silicon-slate/50 text-platinum-white'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`relative ${isUser ? 'ml-8' : 'mr-8'}`}
    >
      {/* Role label */}
      <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${iconBg}`}>
          <Icon size={12} />
        </div>
        <span className="text-xs font-heading text-platinum-white/60 uppercase tracking-wider">
          {isUser ? 'Human' : isSupport ? 'Support' : isToolCall ? 'Tool Call' : 'Assistant'}
        </span>
        <span className="text-xs text-platinum-white/40">
          {formatTime(message.timestamp)}
        </span>
      </div>
      
      {/* Message content */}
      <div className={`p-4 rounded-xl border ${bgColor}`}>
        {isToolCall && message.metadata?.toolCall ? (
          <ToolCallContent toolCall={message.metadata.toolCall} />
        ) : (
          <p className="text-sm text-platinum-white whitespace-pre-wrap">
            {message.content}
          </p>
        )}
        
        {/* Metadata toggle */}
        {showMetadata && message.metadata && !isToolCall && (
          <div className="mt-3 pt-3 border-t border-platinum-white/10">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-xs text-platinum-white/50 hover:text-platinum-white/70 transition-colors"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Metadata
            </button>
            
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 space-y-1 text-xs text-platinum-white/50"
              >
                {message.metadata.source && (
                  <div>Source: <span className="text-platinum-white/70">{message.metadata.source}</span></div>
                )}
                {message.metadata.latency_ms && (
                  <div>Latency: <span className="text-platinum-white/70">{message.metadata.latency_ms}ms</span></div>
                )}
                {message.metadata.escalated && (
                  <div className="text-orange-400">Escalated to human</div>
                )}
                {message.metadata.diagnosticMode && (
                  <div className="text-radiant-gold">Diagnostic mode</div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ToolCallContent({ toolCall }: { toolCall: ToolCall | undefined }) {
  const [showDetails, setShowDetails] = useState(false)
  
  if (!toolCall) return null
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-purple-400">{toolCall.name}</span>
          <span className={`px-2 py-0.5 rounded text-xs ${toolCall.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {toolCall.success ? 'Success' : 'Failed'}
          </span>
        </div>
        {toolCall.latency_ms && (
          <span className="text-xs text-platinum-white/50">{toolCall.latency_ms}ms</span>
        )}
      </div>
      
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 text-xs text-platinum-white/50 hover:text-platinum-white/70"
      >
        {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showDetails ? 'Hide' : 'Show'} details
      </button>
      
      {showDetails && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <div>
            <div className="text-xs text-platinum-white/50 mb-1">Arguments:</div>
            <pre className="p-2 bg-black/30 rounded text-xs text-platinum-white/70 overflow-x-auto">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>
          {toolCall.response && (
            <div>
              <div className="text-xs text-platinum-white/50 mb-1">Response:</div>
              <pre className="p-2 bg-black/30 rounded text-xs text-platinum-white/70 overflow-x-auto max-h-40">
                {JSON.stringify(toolCall.response, null, 2)}
              </pre>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
