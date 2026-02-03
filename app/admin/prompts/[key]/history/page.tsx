'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { 
  RotateCcw, 
  AlertCircle, 
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react'

interface PromptHistory {
  id: string
  version: number
  prompt: string
  config: Record<string, unknown>
  changed_at: string
  change_reason: string | null
}

interface SystemPrompt {
  id: string
  key: string
  name: string
  version: number
}

export default function PromptHistoryPage() {
  return (
    <ProtectedRoute requireAdmin>
      <PromptHistoryContent />
    </ProtectedRoute>
  )
}

function PromptHistoryContent() {
  const router = useRouter()
  const params = useParams()
  const promptKey = params.key as string

  const [prompt, setPrompt] = useState<SystemPrompt | null>(null)
  const [history, setHistory] = useState<PromptHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      
      // Fetch prompt details
      const promptResponse = await fetch(`/api/admin/prompts/${promptKey}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (!promptResponse.ok) {
        throw new Error('Failed to fetch prompt')
      }

      const promptData = await promptResponse.json()
      setPrompt(promptData.prompt)

      // Fetch history
      const historyResponse = await fetch(`/api/admin/prompts/${promptKey}/history`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (!historyResponse.ok) {
        throw new Error('Failed to fetch history')
      }

      const historyData = await historyResponse.json()
      setHistory(historyData.history || [])
    } catch (err) {
      console.error('Error fetching history:', err)
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [promptKey])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleRollback = async (version: number) => {
    if (!confirm(`Are you sure you want to rollback to version ${version}? This will create a new version with the old content.`)) {
      return
    }

    setRolling(true)
    setError(null)
    setSuccess(null)

    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/prompts/${promptKey}/history`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ version }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to rollback')
      }

      setSuccess(`Successfully rolled back to version ${version}`)
      fetchHistory() // Refresh
    } catch (err) {
      console.error('Error rolling back:', err)
      setError(err instanceof Error ? err.message : 'Failed to rollback')
    } finally {
      setRolling(false)
    }
  }

  const toggleExpand = (version: number) => {
    setExpandedVersion(expandedVersion === version ? null : version)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8 flex items-center justify-center">
        <p className="text-platinum-white/50">Loading history...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'System Prompts', href: '/admin/prompts' },
          { label: prompt?.name || promptKey, href: `/admin/prompts/${promptKey}` },
          { label: 'History' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading tracking-wider mb-2">
            Version History
          </h1>
          <p className="text-platinum-white/60">
            {prompt?.name} • Current version: {prompt?.version}
          </p>
        </div>

        {/* Status messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="text-red-400" />
            <span className="text-red-400">{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg flex items-center gap-3"
          >
            <CheckCircle className="text-emerald-400" />
            <span className="text-emerald-400">{success}</span>
          </motion.div>
        )}

        {/* History list */}
        {history.length === 0 ? (
          <div className="text-center py-12 text-platinum-white/50 bg-silicon-slate/10 rounded-xl border border-radiant-gold/10">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No version history yet</p>
            <p className="text-sm mt-2">History is created when you edit the prompt</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((h, index) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl overflow-hidden"
              >
                {/* Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-silicon-slate/30 transition-colors"
                  onClick={() => toggleExpand(h.version)}
                >
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-radiant-gold/20 text-radiant-gold rounded-full text-sm font-mono">
                      v{h.version}
                    </span>
                    <span className="text-platinum-white/60 text-sm">
                      {new Date(h.changed_at).toLocaleString()}
                    </span>
                    {h.change_reason && (
                      <span className="text-platinum-white/40 text-sm">
                        • {h.change_reason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRollback(h.version)
                      }}
                      disabled={rolling}
                      className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-lg
                        text-xs text-amber-400 hover:bg-amber-500/30 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      Rollback
                    </motion.button>
                    {expandedVersion === h.version ? (
                      <ChevronUp size={20} className="text-platinum-white/50" />
                    ) : (
                      <ChevronDown size={20} className="text-platinum-white/50" />
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {expandedVersion === h.version && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-radiant-gold/10"
                  >
                    {/* Prompt content */}
                    <div className="p-4">
                      <h4 className="text-sm font-medium text-platinum-white/70 mb-2">
                        Prompt Content
                      </h4>
                      <pre className="p-4 bg-imperial-navy/50 rounded-lg text-sm text-platinum-white/80 
                        whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                        {h.prompt}
                      </pre>
                    </div>

                    {/* Config */}
                    {h.config && Object.keys(h.config).length > 0 && (
                      <div className="p-4 border-t border-radiant-gold/10">
                        <h4 className="text-sm font-medium text-platinum-white/70 mb-2">
                          Configuration
                        </h4>
                        <pre className="p-4 bg-imperial-navy/50 rounded-lg text-sm text-platinum-white/80 
                          font-mono">
                          {JSON.stringify(h.config, null, 2)}
                        </pre>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Back button */}
        <div className="mt-8">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/admin/prompts/${promptKey}`)}
            className="px-4 py-2 bg-silicon-slate/30 border border-radiant-gold/20 rounded-lg
              text-sm hover:border-radiant-gold/40 transition-colors"
          >
            ← Back to Edit
          </motion.button>
        </div>
      </div>
    </div>
  )
}
