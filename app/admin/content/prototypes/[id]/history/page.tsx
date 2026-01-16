'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, ArrowRight, Clock, User, Loader2, 
  AlertCircle, CheckCircle2, X, MessageSquare
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import Link from 'next/link'

interface StageHistory {
  id: string
  prototype_id: string
  old_stage: string | null
  new_stage: string
  changed_by: string | null
  change_reason: string | null
  changed_at: string
  changed_by_profile?: {
    email: string
  }
}

interface AppPrototype {
  id: string
  title: string
  production_stage: string
}

type NotificationType = 'success' | 'error' | 'info'

interface Notification {
  type: NotificationType
  message: string
}

const PRODUCTION_STAGES = ['Dev', 'QA', 'Pilot', 'Production']

export default function PrototypeHistoryPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<StageHistory[]>([])
  const [prototype, setPrototype] = useState<AppPrototype | null>(null)
  const [notification, setNotification] = useState<Notification | null>(null)

  const showNotification = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      // Fetch prototype details
      const protoResponse = await fetch(`/api/prototypes/${params.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!protoResponse.ok) {
        if (protoResponse.status === 404) {
          showNotification('error', 'Prototype not found')
          router.push('/admin/content/prototypes')
          return
        }
        throw new Error('Failed to fetch prototype')
      }

      const protoData = await protoResponse.json()
      setPrototype({
        id: protoData.id,
        title: protoData.title,
        production_stage: protoData.production_stage,
      })

      // Fetch history
      const historyResponse = await fetch(`/api/prototypes/${params.id}/history`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (historyResponse.ok) {
        const historyData = await historyResponse.json()
        setHistory(historyData || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      showNotification('error', 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, showNotification])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Dev': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'QA': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'Pilot': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'Production': return 'bg-green-500/20 text-green-400 border-green-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const getStageIndex = (stage: string) => {
    return PRODUCTION_STAGES.indexOf(stage)
  }

  const isProgression = (oldStage: string | null, newStage: string) => {
    if (!oldStage) return true
    return getStageIndex(newStage) > getStageIndex(oldStage)
  }

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin" size={24} />
            <span>Loading history...</span>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white">
        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${
                notification.type === 'success' 
                  ? 'bg-green-600' 
                  : notification.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <Breadcrumbs items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Content Management', href: '/admin/content' },
              { label: 'Prototypes', href: '/admin/content/prototypes' },
              { label: prototype?.title || 'Edit', href: `/admin/content/prototypes/${params.id}` },
              { label: 'Stage History' }
            ]} />

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Link 
                href={`/admin/content/prototypes/${params.id}`}
                className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-3xl font-bold">Stage History</h1>
                <p className="text-gray-400 text-sm mt-1">
                  {prototype?.title} • Currently in <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStageColor(prototype?.production_stage || '')}`}>{prototype?.production_stage}</span>
                </p>
              </div>
            </div>

            {/* Current Stage Pipeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8"
            >
              <h2 className="text-lg font-semibold mb-4">Stage Pipeline</h2>
              <div className="flex items-center justify-between">
                {PRODUCTION_STAGES.map((stage, index) => {
                  const isActive = prototype?.production_stage === stage
                  const isPast = getStageIndex(prototype?.production_stage || '') > index
                  
                  return (
                    <div key={stage} className="flex items-center">
                      <div className={`flex flex-col items-center ${index > 0 ? 'ml-4' : ''}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                          isActive 
                            ? `${getStageColor(stage)} border-current` 
                            : isPast
                            ? 'bg-gray-700 border-gray-600 text-gray-400'
                            : 'bg-gray-800 border-gray-700 text-gray-500'
                        }`}>
                          {isPast ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <span className="text-sm font-bold">{index + 1}</span>
                          )}
                        </div>
                        <span className={`text-xs mt-2 ${isActive ? 'text-white font-semibold' : 'text-gray-500'}`}>
                          {stage}
                        </span>
                      </div>
                      {index < PRODUCTION_STAGES.length - 1 && (
                        <div className={`w-16 h-0.5 mx-2 ${
                          isPast ? 'bg-gray-600' : 'bg-gray-800'
                        }`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* History Timeline */}
            {history.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                  <Clock size={32} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No history yet</h3>
                <p className="text-gray-500">Stage changes will be recorded here automatically</p>
              </motion.div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-800" />

                {/* History entries */}
                <div className="space-y-6">
                  {history.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative flex gap-4"
                    >
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                        isProgression(entry.old_stage, entry.new_stage)
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-orange-500/20 border-orange-500/50'
                      }`}>
                        {isProgression(entry.old_stage, entry.new_stage) ? (
                          <ArrowRight size={20} className="text-green-400" />
                        ) : (
                          <ArrowLeft size={20} className="text-orange-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          {entry.old_stage ? (
                            <>
                              <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStageColor(entry.old_stage)}`}>
                                {entry.old_stage}
                              </span>
                              <ArrowRight size={16} className="text-gray-500" />
                            </>
                          ) : (
                            <span className="text-gray-500 text-sm">Started in</span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStageColor(entry.new_stage)}`}>
                            {entry.new_stage}
                          </span>
                        </div>

                        {entry.change_reason && (
                          <div className="flex items-start gap-2 mb-3 p-2 bg-gray-800/50 rounded-lg">
                            <MessageSquare size={14} className="text-gray-400 mt-0.5" />
                            <p className="text-sm text-gray-300">{entry.change_reason}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{new Date(entry.changed_at).toLocaleString()}</span>
                          </div>
                          {entry.changed_by_profile?.email && (
                            <div className="flex items-center gap-1">
                              <User size={12} />
                              <span>{entry.changed_by_profile.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Help text */}
            <p className="text-center text-gray-500 text-sm mt-8">
              Stage history is automatically recorded when you change the production stage
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
