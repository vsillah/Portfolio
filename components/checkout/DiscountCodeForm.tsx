'use client'

import { useState } from 'react'
import { Tag, X, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/pricing-model'

interface DiscountCodeFormProps {
  onApply: (code: string) => Promise<{ success: boolean; discount?: number; error?: string }>
  appliedCode?: string | null
  discountAmount?: number
  onRemove: () => void
}

export default function DiscountCodeForm({
  onApply,
  appliedCode,
  discountAmount,
  onRemove,
}: DiscountCodeFormProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await onApply(code.trim().toUpperCase())
      if (result.success) {
        setCode('')
      } else {
        setError(result.error || 'Invalid discount code')
      }
    } catch (err) {
      setError('Failed to apply discount code')
    } finally {
      setLoading(false)
    }
  }

  if (appliedCode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="p-4 bg-green-600/20 border border-green-600/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="text-green-400" size={20} />
              <div>
                <p className="text-sm text-green-400 font-semibold">
                  Code {appliedCode} applied
                </p>
                {discountAmount !== undefined && discountAmount > 0 && (
                  <p className="text-xs text-gray-400">
                    Discount: {formatCurrency(discountAmount)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Remove discount code"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 italic">
          Only one discount code can be applied per order
        </p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm font-medium">
        Discount Code
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setError(null)
            }}
            className={`w-full pl-10 pr-4 py-2 bg-gray-800 border ${
              error ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white focus:outline-none focus:border-purple-500`}
            placeholder="Enter code"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="px-6 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-semibold hover:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-red-400"
        >
          {error}
        </motion.p>
      )}
    </form>
  )
}
