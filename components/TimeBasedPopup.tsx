'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Tag } from 'lucide-react'
import { createTimer } from '@/lib/exitIntent'
import { useRouter } from 'next/navigation'

const CHECKOUT_POPUP_SESSION_KEY = 'checkoutDiscountPopupShown'

interface TimeBasedPopupProps {
  delay?: number // Milliseconds before showing
  discountAmount?: number
  onApplyDiscount?: () => void
  appliedDiscountCode?: string | null
  /** When false, never show (e.g. cart is free-only) */
  showDiscountPopups?: boolean
}

export default function TimeBasedPopup({
  delay = 30000, // 30 seconds default
  discountAmount = 10,
  onApplyDiscount,
  appliedDiscountCode,
  showDiscountPopups = true,
}: TimeBasedPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasShown, setHasShown] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Don't show if discount already applied
    if (appliedDiscountCode) return
    // Don't show for free-only carts
    if (!showDiscountPopups) return
    if (hasShown) return
    // Only one discount popup per session
    if (typeof window !== 'undefined' && sessionStorage.getItem(CHECKOUT_POPUP_SESSION_KEY) === 'true') {
      setHasShown(true)
      return
    }
    if (typeof window !== 'undefined' && sessionStorage.getItem('timeBasedPopupShown') === 'true') {
      setHasShown(true)
      return
    }

    const cleanup = createTimer(() => {
      if (hasShown) return
      if (typeof window !== 'undefined' && sessionStorage.getItem(CHECKOUT_POPUP_SESSION_KEY) === 'true') return
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(CHECKOUT_POPUP_SESSION_KEY, 'true')
        sessionStorage.setItem('timeBasedPopupShown', 'true')
      }
      setIsOpen(true)
      setHasShown(true)
    }, delay)

    return cleanup
  }, [delay, hasShown, appliedDiscountCode, showDiscountPopups])

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
            <div className="bg-silicon-slate border-2 border-radiant-gold rounded-2xl p-8 max-w-md w-full relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-platinum-white/80 hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-radiant-gold/20 rounded-full mb-4">
                  <Clock className="text-radiant-gold" size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Limited Time Offer!</h2>
                <p className="text-platinum-white/80">
                  Get {discountAmount}% off when you complete your purchase in the next few minutes
                </p>
              </div>

              <div className="bg-radiant-gold/20 border border-radiant-gold/50 rounded-lg p-4 mb-6 text-center">
                <p className="text-3xl font-bold text-radiant-gold">{discountAmount}% OFF</p>
                <p className="text-sm text-platinum-white/80 mt-1">Your entire order</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleApplyDiscount}
                  className="btn-gold w-full px-6 py-3 font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  Claim {discountAmount}% Discount
                </button>
                <button
                  onClick={handleClose}
                  className="w-full px-6 py-2 btn-ghost rounded-lg transition-colors"
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
