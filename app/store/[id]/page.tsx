'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, ArrowLeft, Package, Info } from 'lucide-react'
import VariantSelector, { ProductVariant } from '@/components/VariantSelector'
import MockupViewer from '@/components/MockupViewer'
import { addToCart, getCartCount } from '@/lib/cart'

interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  image_url: string | null
  category: string | null
  is_print_on_demand: boolean
  base_cost: number | null
  markup_percentage: number | null
}

const CATEGORY_LABELS: Record<string, string> = {
  apparel: 'Apparel',
  houseware: 'Houseware',
  travel: 'Travel',
  office: 'Office',
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    fetchProduct()
    // Load cart count on mount
    setCartCount(getCartCount())
  }, [productId])

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        setProduct(data.product)
        setVariants(data.variants || [])
      }
    } catch (error) {
      console.error('Failed to fetch product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = async () => {
    if (!product) return

    // Require variant selection only for merchandise with available variants
    const needsVariant = product.is_print_on_demand && variants.length > 0
    if (needsVariant && !selectedVariant) return

    if (selectedVariant && !selectedVariant.is_available) {
      alert('This variant is currently unavailable')
      return
    }

    setAddingToCart(true)

    try {
      addToCart(
        product.id,
        1,
        selectedVariant?.id,
        selectedVariant?.printful_variant_id
      )

      // Update cart count
      setCartCount(getCartCount())

      // Show success feedback
      const button = document.activeElement as HTMLElement
      if (button) {
        const originalText = button.textContent
        button.textContent = 'Added!'
        setTimeout(() => {
          if (button) button.textContent = originalText
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to add to cart:', error)
      alert('Failed to add item to cart')
    } finally {
      setAddingToCart(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="text-gray-400">Loading product...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400 mb-4">Product not found</p>
          <button
            onClick={() => router.push('/store')}
            className="text-purple-400 hover:text-purple-300"
          >
            Back to Store
          </button>
        </div>
      </div>
    )
  }

  const isMerchandise = product.is_print_on_demand
  const mockupImages = selectedVariant?.mockup_urls || product.image_url ? [product.image_url!] : []

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button and Cart */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/store')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Store
          </button>

          {/* Cart Button */}
          <motion.button
            onClick={() => router.push('/checkout')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
          >
            <ShoppingCart size={20} />
            <span className="hidden sm:inline">Cart</span>
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image/Mockup Section */}
          <div>
            {isMerchandise && mockupImages.length > 0 ? (
              <MockupViewer images={mockupImages} alt={product.title} />
            ) : product.image_url ? (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg flex items-center justify-center h-96">
                <Package className="text-gray-600" size={64} />
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div>
            {/* Category Badge */}
            {product.category && (
              <div className="mb-4">
                <span className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm font-medium">
                  {CATEGORY_LABELS[product.category] || product.category}
                </span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-4xl font-bold mb-4">{product.title}</h1>

            {/* Description */}
            {product.description && (
              <p className="text-gray-400 mb-6 leading-relaxed">{product.description}</p>
            )}

            {/* Variant Selector for Merchandise */}
            {isMerchandise && variants.length > 0 ? (
              <div className="mb-8">
                <VariantSelector
                  variants={variants}
                  selectedVariant={selectedVariant}
                  onVariantChange={setSelectedVariant}
                  showPrice={true}
                />
              </div>
            ) : (
              /* Regular Price Display */
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  {product.price !== null ? (
                    <span className="text-4xl font-bold text-green-400">
                      ${product.price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-2xl font-semibold text-green-400">Free</span>
                  )}
                </div>
              </div>
            )}

            {/* Add to Cart Button */}
            <motion.button
              onClick={handleAddToCart}
              disabled={addingToCart || (isMerchandise && variants.length > 0 && (!selectedVariant || !selectedVariant.is_available))}
              whileHover={{ scale: addingToCart ? 1 : 1.02 }}
              whileTap={{ scale: addingToCart ? 1 : 0.98 }}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ShoppingCart size={20} />
              {addingToCart
                ? 'Adding...'
                : isMerchandise && variants.length > 0 && !selectedVariant
                ? 'Select a variant'
                : isMerchandise && variants.length > 0 && selectedVariant && !selectedVariant.is_available
                ? 'Variant Unavailable'
                : 'Add to Cart'}
            </motion.button>

            {/* Product Info */}
            {isMerchandise && (
              <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
                <div className="flex items-start gap-3">
                  <Info className="text-purple-400 flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-gray-400">
                    <p className="mb-2">
                      This is a print-on-demand product. Your order will be fulfilled by Printful
                      and typically ships within 2-7 business days.
                    </p>
                    <p>Free shipping on orders over $75.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Size Chart (for apparel) */}
            {isMerchandise && product.category === 'apparel' && (
              <div className="mt-6">
                <details className="bg-gray-900 rounded-lg border border-gray-800">
                  <summary className="px-4 py-3 cursor-pointer font-medium">
                    Size Chart
                  </summary>
                  <div className="px-4 pb-4 pt-2">
                    <p className="text-sm text-gray-400 mb-2">
                      Please refer to the product description for detailed sizing information.
                    </p>
                    <p className="text-xs text-gray-500">
                      Sizes may vary by product. Check individual product pages for specific
                      measurements.
                    </p>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
