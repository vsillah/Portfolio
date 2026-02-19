'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Tag, ShoppingCart } from 'lucide-react'
import { detectExitIntent } from '@/lib/exitIntent'
import { useRouter } from 'next/navigation'

const CHECKOUT_POPUP_SESSION_KEY = 'checkoutDiscountPopupShown'

interface ExitIntentPopupProps {
  discountCode?: string
  discountAmount?: number
  onApplyDiscount?: () => void
  appliedDiscountCode?: string | null
  /** When false, never show (e.g. cart is free-only) */
  showDiscountPopups?: boolean
}

export default function ExitIntentPopup({
  discountCode,
  discountAmount = 20,
  onApplyDiscount,
  appliedDiscountCode,
  showDiscountPopups = true,
}: ExitIntentPopupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasShown, setHasShown] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Don't show if discount already applied
    if (appliedDiscountCode) return
    // Don't show for free-only carts
    if (!showDiscountPopups) return
    // Only one discount popup per session (shared with ScrollOffer, TimeBasedPopup)
    if (typeof window !== 'undefined' && sessionStorage.getItem(CHECKOUT_POPUP_SESSION_KEY) === 'true') {
      setHasShown(true)
      return
    }
    // Legacy: also respect exit-intent-specific key so we don't show again if we already showed this one
    if (typeof window !== 'undefined' && sessionStorage.getItem('exitIntentShown') === 'true') {
      setHasShown(true)
      return
    }

    const cleanup = detectExitIntent(() => {
      if (hasShown || isOpen) return
      if (typeof window !== 'undefined' && sessionStorage.getItem(CHECKOUT_POPUP_SESSION_KEY) === 'true') return
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(CHECKOUT_POPUP_SESSION_KEY, 'true')
        sessionStorage.setItem('exitIntentShown', 'true')
      }
      setIsOpen(true)
    })

    return cleanup
  }, [hasShown, isOpen, appliedDiscountCode, showDiscountPopups])

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
            <div className="bg-silicon-slate border-2 border-radiant-gold rounded-2xl p-8 max-w-md w-full relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-platinum-white/80 hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-radiant-gold/20 rounded-full mb-4">
                  <Tag className="text-radiant-gold" size={32} />
                </div>
                <h2 className="text-3xl font-bold mb-2">Wait! Don&apos;t Go Yet!</h2>
                <p className="text-platinum-white/80">
                  Get {discountAmount}% off your order when you checkout now!
                </p>
              </div>

              {discountCode && (
                <div className="bg-radiant-gold/20 border border-radiant-gold/50 rounded-lg p-4 mb-6 text-center">
                  <p className="text-sm text-platinum-white/80 mb-1">Use code:</p>
                  <p className="text-2xl font-bold text-radiant-gold">{discountCode}</p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleApplyDiscount}
                  className="btn-gold w-full px-6 py-3 font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  Apply Discount & Checkout
                </button>
                <button
                  onClick={handleContinueShopping}
                  className="w-full px-6 py-2 btn-ghost rounded-lg transition-colors"
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
