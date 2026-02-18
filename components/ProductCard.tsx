'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, DollarSign, Download, File, Image as ImageIcon, Check } from 'lucide-react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/types/store'
import { formatDollarAmount } from '@/lib/pricing-model'

interface ProductCardProps {
  product: Product
  onAddToCart: (productId: number) => void
}

const TYPE_LABELS: Record<string, string> = {
  ebook: 'E-Book',
  training: 'Training',
  calculator: 'Calculator',
  music: 'Music',
  app: 'App',
  merchandise: 'Merchandise',
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
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
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
        {product.image_url && !imageError ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="text-gray-600" size={48} />
          </div>
        )}
        {product.is_featured && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded">
            Featured
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-1 bg-gray-900/80 text-white text-xs rounded">
          {TYPE_LABELS[product.type] || product.type}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{product.title}</h3>
        {product.description && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-3">{product.description}</p>
        )}

        {/* Price and Add to Cart */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {product.price !== null ? (
              <>
                <DollarSign className="text-green-400" size={20} />
                <span className="text-2xl font-bold text-white">{formatDollarAmount(product.price)}</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-green-400">Free</span>
            )}
          </div>
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              handleAddToCart()
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg flex items-center gap-2 hover:from-blue-700 hover:to-purple-700 transition-colors"
          >
            {showAdded ? <Check size={18} /> : <ShoppingCart size={18} />}
            {showAdded ? 'Added!' : product.type === 'merchandise' ? 'View Details' : 'Add to Cart'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
