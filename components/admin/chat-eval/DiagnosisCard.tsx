'use client'

import { motion } from 'framer-motion'
import { Bug, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, Code, Sparkles } from 'lucide-react'

interface DiagnosisCardProps {
  diagnosis: {
    id: string
    session_id: string
    root_cause: string
    error_type: 'prompt' | 'code' | 'both' | 'unknown'
    confidence_score: number
    status: 'pending' | 'reviewed' | 'approved' | 'applied' | 'rejected'
    recommendations_count: number
    diagnosed_at: string
    model_used: string
    session?: {
      session_id: string
      visitor_name?: string
      visitor_email?: string
    }
    evaluation?: {
      category?: {
        name: string
        color: string
      }
    }
  }
  onClick?: () => void
}

export function DiagnosisCard({ diagnosis, onClick }: DiagnosisCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-yellow-400" />
      case 'reviewed':
        return <AlertCircle size={16} className="text-blue-400" />
      case 'approved':
        return <CheckCircle size={16} className="text-emerald-400" />
      case 'applied':
        return <CheckCircle size={16} className="text-purple-400" />
      case 'rejected':
        return <XCircle size={16} className="text-red-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
      case 'reviewed':
        return 'bg-blue-500/20 border-blue-500/30 text-blue-400'
      case 'approved':
        return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
      case 'applied':
        return 'bg-purple-500/20 border-purple-500/30 text-purple-400'
      case 'rejected':
        return 'bg-red-500/20 border-red-500/30 text-red-400'
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-400'
    }
  }

  const getErrorTypeIcon = (errorType: string) => {
    switch (errorType) {
      case 'prompt':
        return <MessageSquare size={14} className="text-cyan-400" />
      case 'code':
        return <Code size={14} className="text-orange-400" />
      case 'both':
        return <Bug size={14} className="text-red-400" />
      default:
        return <AlertCircle size={14} className="text-gray-400" />
    }
  }

  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { scale: 1.01 } : {}}
      whileTap={onClick ? { scale: 0.99 } : {}}
      className={`p-5 rounded-xl border transition-all ${
        onClick ? 'cursor-pointer hover:border-radiant-gold/30' : ''
      } bg-silicon-slate/20 border-radiant-gold/10`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Status badge and date */}
          <div className="flex items-center gap-3 mb-3">
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${getStatusColor(diagnosis.status)}`}>
              {getStatusIcon(diagnosis.status)}
              {diagnosis.status.charAt(0).toUpperCase() + diagnosis.status.slice(1)}
            </span>
            <span className="flex items-center gap-1 text-platinum-white/50 text-sm">
              {getErrorTypeIcon(diagnosis.error_type)}
              {diagnosis.error_type}
            </span>
            <span className="text-sm text-platinum-white/50">
              {formatDate(diagnosis.diagnosed_at)}
            </span>
          </div>

          {/* Root cause */}
          <h3 className="text-lg font-semibold text-platinum-white mb-2">
            {diagnosis.root_cause.substring(0, 150)}
            {diagnosis.root_cause.length > 150 ? '...' : ''}
          </h3>

          {/* Session info */}
          {diagnosis.session && (
            <div className="flex items-center gap-4 text-sm text-platinum-white/60 mb-2">
              <span>Session: {diagnosis.session.session_id.substring(0, 20)}...</span>
              {diagnosis.session.visitor_name && (
                <span>• {diagnosis.session.visitor_name}</span>
              )}
            </div>
          )}

          {/* Evaluation category */}
          {diagnosis.evaluation?.category && (
            <div className="mb-2">
              <span 
                className="px-2 py-0.5 rounded text-xs"
                style={{ 
                  backgroundColor: `${diagnosis.evaluation.category.color}20`,
                  color: diagnosis.evaluation.category.color,
                  borderColor: `${diagnosis.evaluation.category.color}40`,
                  borderWidth: 1,
                }}
              >
                {diagnosis.evaluation.category.name}
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-platinum-white/50">
            <span className="flex items-center gap-1">
              <Sparkles size={12} />
              {diagnosis.recommendations_count} recommendations
            </span>
            <span className="flex items-center gap-1">
              Confidence: {Math.round(diagnosis.confidence_score * 100)}%
            </span>
            <span>{diagnosis.model_used}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
