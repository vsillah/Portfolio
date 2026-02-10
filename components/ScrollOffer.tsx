'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Tag } from 'lucide-react'
import { detectScrollPercentage } from '@/lib/exitIntent'
import { useRouter } from 'next/navigation'

interface ScrollOfferProps {
  scrollThreshold?: number // Percentage of page scrolled
  discountAmount?: number
  onApplyDiscount?: () => void
  appliedDiscountCode?: string | null
}

export default function ScrollOffer({
  scrollThreshold = 60,
  discountAmount = 15,
  onApplyDiscount,
  appliedDiscountCode,
}: ScrollOfferProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasShown, setHasShown] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Don't show if discount already applied
    if (appliedDiscountCode) {
      return
    }
    
    if (hasShown) return

    const cleanup = detectScrollPercentage((percentage) => {
      if (percentage >= scrollThreshold && !isOpen && !hasShown && !appliedDiscountCode) {
        setIsOpen(true)
        setHasShown(true)
      }
    })

    return cleanup
  }, [scrollThreshold, isOpen, hasShown, appliedDiscountCode])

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
          <div className="max-w-md mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 shadow-2xl">
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Tag className="text-white" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-1">
                  Special Offer: {discountAmount}% Off!
                </h3>
                <p className="text-white/90 text-sm mb-3">
                  Complete your purchase now and save
                </p>
                <button
                  onClick={handleApplyDiscount}
                  className="px-4 py-2 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-sm"
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
