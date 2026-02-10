'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Tag, ShoppingCart } from 'lucide-react'
import { detectExitIntent } from '@/lib/exitIntent'
import { useRouter } from 'next/navigation'

interface ExitIntentPopupProps {
  discountCode?: string
  discountAmount?: number
  onApplyDiscount?: () => void
  appliedDiscountCode?: string | null
}

export default function ExitIntentPopup({
  discountCode,
  discountAmount = 20,
  onApplyDiscount,
  appliedDiscountCode,
}: ExitIntentPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasShown, setHasShown] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Don't show if discount already applied
    if (appliedDiscountCode) {
      return
    }
    
    // Check if already shown in this session
    if (typeof window !== 'undefined') {
      const shown = sessionStorage.getItem('exitIntentShown')
      if (shown === 'true') {
        setHasShown(true)
        return
      }
    }

    const cleanup = detectExitIntent(() => {
      if (!hasShown && !isOpen && !appliedDiscountCode) {
        setIsOpen(true)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('exitIntentShown', 'true')
        }
      }
    })

    return cleanup
  }, [hasShown, isOpen, appliedDiscountCode])

  const handleClose = () => {
    setIsOpen(false)
  }

  const handleApplyDiscount = () => {
    if (onApplyDiscount) {
      onApplyDiscount()
    }
    setIsOpen(false)
    router.push('/checkout')
  }

  const handleContinueShopping = () => {
    setIsOpen(false)
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
            className="fixed inset-0 bg-black/80 z-50"
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-900 border-2 border-purple-500 rounded-2xl p-8 max-w-md w-full relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600/20 rounded-full mb-4">
                  <Tag className="text-purple-400" size={32} />
                </div>
                <h2 className="text-3xl font-bold mb-2">Wait! Don't Go Yet!</h2>
                <p className="text-gray-400">
                  Get {discountAmount}% off your order when you checkout now!
                </p>
              </div>

              {discountCode && (
                <div className="bg-purple-600/20 border border-purple-600/50 rounded-lg p-4 mb-6 text-center">
                  <p className="text-sm text-gray-400 mb-1">Use code:</p>
                  <p className="text-2xl font-bold text-purple-400">{discountCode}</p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleApplyDiscount}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  Apply Discount & Checkout
                </button>
                <button
                  onClick={handleContinueShopping}
                  className="w-full px-6 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg hover:border-gray-600 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
