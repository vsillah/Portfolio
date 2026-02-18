'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Gift } from 'lucide-react'
import { detectExitIntent } from '@/lib/exitIntent'

interface ExitIntentPopupProps {
  /** Title text */
  title?: string
  /** Description text */
  description?: string
  /** CTA button text */
  ctaText?: string
  /** CTA action */
  onCtaClick?: () => void
  /** Email capture mode */
  captureEmail?: boolean
  /** On email submit callback */
  onEmailSubmit?: (email: string) => void
  /** Delay before popup can show (ms) */
  delay?: number
  /** Storage key to prevent showing again */
  storageKey?: string
}

export function ExitIntentPopup({
  title = "Wait! Don't leave yet",
  description = "Get exclusive access to our free resources before you go.",
  ctaText = "Get Free Access",
  onCtaClick,
  captureEmail = false,
  onEmailSubmit,
  delay = 5000,
  storageKey = 'exit_intent_shown',
}: ExitIntentPopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [hasBeenShown, setHasBeenShown] = useState(false)

  useEffect(() => {
    // Check if already shown
    if (typeof window !== 'undefined') {
      const shown = localStorage.getItem(storageKey)
      if (shown) {
        setHasBeenShown(true)
        return
      }
    }

    // Wait for delay before enabling exit intent
    const timeoutId = setTimeout(() => {
      const cleanup = detectExitIntent(() => {
        if (!hasBeenShown) {
          setIsVisible(true)
          setHasBeenShown(true)
          localStorage.setItem(storageKey, 'true')
        }
      })

      return () => cleanup()
    }, delay)

    return () => clearTimeout(timeoutId)
  }, [delay, hasBeenShown, storageKey])

  const handleClose = () => {
    setIsVisible(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (captureEmail && email) {
      onEmailSubmit?.(email)
    } else {
      onCtaClick?.()
    }
    setIsVisible(false)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>

              {/* Content */}
              <div className="p-8">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Gift className="w-8 h-8 text-blue-500" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                  {title}
                </h2>
                <p className="text-gray-600 text-center mb-6">
                  {description}
                </p>

                <form onSubmit={handleSubmit}>
                  {captureEmail && (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                    />
                  )}

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 px-6 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    {ctaText}
                  </motion.button>
                </form>

                <button
                  onClick={handleClose}
                  className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  No thanks, I'll pass
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
