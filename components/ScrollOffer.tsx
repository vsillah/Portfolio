'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Tag } from 'lucide-react'
import { detectScrollPercentage } from '@/lib/exitIntent'
import { useRouter } from 'next/navigation'

const CHECKOUT_POPUP_SESSION_KEY = 'checkoutDiscountPopupShown'

interface ScrollOfferProps {
  scrollThreshold?: number // Percentage of page scrolled
  discountAmount?: number
  onApplyDiscount?: () => void
  appliedDiscountCode?: string | null
  /** When false, never show (e.g. cart is free-only) */
  showDiscountPopups?: boolean
}

export default function ScrollOffer({
  scrollThreshold = 60,
  discountAmount = 15,
  onApplyDiscount,
  appliedDiscountCode,
  showDiscountPopups = true,
}: ScrollOfferProps) {
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
    if (typeof window !== 'undefined' && sessionStorage.getItem(CHECKOUT_POPUP_SESSION_KEY) === 'true') return

    const cleanup = detectScrollPercentage((percentage) => {
      if (percentage < scrollThreshold || isOpen || hasShown) return
      if (typeof window !== 'undefined' && sessionStorage.getItem(CHECKOUT_POPUP_SESSION_KEY) === 'true') return
      sessionStorage.setItem(CHECKOUT_POPUP_SESSION_KEY, 'true')
      setIsOpen(true)
      setHasShown(true)
    })

    return cleanup
  }, [scrollThreshold, isOpen, hasShown, appliedDiscountCode, showDiscountPopups])

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-4"
        >
          <div className="max-w-md mx-auto bg-gradient-to-r from-bronze to-radiant-gold rounded-xl p-6 shadow-2xl">
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 text-imperial-navy/70 hover:text-imperial-navy transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Tag className="text-imperial-navy" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-imperial-navy mb-1">
                  Special Offer: {discountAmount}% Off!
                </h3>
                <p className="text-imperial-navy/90 text-sm mb-3">
                  Complete your purchase now and save
                </p>
                <button
                  onClick={handleApplyDiscount}
                  className="px-4 py-2 bg-imperial-navy/90 text-radiant-gold font-semibold rounded-lg hover:bg-imperial-navy transition-colors text-sm border border-imperial-navy"
                >
                  Claim Discount
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
