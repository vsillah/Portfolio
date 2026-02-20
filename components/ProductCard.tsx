'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ShoppingCart, DollarSign, Download, File, Image as ImageIcon, Check, Sparkles } from 'lucide-react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/types/store'
import { formatDollarAmount } from '@/lib/pricing-model'

interface ProductCardProps {
  product: Product
  onAddToCart: (productId: number) => void
  campaignBadge?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  ebook: 'E-Book',
  training: 'Training',
  calculator: 'Calculator',
  music: 'Music',
  app: 'App',
  merchandise: 'Merchandise',
}

export default function ProductCard({ product, onAddToCart, campaignBadge }: ProductCardProps) {
  const [imageError, setImageError] = useState(false)
  const [showAdded, setShowAdded] = useState(false)
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  const handleAddToCart = () => {
    // For merchandise, redirect to product page for variant selection
    if (product.type === 'merchandise') {
      router.push(`/store/${product.id}`)
      return
    }
    onAddToCart(product.id)
    setShowAdded(true)
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    addedTimerRef.current = setTimeout(() => setShowAdded(false), 1000)
  }

  const handleCardClick = () => {
    // Navigate to product detail page
    router.push(`/store/${product.id}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="bg-silicon-slate border border-silicon-slate rounded-xl overflow-hidden hover:border-radiant-gold/50 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-bronze/20 to-radiant-gold/20">
        {product.image_url && !imageError ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 320px"
            unoptimized
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="text-platinum-white/60" size={48} />
          </div>
        )}
        {product.is_featured && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-radiant-gold text-imperial-navy text-xs font-semibold rounded">
            Featured
          </div>
        )}
        {campaignBadge && !product.is_featured && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded">
            <Sparkles className="w-3 h-3" />
            {campaignBadge}
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-1 bg-silicon-slate/80 text-foreground text-xs rounded">
          {TYPE_LABELS[product.type] || product.type}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{product.title}</h3>
        {product.description && (
          <p className="text-platinum-white/80 text-sm mb-4 line-clamp-3">{product.description}</p>
        )}

        {/* Price and Add to Cart */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {product.price !== null ? (
              <>
                <DollarSign className="text-radiant-gold" size={20} />
                <span className="text-2xl font-bold text-white">{formatDollarAmount(product.price)}</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-radiant-gold">Free</span>
            )}
          </div>
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              handleAddToCart()
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-gradient-to-r btn-gold font-semibold rounded-lg flex items-center gap-2 transition-colors"
          >
            {showAdded ? <Check size={18} /> : <ShoppingCart size={18} />}
            {showAdded ? 'Added!' : product.type === 'merchandise' ? 'View Details' : 'Add to Cart'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
