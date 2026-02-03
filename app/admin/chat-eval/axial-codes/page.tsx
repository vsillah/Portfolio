'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { 
  Sparkles, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  FileText,
  Hash
} from 'lucide-react'

interface Generation {
  id: string
  source_session_count: number
  source_open_code_count: number
  axial_code_count: number
  model_used: string
  status: 'pending' | 'reviewed' | 'completed'
  created_at: string
  review_stats: {
    total: number
    pending: number
    approved: number
    rejected: number
  }
}

export default function AxialCodesPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AxialCodesContent />
    </ProtectedRoute>
  )
}

function AxialCodesContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)

  const fetchGenerations = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)

      const response = await fetch(`/api/admin/chat-eval/axial-codes/generations?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setGenerations(data.generations)
      }
    } catch (error) {
      console.error('Error fetching generations:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchGenerations()
  }, [fetchGenerations])

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
      case 'completed':
        return <CheckCircle size={16} className="text-emerald-400" />
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
      case 'completed':
        return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
      default:
        return 'bg-gray-500/20 border-gray-500/30 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval', href: '/admin/chat-eval' },
          { label: 'Axial Codes' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={32} className="text-purple-400" />
            <h1 className="text-4xl font-heading tracking-wider">Axial Codes</h1>
          </div>
          <p className="text-platinum-white/60">
            Review and approve generated axial codes to create new issue categories
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { value: null, label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'reviewed', label: 'Reviewed' },
            { value: 'completed', label: 'Completed' },
          ].map(({ value, label }) => (
            <button
              key={label}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg text-sm transition-all
                ${filter === value
                  ? 'bg-radiant-gold/20 border border-radiant-gold/50 text-radiant-gold'
                  : 'bg-silicon-slate/30 border border-radiant-gold/10 text-platinum-white/70 hover:border-radiant-gold/30'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Generations list */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-platinum-white/50">
              Loading generations...
            </div>
          ) : generations.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles size={48} className="text-platinum-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-heading mb-2">No Generations Yet</h3>
              <p className="text-platinum-white/50 mb-4">
                Select sessions with open codes and generate axial codes to get started.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/admin/chat-eval')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
              >
                Go to Session List
              </motion.button>
            </div>
          ) : (
            generations.map((gen) => (
              <motion.div
                key={gen.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => router.push(`/admin/chat-eval/axial-codes/${gen.id}`)}
                className="p-5 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl
                  hover:border-radiant-gold/30 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Status badge and date */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${getStatusColor(gen.status)}`}>
                        {getStatusIcon(gen.status)}
                        {gen.status.charAt(0).toUpperCase() + gen.status.slice(1)}
                      </span>
                      <span className="text-sm text-platinum-white/50">
                        {formatDate(gen.created_at)}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Hash size={14} className="text-purple-400" />
                        <span className="text-platinum-white">
                          {gen.axial_code_count} axial codes
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-cyan-400" />
                        <span className="text-platinum-white/70">
                          from {gen.source_open_code_count} open codes
                        </span>
                      </div>
                      <div className="text-platinum-white/50">
                        {gen.source_session_count} sessions
                      </div>
                    </div>

                    {/* Review progress */}
                    <div className="mt-4">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-platinum-white/50">Review Progress:</span>
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Clock size={12} />
                          {gen.review_stats.pending} pending
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle size={12} />
                          {gen.review_stats.approved} approved
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle size={12} />
                          {gen.review_stats.rejected} rejected
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-silicon-slate/50 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div 
                            className="bg-emerald-500 transition-all"
                            style={{ width: `${(gen.review_stats.approved / gen.review_stats.total) * 100}%` }}
                          />
                          <div 
                            className="bg-red-500 transition-all"
                            style={{ width: `${(gen.review_stats.rejected / gen.review_stats.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs text-platinum-white/40">{gen.model_used}</span>
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
