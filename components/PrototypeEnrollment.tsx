'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface PrototypeEnrollmentProps {
  prototypeId: string
  stage: 'Dev' | 'QA' | 'Pilot' | 'Production'
  user: any
  currentEnrollment: string | null
  onSuccess: (enrollmentType?: string) => void
}

export default function PrototypeEnrollment({
  prototypeId,
  stage,
  user,
  currentEnrollment,
  onSuccess,
}: PrototypeEnrollmentProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const getButtonText = () => {
    if (currentEnrollment) {
      return 'Already Enrolled'
    }
    switch (stage) {
      case 'Dev':
      case 'QA':
        return 'Join Waitlist'
      case 'Pilot':
        return 'Join Pilot Program'
      case 'Production':
        return 'Express Interest for Custom Install'
      default:
        return 'Enroll'
    }
  }

  const getEnrollmentType = () => {
    switch (stage) {
      case 'Dev':
      case 'QA':
        return 'Waitlist'
      case 'Pilot':
        return 'Pilot'
      case 'Production':
        return 'Production-Interest'
      default:
        return 'Waitlist'
    }
  }

  const handleEnroll = async () => {
    if (!user) {
      setError('Please log in to enroll')
      return
    }

    if (currentEnrollment) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Get the session to retrieve the access token
      const session = await getCurrentSession()
      
      if (!session?.access_token) {
        throw new Error('Session expired. Please log in again.')
      }
      
      const response = await fetch('/api/prototypes/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prototypeId,
          enrollmentType: getEnrollmentType(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enroll')
      }

      setSuccess(true)
      onSuccess(getEnrollmentType())
      
      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to enroll')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
      >
        Log in to {getButtonText()}
      </a>
    )
  }

  if (currentEnrollment || success) {
    return (
      <div className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg">
        <CheckCircle2 size={18} />
        <span>{getButtonText()}</span>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Enrolling...
          </>
        ) : (
          getButtonText()
        )}
      </button>
      {error && (
        <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </div>
  )
}
