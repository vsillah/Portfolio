'use client'

import { useState, useEffect } from 'react'
import { Star, Send, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

interface Feedback {
  id: string
  feedback_text: string
  rating: number | null
  user_id: string
  created_at: string
  user_email?: string
}

interface PrototypeFeedbackProps {
  prototypeId: string
  stage: 'Dev' | 'QA' | 'Pilot' | 'Production'
  user: any
  userEnrollment: string | null
}

export default function PrototypeFeedback({
  prototypeId,
  stage,
  user,
  userEnrollment,
}: PrototypeFeedbackProps) {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newFeedback, setNewFeedback] = useState('')
  const [rating, setRating] = useState(0)
  const [error, setError] = useState('')

  const isProduction = stage === 'Production'
  const isPilotWithEnrollment = stage === 'Pilot' && userEnrollment === 'Pilot'
  const canSubmitFeedback = isProduction || isPilotWithEnrollment

  useEffect(() => {
    if (isProduction || isPilotWithEnrollment) {
      fetchFeedback()
    }
  }, [prototypeId, stage, userEnrollment, isProduction, isPilotWithEnrollment])

  const fetchFeedback = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/prototypes/${prototypeId}/feedback`)
      if (!response.ok) throw new Error('Failed to fetch feedback')
      
      const data = await response.json()
      setFeedbackList(data)
    } catch (err: any) {
      console.error('Error fetching feedback:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!canSubmitFeedback) {
      setError('You must be a pilot user or production user to submit feedback')
      return
    }

    if (!newFeedback.trim()) {
      setError('Please enter your feedback')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`/api/prototypes/${prototypeId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback_text: newFeedback.trim(),
          rating: rating || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setNewFeedback('')
      setRating(0)
      fetchFeedback()
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canSubmitFeedback) {
    const message = isProduction 
      ? 'You must be logged in to submit feedback.'
      : 'You must be enrolled in the pilot program to view and submit feedback.'
    
    return (
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg text-gray-400 text-sm">
        <AlertCircle className="inline mr-2" size={16} />
        {message}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Feedback Form */}
      {canSubmitFeedback && user && (
        <form onSubmit={handleSubmitFeedback} className="p-4 bg-gray-800/50 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Your Feedback {rating > 0 && `(${rating}/5)`}
            </label>
            <textarea
              value={newFeedback}
              onChange={(e) => setNewFeedback(e.target.value)}
              placeholder="Share your thoughts about this prototype..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              rows={3}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Rating (Optional)
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`p-1 transition-colors ${
                    value <= rating
                      ? 'text-yellow-400'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                  disabled={submitting}
                >
                  <Star size={24} fill={value <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !newFeedback.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Feedback
              </>
            )}
          </button>
        </form>
      )}

      {/* Feedback List */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-3">
          Customer Feedback {feedbackList.length > 0 && `(${feedbackList.length})`}
        </h4>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading feedback...</div>
        ) : feedbackList.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {stage === 'Production' 
              ? 'No feedback yet. Be the first to share your thoughts!'
              : 'No feedback yet.'}
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {feedbackList.map((feedback) => (
              <div key={feedback.id} className="p-4 bg-gray-800/50 rounded-lg">
                {feedback.rating && (
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Star
                        key={value}
                        size={16}
                        className={value <= (feedback.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-600'}
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-300 mb-2">{feedback.feedback_text}</p>
                <p className="text-xs text-gray-500">
                  {new Date(feedback.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
