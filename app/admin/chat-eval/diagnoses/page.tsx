'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { 
  Bug, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  FileText,
  Code,
  MessageSquare,
  Sparkles,
  Loader2
} from 'lucide-react'

interface Diagnosis {
  id: string
  session_id: string
  root_cause: string
  error_type: 'prompt' | 'code' | 'both' | 'unknown'
  confidence_score: number
  status: 'pending' | 'reviewed' | 'approved' | 'applied' | 'rejected'
  recommendations_count: number
  diagnosed_at: string
  reviewed_at?: string
  applied_at?: string
  model_used: string
  session?: {
    session_id: string
    visitor_name?: string
    visitor_email?: string
  }
  evaluation?: {
    id: string
    notes?: string
    category?: {
      name: string
      color: string
    }
  }
}

export default function DiagnosesPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DiagnosesContent />
    </ProtectedRoute>
  )
}

function DiagnosesContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterErrorType, setFilterErrorType] = useState<string | null>(null)

  const fetchDiagnoses = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterErrorType) params.set('error_type', filterErrorType)

      const response = await fetch(`/api/admin/chat-eval/diagnoses?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDiagnoses(data.diagnoses)
      }
    } catch (error) {
      console.error('Error fetching diagnoses:', error)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterErrorType])

  useEffect(() => {
    fetchDiagnoses()
  }, [fetchDiagnoses])

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
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval', href: '/admin/chat-eval' },
          { label: 'Error Diagnoses' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bug size={32} className="text-red-400" />
            <h1 className="text-4xl font-heading tracking-wider">Error Diagnoses</h1>
          </div>
          <p className="text-platinum-white/60">
            AI-powered root cause analysis and fix recommendations for confirmed errors
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { value: null, label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'reviewed', label: 'Reviewed' },
            { value: 'approved', label: 'Approved' },
            { value: 'applied', label: 'Applied' },
          ].map(({ value, label }) => (
            <button
              key={label}
              onClick={() => setFilterStatus(value)}
              className={`px-4 py-2 rounded-lg text-sm transition-all
                ${filterStatus === value
                  ? 'bg-radiant-gold/20 border border-radiant-gold/50 text-radiant-gold'
                  : 'bg-silicon-slate/30 border border-radiant-gold/10 text-platinum-white/70 hover:border-radiant-gold/30'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error type filter */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-platinum-white/50">Error Type:</span>
          {[
            { value: null, label: 'All' },
            { value: 'prompt', label: 'Prompt' },
            { value: 'code', label: 'Code' },
            { value: 'both', label: 'Both' },
          ].map(({ value, label }) => (
            <button
              key={label}
              onClick={() => setFilterErrorType(value)}
              className={`px-3 py-1 rounded text-xs transition-all
                ${filterErrorType === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-silicon-slate/30 text-platinum-white/70 hover:bg-silicon-slate/50'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Diagnoses list */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-platinum-white/50">
              <Loader2 size={32} className="animate-spin mx-auto mb-4" />
              Loading diagnoses...
            </div>
          ) : diagnoses.length === 0 ? (
            <div className="text-center py-12">
              <Bug size={48} className="text-platinum-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-heading mb-2">No Diagnoses Yet</h3>
              <p className="text-platinum-white/50 mb-4">
                Select sessions with errors and run diagnosis to get started.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/admin/chat-eval')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
              >
                Go to Session List
              </motion.button>
            </div>
          ) : (
            diagnoses.map((diag) => (
              <motion.div
                key={diag.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => router.push(`/admin/chat-eval/diagnoses/${diag.id}`)}
                className="p-5 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl
                  hover:border-radiant-gold/30 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Status badge and date */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${getStatusColor(diag.status)}`}>
                        {getStatusIcon(diag.status)}
                        {diag.status.charAt(0).toUpperCase() + diag.status.slice(1)}
                      </span>
                      <span className="flex items-center gap-1 text-platinum-white/50 text-sm">
                        {getErrorTypeIcon(diag.error_type)}
                        {diag.error_type}
                      </span>
                      <span className="text-sm text-platinum-white/50">
                        {formatDate(diag.diagnosed_at)}
                      </span>
                    </div>

                    {/* Root cause */}
                    <h3 className="text-lg font-semibold text-platinum-white mb-2">
                      {diag.root_cause.substring(0, 150)}
                      {diag.root_cause.length > 150 ? '...' : ''}
                    </h3>

                    {/* Session info */}
                    {diag.session && (
                      <div className="flex items-center gap-4 text-sm text-platinum-white/60 mb-2">
                        <span>Session: {diag.session.session_id.substring(0, 20)}...</span>
                        {diag.session.visitor_name && (
                          <span>• {diag.session.visitor_name}</span>
                        )}
                      </div>
                    )}

                    {/* Evaluation category */}
                    {diag.evaluation?.category && (
                      <div className="mb-2">
                        <span 
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ 
                            backgroundColor: `${diag.evaluation.category.color}20`,
                            color: diag.evaluation.category.color,
                            borderColor: `${diag.evaluation.category.color}40`,
                            borderWidth: 1,
                          }}
                        >
                          {diag.evaluation.category.name}
                        </span>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-platinum-white/50">
                      <span className="flex items-center gap-1">
                        <Sparkles size={12} />
                        {diag.recommendations_count} recommendations
                      </span>
                      <span className="flex items-center gap-1">
                        Confidence: {Math.round(diag.confidence_score * 100)}%
                      </span>
                      <span>{diag.model_used}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <ChevronRight size={20} className="text-platinum-white/40" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
