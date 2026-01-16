'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, ArrowRight, ShoppingCart, DollarSign, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  image_url: string | null
  is_featured: boolean
}

const TYPE_LABELS: Record<string, string> = {
  ebook: 'E-Book',
  training: 'Training',
  calculator: 'Calculator',
  music: 'Music',
  app: 'App',
  merchandise: 'Merchandise',
}

export default function Store() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      // Fetch featured products, prioritizing merchandise
      const response = await fetch('/api/products?active=true')
      if (response.ok) {
        const data = await response.json()
        // Filter to show featured items first, then merchandise, limit to 6 items
        const sorted = (data || [])
          .sort((a: Product, b: Product) => {
            // Featured first
            if (a.is_featured && !b.is_featured) return -1
            if (!a.is_featured && b.is_featured) return 1
            // Then merchandise
            if (a.type === 'merchandise' && b.type !== 'merchandise') return -1
            if (a.type !== 'merchandise' && b.type === 'merchandise') return 1
            return 0
          })
          .slice(0, 6)
        setProducts(sorted)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductClick = (productId: number) => {
    router.push(`/store/${productId}`)
  }

  if (loading) {
    return (
      <section id="store" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-gray-400">Loading store...</div>
        </div>
      </section>
    )
  }

  return (
    <section id="store" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-900 relative overflow-hidden">
      {/* Subtle background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <ShoppingBag className="text-purple-500" size={40} />
            <h2 className="text-4xl md:text-5xl font-bold">
              <span className="gradient-text">Store</span>
            </h2>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Browse our collection of merchandise, digital products, and more
          </p>
          {/* Browse Full Store Link */}
          <Link 
            href="/store"
            className="inline-flex items-center gap-2 mt-6 text-purple-400 hover:text-purple-300 transition-colors group"
          >
            <ShoppingCart size={18} />
            <span>Browse Full Store</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No products available yet.</p>
            <Link 
              href="/store"
              className="text-purple-400 hover:text-purple-300"
            >
              Check back soon or visit our store
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                onClick={() => handleProductClick(product.id)}
                className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all duration-300 cursor-pointer"
                style={{
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.1)',
                }}
              >
                {/* Product Image */}
                <div className="relative h-56 overflow-hidden">
                  {product.image_url ? (
                    <motion.img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      whileHover={{ scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-blue-900/20">
                      <ShoppingBag className="text-gray-600" size={48} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  
                  {/* Type Badge */}
                  <div className="absolute top-4 left-4 px-3 py-1 bg-gray-900/80 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-300">
                    {TYPE_LABELS[product.type] || product.type}
                  </div>
                  
                  {/* Featured Badge */}
                  {product.is_featured && (
                    <div className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-semibold text-white">
                      Featured
                    </div>
                  )}
                  
                  {/* Price Badge */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-1 px-3 py-1.5 bg-green-500/90 backdrop-blur-sm rounded-full text-white text-sm font-bold">
                    {product.price !== null ? (
                      <>
                        <DollarSign size={14} />
                        {product.price.toFixed(2)}
                      </>
                    ) : (
                      'Free'
                    )}
                  </div>
                </div>

                {/* Product Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors mb-2">
                    {product.title}
                  </h3>
                  {product.description && (
                    <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                      {product.description}
                    </p>
                  )}
                  
                  {/* View Product Button */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                  >
                    <ShoppingCart size={18} />
                    {product.type === 'merchandise' ? 'View Options' : 'View Product'}
                  </motion.div>
                </div>

                {/* Glow effect on hover */}
                <motion.div
                  className="absolute -inset-1 rounded-xl pointer-events-none opacity-0 group-hover:opacity-75 transition-opacity"
                  initial={false}
                >
                  <div 
                    className="absolute inset-0 rounded-xl blur-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(236, 72, 153, 0.4))',
                    }}
                  />
                </motion.div>
              </motion.div>
            ))}
          </div>
        )}

        {/* View All Products Button */}
        {products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mt-12"
          >
            <Link
              href="/store"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all group"
            >
              <ShoppingBag size={20} />
              View All Products
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  )
}
