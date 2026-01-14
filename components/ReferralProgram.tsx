'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Copy, CheckCircle, Gift } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface Referral {
  id: number
  referral_code: string
  referred_email: string | null
  discount_applied: number
  created_at: string
}

interface ReferralProgramProps {
  userId?: string
}

export default function ReferralProgram({ userId }: ReferralProgramProps) {
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchReferralCode()
      fetchReferrals()
    }
  }, [userId])

  const fetchReferralCode = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/referrals/code', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setReferralCode(data.referralCode)
      }
    } catch (error) {
      console.error('Failed to fetch referral code:', error)
    }
  }

  const fetchReferrals = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/referrals', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setReferrals(data.referrals || [])
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (referralCode) {
      navigator.clipboard.writeText(referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const referralUrl = referralCode
    ? `${window.location.origin}/store?ref=${referralCode}`
    : ''

  const totalDiscountEarned = referrals.reduce(
    (sum, ref) => sum + (ref.discount_applied || 0),
    0
  )

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-purple-400" size={24} />
        <h3 className="text-xl font-bold">Referral Program</h3>
      </div>

      <p className="text-gray-400 mb-6 text-sm">
        Share your referral code with friends and earn discounts when they make a purchase!
      </p>

      {referralCode ? (
        <div className="space-y-4">
          {/* Referral Code */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Your Referral Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralCode}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500 transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle size={18} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Referral URL */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Referral Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralUrl}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500 transition-colors"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="text-blue-400" size={20} />
                <span className="text-sm text-gray-400">Referrals</span>
              </div>
              <p className="text-2xl font-bold text-white">{referrals.length}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="text-green-400" size={20} />
                <span className="text-sm text-gray-400">Discount Earned</span>
              </div>
              <p className="text-2xl font-bold text-white">${totalDiscountEarned.toFixed(2)}</p>
            </div>
          </div>

          {/* Recent Referrals */}
          {referrals.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Recent Referrals</h4>
              <div className="space-y-2">
                {referrals.slice(0, 5).map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-2 bg-gray-800 rounded text-sm"
                  >
                    <span className="text-gray-300">
                      {referral.referred_email || 'Anonymous'}
                    </span>
                    <span className="text-green-400 font-semibold">
                      ${referral.discount_applied.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          {loading ? 'Loading...' : 'No referral code available'}
        </div>
      )}
    </div>
  )
}
