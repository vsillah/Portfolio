'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Tag } from 'lucide-react'
import { createTimer } from '@/lib/exitIntent'
import { useRouter } from 'next/navigation'

interface TimeBasedPopupProps {
  delay?: number // Milliseconds before showing
  discountAmount?: number
  onApplyDiscount?: () => void
  appliedDiscountCode?: string | null
}

export default function TimeBasedPopup({
  delay = 30000, // 30 seconds default
  discountAmount = 10,
  onApplyDiscount,
  appliedDiscountCode,
}: TimeBasedPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasShown, setHasShown] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Don't show if discount already applied
    if (appliedDiscountCode) {
      return
    }
    
    if (hasShown) return

    // Check if already shown in this session
    if (typeof window !== 'undefined') {
      const shown = sessionStorage.getItem('timeBasedPopupShown')
      if (shown === 'true') {
        setHasShown(true)
        return
      }
    }

    const cleanup = createTimer(() => {
      if (!hasShown && !appliedDiscountCode) {
        setIsOpen(true)
        setHasShown(true)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('timeBasedPopupShown', 'true')
        }
      }
    }, delay)

    return cleanup
  }, [delay, hasShown, appliedDiscountCode])

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleApplyDiscount = () => {
    if (onApplyDiscount) {
      onApplyDiscount()
    }
    setIsOpen(false)
    // Only navigate to checkout if not already there (avoids resetting page state)
    if (!window.location.pathname.startsWith('/checkout')) {
      router.push('/checkout')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 z-40"
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-900 border-2 border-blue-500 rounded-2xl p-8 max-w-md w-full relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-full mb-4">
                  <Clock className="text-blue-400" size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Limited Time Offer!</h2>
                <p className="text-gray-400">
                  Get {discountAmount}% off when you complete your purchase in the next few minutes
                </p>
              </div>

              <div className="bg-blue-600/20 border border-blue-600/50 rounded-lg p-4 mb-6 text-center">
                <p className="text-3xl font-bold text-blue-400">{discountAmount}% OFF</p>
                <p className="text-sm text-gray-400 mt-1">Your entire order</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleApplyDiscount}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
                >
                  Claim {discountAmount}% Discount
                </button>
                <button
                  onClick={handleClose}
                  className="w-full px-6 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:border-gray-600 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
