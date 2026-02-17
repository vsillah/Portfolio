'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Twitter, Facebook, Linkedin, Share2, CheckCircle } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface SocialShareProps {
  orderId: number
  productTitle?: string
  onShareComplete?: (platform: string, discountEarned: number) => void
}

export default function SocialShare({ orderId, productTitle, onShareComplete }: SocialShareProps) {
  const [sharedPlatforms, setSharedPlatforms] = useState<Set<string>>(new Set())
  const [sharing, setSharing] = useState<string | null>(null)

  const shareText = productTitle
    ? `Just purchased "${productTitle}"! Check it out:`
    : 'Just made a purchase! Check it out:'
  const shareUrl = `${window.location.origin}/store?ref=${orderId}`

  const handleShare = async (platform: string) => {
    if (sharedPlatforms.has(platform)) return

    setSharing(platform)

    try {
      let shareUrlToUse = shareUrl

      // Platform-specific sharing
      switch (platform) {
        case 'twitter':
          shareUrlToUse = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
          window.open(shareUrlToUse, '_blank', 'width=550,height=420')
          break

        case 'facebook':
          shareUrlToUse = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
          window.open(shareUrlToUse, '_blank', 'width=550,height=420')
          break

        case 'linkedin':
          shareUrlToUse = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
          window.open(shareUrlToUse, '_blank', 'width=550,height=420')
          break

        default:
          // Use Web Share API if available
          if (navigator.share) {
            await navigator.share({
              title: shareText,
              text: shareText,
              url: shareUrl,
            })
          }
      }

      // Track share
      const session = await getCurrentSession()
      const response = await fetch('/api/social-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          orderId,
          platform,
          shareUrl: shareUrlToUse,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSharedPlatforms(new Set([...sharedPlatforms, platform]))
        if (onShareComplete && data.discountEarned) {
          onShareComplete(platform, data.discountEarned)
        }
      }
    } catch (error) {
      console.error('Error sharing:', error)
    } finally {
      setSharing(null)
    }
  }

  const platforms = [
    { id: 'twitter', label: 'Twitter', icon: Twitter, color: 'text-blue-400' },
    { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
  ]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="text-purple-400" size={24} />
        <h3 className="text-xl font-bold">Share Your Purchase</h3>
      </div>
      <p className="text-gray-400 mb-6 text-sm">
        Share your purchase on social media and earn additional discounts!
      </p>

      <div className="grid grid-cols-3 gap-3">
        {platforms.map((platform) => {
          const Icon = platform.icon
          const isShared = sharedPlatforms.has(platform.id)
          const isSharing = sharing === platform.id

          return (
            <motion.button
              key={platform.id}
              onClick={() => handleShare(platform.id)}
              disabled={isSharing || isShared}
              whileHover={{ scale: isShared ? 1 : 1.05 }}
              whileTap={{ scale: isShared ? 1 : 0.95 }}
              className={`p-4 rounded-lg border-2 transition-colors ${
                isShared
                  ? 'bg-green-600/20 border-green-600/50'
                  : 'bg-gray-800 border-gray-700 hover:border-purple-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isShared ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="text-green-400" size={24} />
                  <span className="text-xs text-green-400 font-semibold">Shared!</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Icon className={platform.color} size={24} />
                  <span className="text-xs text-gray-400">{platform.label}</span>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      {sharedPlatforms.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-green-600/20 border border-green-600/50 rounded-lg text-center"
        >
          <p className="text-sm text-green-400">
            Thanks for sharing! You&apos;ve earned a discount on your next purchase.
          </p>
        </motion.div>
      )}
    </div>
  )
}
