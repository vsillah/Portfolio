'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { 
  Bug, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  Code,
  MessageSquare,
  Loader2,
  Check,
  X,
  Save,
  Play,
  FileText,
  AlertTriangle,
  Sparkles
} from 'lucide-react'
import { getPromptDisplayName } from '@/lib/constants/prompt-keys'

interface Recommendation {
  id: string
  type: 'prompt' | 'code'
  priority: 'high' | 'medium' | 'low'
  description: string
  changes: {
    target: string
    old_value?: string
    new_value: string
    can_auto_apply: boolean
  }
  application_instructions?: string
  approved?: boolean
}

interface Diagnosis {
  id: string
  session_id: string
  root_cause: string
  error_type: 'prompt' | 'code' | 'both' | 'unknown'
  confidence_score: number
  diagnosis_details: {
    prompt_issues?: string[]
    code_issues?: string[]
    context_clues?: string[]
  }
  recommendations: Recommendation[]
  status: 'pending' | 'reviewed' | 'approved' | 'applied' | 'rejected'
  applied_changes?: any
  application_method?: 'auto' | 'manual' | 'partial'
  application_instructions?: string
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

export default function DiagnosisDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DiagnosisDetailContent />
    </ProtectedRoute>
  )
}

function DiagnosisDetailContent() {
  const router = useRouter()
  const params = useParams()
  const diagnosisId = params.id as string
  
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [appliedPromptKeys, setAppliedPromptKeys] = useState<string[]>([])
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set())
  const [showDiff, setShowDiff] = useState<Record<string, boolean>>({})

  const fetchDiagnosis = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/chat-eval/diagnoses/${diagnosisId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDiagnosis(data.diagnosis)
        
        // Pre-select approved recommendations
        const approved = data.diagnosis.recommendations
          ?.filter((rec: Recommendation) => rec.approved)
          .map((rec: Recommendation) => rec.id) || []
        setSelectedRecommendations(new Set(approved))
      } else if (response.status === 404) {
        router.push('/admin/chat-eval/diagnoses')
      }
    } catch (error) {
      console.error('Error fetching diagnosis:', error)
    } finally {
      setLoading(false)
    }
  }, [diagnosisId, router])

  useEffect(() => {
    fetchDiagnosis()
  }, [fetchDiagnosis])

  const handleApprove = async () => {
    setSaving(true)
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/chat-eval/diagnoses/${diagnosisId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          recommendation_ids: Array.from(selectedRecommendations),
        }),
      })

      if (response.ok) {
        await fetchDiagnosis()
      }
    } catch (error) {
      console.error('Error approving diagnosis:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/chat-eval/diagnoses/${diagnosisId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          recommendation_ids: Array.from(selectedRecommendations),
          auto_apply: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        await fetchDiagnosis()
        const promptKeysApplied: string[] = (data.applied || [])
          .filter((a: { changes?: { target?: string } }) => a.changes?.target)
          .map((a: { changes: { target: string } }) => a.changes.target)
        const promptKeysUnique = [...new Set(promptKeysApplied)]
        const successMsg = data.instructions?.length
          ? `Applied ${data.applied.length} fixes. ${data.instructions.length} require manual steps.`
          : `Applied ${data.applied.length} fixes.`
        alert(
          promptKeysUnique.length > 0
            ? `${successMsg}\n\nYou can view the updated prompt(s) in Admin → System Prompts.`
            : successMsg
        )
        if (promptKeysUnique.length > 0) {
          setAppliedPromptKeys(promptKeysUnique)
        }
      }
    } catch (error) {
      console.error('Error applying fixes:', error)
      alert('Error applying fixes. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const toggleRecommendation = (recId: string) => {
    setSelectedRecommendations(prev => {
      const next = new Set(prev)
      if (next.has(recId)) {
        next.delete(recId)
      } else {
        next.add(recId)
      }
      return next
    })
  }

  const toggleDiff = (recId: string) => {
    setShowDiff(prev => ({
      ...prev,
      [recId]: !prev[recId],
    }))
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-400 bg-red-500/20 border-red-500/30'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      case 'low':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30'
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-red-400" />
      </div>
    )
  }

  if (!diagnosis) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-heading mb-4">Diagnosis Not Found</h1>
          <button
            onClick={() => router.push('/admin/chat-eval/diagnoses')}
            className="text-radiant-gold hover:underline"
          >
            Back to Diagnoses
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-5xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval', href: '/admin/chat-eval' },
          { label: 'Error Diagnoses', href: '/admin/chat-eval/diagnoses' },
          { label: 'Diagnosis Detail' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bug size={32} className="text-red-400" />
            <h1 className="text-3xl font-heading tracking-wider">Error Diagnosis</h1>
          </div>
          <p className="text-platinum-white/60">
            Review root cause analysis and apply recommended fixes
          </p>
        </div>

        {/* Status badge */}
        <div className="mb-6">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
            diagnosis.status === 'pending' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' :
            diagnosis.status === 'approved' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
            diagnosis.status === 'applied' ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' :
            'bg-gray-500/20 border-gray-500/30 text-gray-400'
          }`}>
            {diagnosis.status.charAt(0).toUpperCase() + diagnosis.status.slice(1)}
          </span>
        </div>

        {/* Root Cause */}
        <div className="mb-8 p-5 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-400" />
            Root Cause
          </h2>
          <p className="text-platinum-white/80 leading-relaxed">
            {diagnosis.root_cause}
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-platinum-white/50">
            <span>Error Type: <span className="text-platinum-white">{diagnosis.error_type}</span></span>
            <span>•</span>
            <span>Confidence: <span className="text-platinum-white">{Math.round(diagnosis.confidence_score * 100)}%</span></span>
            <span>•</span>
            <span>Model: {diagnosis.model_used}</span>
          </div>
        </div>

        {/* Diagnosis Details */}
        {(diagnosis.diagnosis_details.prompt_issues?.length || 
          diagnosis.diagnosis_details.code_issues?.length ||
          diagnosis.diagnosis_details.context_clues?.length) && (
          <div className="mb-8 p-5 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
            <h3 className="text-md font-semibold mb-3">Diagnosis Details</h3>
            {(diagnosis.diagnosis_details.prompt_issues?.length ?? 0) > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium text-cyan-400 mb-1">Prompt Issues:</h4>
                <ul className="list-disc list-inside text-sm text-platinum-white/70 space-y-1">
                  {diagnosis.diagnosis_details.prompt_issues?.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {(diagnosis.diagnosis_details.code_issues?.length ?? 0) > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium text-orange-400 mb-1">Code Issues:</h4>
                <ul className="list-disc list-inside text-sm text-platinum-white/70 space-y-1">
                  {diagnosis.diagnosis_details.code_issues?.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {(diagnosis.diagnosis_details.context_clues?.length ?? 0) > 0 && (
              <div>
                <h4 className="text-sm font-medium text-purple-400 mb-1">Context Clues:</h4>
                <ul className="list-disc list-inside text-sm text-platinum-white/70 space-y-1">
                  {diagnosis.diagnosis_details.context_clues?.map((clue, i) => (
                    <li key={i}>{clue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading flex items-center gap-2">
              <Sparkles size={24} className="text-purple-400" />
              Recommendations ({diagnosis.recommendations?.length || 0})
            </h2>
            {diagnosis.status === 'pending' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedRecommendations(new Set(diagnosis.recommendations?.map((r: Recommendation) => r.id) || []))}
                  className="text-sm text-platinum-white/60 hover:text-platinum-white"
                >
                  Select All
                </button>
                <span className="text-platinum-white/40">|</span>
                <button
                  onClick={() => setSelectedRecommendations(new Set())}
                  className="text-sm text-platinum-white/60 hover:text-platinum-white"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {diagnosis.recommendations?.map((rec, index) => (
              <motion.div
                key={rec.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-5 rounded-xl border transition-all ${
                  selectedRecommendations.has(rec.id || `rec_${index}`)
                    ? 'bg-radiant-gold/10 border-radiant-gold/50'
                    : 'bg-silicon-slate/20 border-radiant-gold/10'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox for selection */}
                  {diagnosis.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedRecommendations.has(rec.id || `rec_${index}`)}
                      onChange={() => toggleRecommendation(rec.id || `rec_${index}`)}
                      className="mt-1 w-5 h-5 rounded border-radiant-gold/30 bg-silicon-slate/50"
                    />
                  )}

                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {rec.type === 'prompt' ? (
                          <MessageSquare size={18} className="text-cyan-400" />
                        ) : (
                          <Code size={18} className="text-orange-400" />
                        )}
                        <h3 className="text-lg font-semibold">{rec.description}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(rec.priority)}`}>
                          {rec.priority}
                        </span>
                      </div>
                    </div>

                    {/* Target */}
                    <div className="mb-3 text-sm">
                      <span className="text-platinum-white/50">Target: </span>
                      <span className="text-platinum-white font-mono">{rec.changes.target}</span>
                    </div>

                    {/* Diff view */}
                    <div className="mb-3">
                      <button
                        onClick={() => toggleDiff(rec.id || `rec_${index}`)}
                        className="text-sm text-radiant-gold hover:underline flex items-center gap-1"
                      >
                        {showDiff[rec.id || `rec_${index}`] ? 'Hide' : 'Show'} Changes
                      </button>
                      {showDiff[rec.id || `rec_${index}`] && (
                        <div className="mt-2 p-3 bg-imperial-navy rounded border border-radiant-gold/20">
                          {rec.changes.old_value && (
                            <div className="mb-2">
                              <div className="text-xs text-red-400 mb-1">Old Value:</div>
                              <pre className="text-xs text-platinum-white/70 bg-red-500/10 p-2 rounded overflow-x-auto">
                                {rec.changes.old_value}
                              </pre>
                            </div>
                          )}
                          <div>
                            <div className="text-xs text-emerald-400 mb-1">New Value:</div>
                            <pre className="text-xs text-platinum-white/70 bg-emerald-500/10 p-2 rounded overflow-x-auto">
                              {rec.changes.new_value}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Auto-apply indicator */}
                    {rec.changes.can_auto_apply && (
                      <div className="mb-3 flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle size={12} />
                        Can be auto-applied
                      </div>
                    )}

                    {/* Manual instructions */}
                    {rec.application_instructions && (
                      <div className="mt-3 p-3 bg-silicon-slate/30 rounded border border-radiant-gold/10">
                        <div className="text-xs text-platinum-white/50 mb-1">Manual Instructions:</div>
                        <div className="text-sm text-platinum-white/80 whitespace-pre-wrap">
                          {rec.application_instructions}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {diagnosis.status === 'pending' && (
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApprove}
              disabled={saving || selectedRecommendations.size === 0}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 
                disabled:bg-emerald-600/50 disabled:cursor-not-allowed rounded-lg text-white font-medium"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              Approve Selected ({selectedRecommendations.size})
            </motion.button>
          </div>
        )}

        {diagnosis.status === 'approved' && (
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 
                disabled:bg-purple-600/50 rounded-lg text-white font-medium"
            >
              {applying ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Apply Fixes
            </motion.button>
          </div>
        )}

        {/* Applied changes info */}
        {diagnosis.status === 'applied' && diagnosis.applied_changes && (
          <div className="mt-8 p-5 bg-purple-500/10 border border-purple-500/30 rounded-xl">
            <h3 className="text-md font-semibold text-purple-400 mb-2">Applied Changes</h3>
            <p className="text-sm text-platinum-white/70">
              Application method: {diagnosis.application_method || 'unknown'}
            </p>
            {diagnosis.application_instructions && (
              <div className="mt-3">
                <div className="text-xs text-platinum-white/50 mb-1">Manual Steps:</div>
                <div className="text-sm text-platinum-white/80 whitespace-pre-wrap">
                  {diagnosis.application_instructions}
                </div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-purple-500/20">
              <p className="text-sm text-platinum-white/80 mb-2">
                Prompt changes are saved to the same prompts used by the chatbot and admin. View or edit them here:
              </p>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/admin/prompts')}
                  className="px-4 py-2 bg-silicon-slate/50 border border-radiant-gold/30 rounded-lg text-sm text-radiant-gold hover:bg-silicon-slate/70 transition-colors"
                >
                  Open System Prompts
                </motion.button>
                {[...new Set(appliedPromptKeys.length > 0 ? appliedPromptKeys : ['chatbot', 'voice_agent'])].map((key) => (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/admin/prompts/${key}`)}
                    className="px-4 py-2 bg-silicon-slate/50 border border-platinum-white/20 rounded-lg text-sm text-platinum-white/90 hover:bg-silicon-slate/70 transition-colors"
                  >
                    View {getPromptDisplayName(key)} prompt
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Back button */}
        <div className="mt-8">
          <button
            onClick={() => router.push('/admin/chat-eval/diagnoses')}
            className="text-platinum-white/60 hover:text-platinum-white transition-colors"
          >
            ← Back to All Diagnoses
          </button>
        </div>
      </div>
    </div>
  )
}
