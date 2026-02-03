'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  Edit3,
  ArrowRight,
  Tag,
  FileText,
  Link2,
  Loader2,
  Check,
  X,
  Save
} from 'lucide-react'

interface AxialCodeReview {
  id: string
  original_code: string
  original_description: string
  final_code: string | null
  final_description: string | null
  status: 'pending' | 'approved' | 'rejected' | 'modified'
  mapped_open_codes: string[]
  mapped_session_ids: string[]
  category_id: string | null
  category: {
    id: string
    name: string
    color: string
  } | null
  reviewed_at: string | null
}

interface Generation {
  id: string
  generated_axial_codes: any[]
  source_session_ids: string[]
  source_open_codes: string[]
  model_used: string
  prompt_version: string
  status: string
  created_at: string
}

export default function GenerationDetailPage() {
  return (
    <ProtectedRoute requireAdmin>
      <GenerationDetailContent />
    </ProtectedRoute>
  )
}

function GenerationDetailContent() {
  const router = useRouter()
  const params = useParams()
  const generationId = params.generationId as string
  
  const [generation, setGeneration] = useState<Generation | null>(null)
  const [reviews, setReviews] = useState<AxialCodeReview[]>([])
  const [reviewStats, setReviewStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)

  const fetchGeneration = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/chat-eval/axial-codes/generations/${generationId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setGeneration(data.generation)
        setReviews(data.reviews)
        setReviewStats(data.review_stats)
      } else if (response.status === 404) {
        router.push('/admin/chat-eval/axial-codes')
      }
    } catch (error) {
      console.error('Error fetching generation:', error)
    } finally {
      setLoading(false)
    }
  }, [generationId, router])

  useEffect(() => {
    fetchGeneration()
  }, [fetchGeneration])

  const handleStartEdit = (review: AxialCodeReview) => {
    setEditingId(review.id)
    setEditCode(review.final_code || review.original_code)
    setEditDescription(review.final_description || review.original_description || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditCode('')
    setEditDescription('')
  }

  const handleUpdateReview = async (reviewId: string, status: 'approved' | 'rejected' | 'modified', finalCode?: string, finalDescription?: string) => {
    setSavingId(reviewId)
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/chat-eval/axial-codes/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          status,
          final_code: finalCode,
          final_description: finalDescription,
        }),
      })

      if (response.ok) {
        // Refresh data
        await fetchGeneration()
        setEditingId(null)
      }
    } catch (error) {
      console.error('Error updating review:', error)
    } finally {
      setSavingId(null)
    }
  }

  const handlePromote = async (reviewId: string) => {
    setPromotingId(reviewId)
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/chat-eval/axial-codes/reviews/${reviewId}/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          color: '#8B5CF6', // Purple as default for axial codes
        }),
      })

      if (response.ok) {
        await fetchGeneration()
      }
    } catch (error) {
      console.error('Error promoting review:', error)
    } finally {
      setPromotingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'border-yellow-500/30 bg-yellow-500/10'
      case 'approved':
      case 'modified':
        return 'border-emerald-500/30 bg-emerald-500/10'
      case 'rejected':
        return 'border-red-500/30 bg-red-500/10'
      default:
        return 'border-gray-500/30 bg-gray-500/10'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-400" />
      </div>
    )
  }

  if (!generation) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-heading mb-4">Generation Not Found</h1>
          <button
            onClick={() => router.push('/admin/chat-eval/axial-codes')}
            className="text-radiant-gold hover:underline"
          >
            Back to Axial Codes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval', href: '/admin/chat-eval' },
          { label: 'Axial Codes', href: '/admin/chat-eval/axial-codes' },
          { label: 'Review Generation' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={32} className="text-purple-400" />
            <h1 className="text-3xl font-heading tracking-wider">Review Axial Codes</h1>
          </div>
          <p className="text-platinum-white/60">
            Review, modify, and approve generated axial codes to create new issue categories
          </p>
        </div>

        {/* Progress stats */}
        <div className="mb-8 p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-2xl font-bold text-platinum-white">{reviewStats.total}</span>
                <span className="text-sm text-platinum-white/50 ml-2">total</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-yellow-400">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  {reviewStats.pending} pending
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  {reviewStats.approved} approved
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  {reviewStats.rejected} rejected
                </span>
              </div>
            </div>
            <div className="text-xs text-platinum-white/40">
              Model: {generation.model_used}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-silicon-slate/50 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div 
                className="bg-emerald-500 transition-all"
                style={{ width: `${(reviewStats.approved / reviewStats.total) * 100}%` }}
              />
              <div 
                className="bg-red-500 transition-all"
                style={{ width: `${(reviewStats.rejected / reviewStats.total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Source info */}
        <div className="mb-6 flex items-center gap-4 text-sm text-platinum-white/60">
          <span className="flex items-center gap-1">
            <FileText size={14} />
            {generation.source_open_codes.length} source open codes
          </span>
          <span className="flex items-center gap-1">
            <Link2 size={14} />
            {generation.source_session_ids.length} sessions
          </span>
        </div>

        {/* Reviews list */}
        <div className="space-y-4">
          {reviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-5 rounded-xl border transition-all ${getStatusColor(review.status)}`}
            >
              {editingId === review.id ? (
                /* Edit mode */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-platinum-white/50 mb-1">Category Name</label>
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full px-3 py-2 bg-silicon-slate/50 border border-radiant-gold/20 rounded-lg
                        text-platinum-white focus:border-radiant-gold/50 focus:outline-none"
                      placeholder="Enter category name..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-platinum-white/50 mb-1">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-silicon-slate/50 border border-radiant-gold/20 rounded-lg
                        text-platinum-white focus:border-radiant-gold/50 focus:outline-none resize-none"
                      placeholder="Enter description..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateReview(review.id, 'modified', editCode, editDescription)}
                      disabled={savingId === review.id}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 
                        disabled:bg-emerald-600/50 rounded-lg text-white text-sm"
                    >
                      {savingId === review.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save & Approve
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate/70 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      {/* Category name */}
                      <h3 className="text-lg font-semibold text-platinum-white mb-1">
                        {review.final_code || review.original_code}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-sm text-platinum-white/70">
                        {review.final_description || review.original_description || 'No description'}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      {review.status === 'approved' || review.status === 'modified' ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                          <CheckCircle size={12} />
                          {review.status === 'modified' ? 'Modified' : 'Approved'}
                        </span>
                      ) : review.status === 'rejected' ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                          <XCircle size={12} />
                          Rejected
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Source open codes */}
                  <div className="mb-4">
                    <span className="text-xs text-platinum-white/40 block mb-2">Source Open Codes:</span>
                    <div className="flex flex-wrap gap-2">
                      {review.mapped_open_codes.map((code, i) => (
                        <span 
                          key={i}
                          className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sessions count */}
                  <div className="text-xs text-platinum-white/40 mb-4">
                    Mapped to {review.mapped_session_ids.length} sessions
                  </div>

                  {/* Actions */}
                  {review.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-3 border-t border-platinum-white/10">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUpdateReview(review.id, 'approved', review.original_code, review.original_description)}
                        disabled={savingId === review.id}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 
                          disabled:bg-emerald-600/50 rounded-lg text-white text-sm"
                      >
                        {savingId === review.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Approve
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleStartEdit(review)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
                          rounded-lg text-white text-sm"
                      >
                        <Edit3 size={14} />
                        Modify
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUpdateReview(review.id, 'rejected')}
                        disabled={savingId === review.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 
                          disabled:bg-red-600/50 rounded-lg text-white text-sm"
                      >
                        {savingId === review.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                        Reject
                      </motion.button>
                    </div>
                  )}

                  {/* Promote to category button */}
                  {(review.status === 'approved' || review.status === 'modified') && !review.category_id && (
                    <div className="pt-3 border-t border-platinum-white/10">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePromote(review.id)}
                        disabled={promotingId === review.id}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 
                          disabled:bg-purple-600/50 rounded-lg text-white text-sm"
                      >
                        {promotingId === review.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ArrowRight size={14} />
                        )}
                        Promote to Issue Category
                      </motion.button>
                    </div>
                  )}

                  {/* Already promoted indicator */}
                  {review.category && (
                    <div className="pt-3 border-t border-platinum-white/10">
                      <span className="flex items-center gap-2 text-sm text-emerald-400">
                        <Tag size={14} />
                        Added as category: 
                        <span 
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ 
                            backgroundColor: `${review.category.color}20`,
                            color: review.category.color,
                            borderColor: `${review.category.color}40`,
                            borderWidth: 1,
                          }}
                        >
                          {review.category.name}
                        </span>
                      </span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* Back button */}
        <div className="mt-8">
          <button
            onClick={() => router.push('/admin/chat-eval/axial-codes')}
            className="text-platinum-white/60 hover:text-platinum-white transition-colors"
          >
            ← Back to All Generations
          </button>
        </div>
      </div>
    </div>
  )
}
