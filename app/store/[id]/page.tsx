'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  ArrowLeft,
  Package,
  Info,
  HelpCircle,
  Check,
  ExternalLink,
} from 'lucide-react'
import VariantSelector, { ProductVariant } from '@/components/VariantSelector'
import { addToCart, getCartCount } from '@/lib/cart'
import { formatCurrency } from '@/lib/pricing-model'
import { PRODUCT_TYPE_LABELS } from '@/lib/constants/products'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Breadcrumbs from '@/components/Breadcrumbs'

interface BundleRef {
  name: string
  slug: string
  segment: string
  pricingUrl: string
}

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
  is_featured?: boolean
  asset_url?: string | null
  instructions_file_path?: string | null
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
  const [bundles, setBundles] = useState<BundleRef[]>([])
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(false)
  const [showAdded, setShowAdded] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    fetchProduct()
    fetchBundles()
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

  const fetchBundles = async () => {
    try {
      const response = await fetch(`/api/products/${productId}/bundles`)
      if (response.ok) {
        const data = await response.json()
        setBundles(data.bundles || [])
      }
    } catch (error) {
      console.error('Failed to fetch bundles:', error)
    }
  }

  const handleAddToCart = async () => {
    if (!product) return

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
      setCartCount(getCartCount())
      setShowAdded(true)
      setTimeout(() => setShowAdded(false), 1500)
    } catch (error) {
      console.error('Failed to add to cart:', error)
      alert('Failed to add item to cart')
    } finally {
      setAddingToCart(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <div className="pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="text-gray-400">Loading product...</div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <div className="pt-24 pb-12 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-gray-400 mb-4">Product not found</p>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
            >
              <ArrowLeft size={20} />
              Back to Store
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isMerchandise = product.is_print_on_demand
  const mockupImages = selectedVariant?.mockup_urls || product.image_url ? [product.image_url!] : []

  // Deliverables / what's included (aligned with service detail)
  const deliverablesList: string[] = []
  if (product.type === 'template') {
    deliverablesList.push('Install instructions (download after purchase)')
    deliverablesList.push('Repo or asset link (after purchase)')
  }
  if (isMerchandise) {
    deliverablesList.push('Shipped to you')
    deliverablesList.push('Print-on-demand fulfillment')
  }
  if (deliverablesList.length === 0 && product.type) {
    const label = PRODUCT_TYPE_LABELS[product.type as keyof typeof PRODUCT_TYPE_LABELS] || product.type
    deliverablesList.push(label)
  }

  const breadcrumbItems: { label: string; href?: string }[] = [
    { label: 'Store', href: '/store' },
    { label: String(product.title) },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={breadcrumbItems} />

          {/* Back link */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/store"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Store
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/help"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Help"
              >
                <HelpCircle size={20} />
              </Link>
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
                      className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-600 text-white text-xs font-bold rounded-full flex items-center justify-center"
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden"
          >
            {/* Hero */}
            <div className="relative h-64 md:h-80 bg-gradient-to-br from-cyan-900/20 to-blue-900/20">
              {(product.image_url || (mockupImages.length > 0 && mockupImages[0])) ? (
                <img
                  src={product.image_url || mockupImages[0]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="text-cyan-500/40" size={80} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <span className="px-3 py-1 bg-gray-900/80 rounded-full text-xs font-heading tracking-wider text-cyan-400 uppercase">
                  {PRODUCT_TYPE_LABELS[product.type as keyof typeof PRODUCT_TYPE_LABELS] || product.type}
                </span>
                {product.category && (
                  <span className="ml-2 px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
                    {CATEGORY_LABELS[product.category] || product.category}
                  </span>
                )}
                {product.is_featured && (
                  <span className="ml-2 px-3 py-1 bg-cyan-500/90 text-imperial-navy rounded-full text-xs font-bold uppercase">
                    Featured
                  </span>
                )}
                <h1 className="font-premium text-3xl md:text-4xl text-white mt-4">
                  {product.title}
                </h1>
              </div>
            </div>

            <div className="p-8 md:p-10">
              {/* Meta row */}
              {product.category && (
                <div className="flex flex-wrap gap-4 mb-6 text-gray-400">
                  <span className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm">
                    {CATEGORY_LABELS[product.category] || product.category}
                  </span>
                </div>
              )}

              {/* Description */}
              {product.description && (
                <p className="text-gray-300 text-lg leading-relaxed mb-8">
                  {product.description}
                </p>
              )}

              {/* What's included / Deliverables */}
              {deliverablesList.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-heading uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                    <Package size={16} />
                    What&apos;s Included
                  </h3>
                  <ul className="space-y-2">
                    {deliverablesList.map((d) => (
                      <li key={d} className="flex items-center gap-2 text-gray-300">
                        <Check className="text-green-500 flex-shrink-0" size={18} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Template: install instructions link */}
              {product.type === 'template' && product.instructions_file_path && (
                <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-sm text-gray-400 mb-2">
                    Install instructions are available after purchase.
                  </p>
                </div>
              )}

              {/* Variant selector for merchandise */}
              {isMerchandise && variants.length > 0 && (
                <div className="mb-8">
                  <VariantSelector
                    variants={variants}
                    selectedVariant={selectedVariant}
                    onVariantChange={setSelectedVariant}
                    showPrice={true}
                  />
                </div>
              )}

              {/* Available in packages */}
              {bundles.length > 0 && (
                <div className="mb-8 p-6 bg-gray-800/50 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-heading uppercase tracking-wider text-gray-400 mb-3">
                    Available in Packages
                  </h3>
                  <p className="text-gray-300 text-sm mb-4">
                    This product is included in the following pricing tiers:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bundles.map((b) => (
                      <Link
                        key={`${b.slug}-${b.segment}`}
                        href={b.pricingUrl}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-900/30 border border-cyan-500/50 rounded-lg text-cyan-400 hover:bg-cyan-900/50 hover:border-cyan-400 transition-colors text-sm"
                      >
                        {b.name}
                        <ExternalLink size={14} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Merchandise info */}
              {isMerchandise && (
                <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-start gap-3">
                    <Info className="text-cyan-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-gray-400">
                      <p className="mb-2">
                        Print-on-demand. Fulfilled by Printful; typically ships within 2–7 business days.
                      </p>
                      <p>Free shipping on orders over $75.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Size chart (apparel) */}
              {isMerchandise && product.category === 'apparel' && (
                <details className="mb-8 bg-gray-800/50 rounded-lg border border-gray-700">
                  <summary className="px-4 py-3 cursor-pointer font-medium">
                    Size Chart
                  </summary>
                  <div className="px-4 pb-4 pt-2">
                    <p className="text-sm text-gray-400 mb-2">
                      Please refer to the product description for detailed sizing information.
                    </p>
                    <p className="text-xs text-gray-500">
                      Sizes may vary by product.
                    </p>
                  </div>
                </details>
              )}

              {/* Price and CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-6 border-t border-gray-800">
                <div>
                  {selectedVariant?.price != null ? (
                    <span className="text-3xl font-bold text-white">
                      {formatCurrency(selectedVariant.price)}
                    </span>
                  ) : product.price !== null ? (
                    <span className="text-3xl font-bold text-white">
                      {formatCurrency(product.price)}
                    </span>
                  ) : (
                    <span className="text-xl font-semibold text-green-400">Free</span>
                  )}
                </div>
                <motion.button
                  onClick={handleAddToCart}
                  disabled={addingToCart || (isMerchandise && variants.length > 0 && (!selectedVariant || !selectedVariant.is_available))}
                  whileHover={{ scale: addingToCart ? 1 : 1.02 }}
                  whileTap={{ scale: addingToCart ? 1 : 0.98 }}
                  className="px-8 py-4 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showAdded ? (
                    <>
                      <Check size={20} />
                      Added to Cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={20} />
                      {addingToCart
                        ? 'Adding...'
                        : isMerchandise && variants.length > 0 && !selectedVariant
                        ? 'Select a variant'
                        : isMerchandise && variants.length > 0 && selectedVariant && !selectedVariant.is_available
                        ? 'Variant Unavailable'
                        : 'Add to Cart'}
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
