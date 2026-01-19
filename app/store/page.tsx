'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, ShoppingCart, ArrowLeft, Home } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'

interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  image_url: string | null
  is_featured: boolean
}

const PRODUCT_TYPES = [
  { value: 'all', label: 'All Products' },
  { value: 'ebook', label: 'E-Books' },
  { value: 'training', label: 'Training' },
  { value: 'calculator', label: 'Calculators' },
  { value: 'music', label: 'Music' },
  { value: 'app', label: 'Apps' },
  { value: 'merchandise', label: 'Merchandise' },
]

export default function StorePage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  // Read type from URL query params on mount
  useEffect(() => {
    const typeParam = searchParams.get('type')
    if (typeParam && PRODUCT_TYPES.some(t => t.value === typeParam)) {
      setSelectedType(typeParam)
    }
  }, [searchParams])

  useEffect(() => {
    fetchProducts()
    loadCartCount()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchQuery, selectedType, showFeaturedOnly])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?active=true')
      if (response.ok) {
        const data = await response.json()
        setProducts(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCartCount = () => {
    if (typeof window !== 'undefined') {
      const cart = localStorage.getItem('cart')
      if (cart) {
        try {
          const cartItems = JSON.parse(cart)
          setCartCount(cartItems.length)
        } catch (e) {
          setCartCount(0)
        }
      }
    }
  }

  const filterProducts = () => {
    let filtered = [...products]

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(p => p.type === selectedType)
    }

    // Filter by featured
    if (showFeaturedOnly) {
      filtered = filtered.filter(p => p.is_featured)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      )
    }

    // Sort: featured first, then by display order
    filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      return 0
    })

    setFilteredProducts(filtered)
  }

  const handleAddToCart = (productId: number) => {
    if (typeof window !== 'undefined') {
      const cart = localStorage.getItem('cart')
      let cartItems: number[] = []

      if (cart) {
        try {
          cartItems = JSON.parse(cart)
        } catch (e) {
          cartItems = []
        }
      }

      if (!cartItems.includes(productId)) {
        cartItems.push(productId)
        localStorage.setItem('cart', JSON.stringify(cartItems))
        setCartCount(cartItems.length)
        
        // Show success feedback
        const button = document.activeElement as HTMLElement
        if (button) {
          const originalText = button.textContent
          button.textContent = 'Added!'
          setTimeout(() => {
            if (button) button.textContent = originalText
          }, 1000)
        }
      }
    }
  }

  const handleViewCart = () => {
    router.push('/checkout')
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* Back to Home Link */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Home
          </button>
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Product Store</h1>
              <p className="text-gray-400">Browse our collection of digital products and merchandise</p>
            </div>
            {cartCount > 0 && (
              <motion.button
                onClick={handleViewCart}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <ShoppingCart size={20} />
                View Cart
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </motion.button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedType}
                onChange={(e) => {
                  const newType = e.target.value
                  setSelectedType(newType)
                  // Update URL without full page reload
                  const url = new URL(window.location.href)
                  if (newType === 'all') {
                    url.searchParams.delete('type')
                  } else {
                    url.searchParams.set('type', newType)
                  }
                  router.replace(url.pathname + url.search, { scroll: false })
                }}
                className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              >
                {PRODUCT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <motion.button
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  showFeaturedOnly
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <Filter size={18} className="inline mr-2" />
                Featured
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading products...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No products found.</p>
            {searchQuery || selectedType !== 'all' || showFeaturedOnly ? (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedType('all')
                  setShowFeaturedOnly(false)
                }}
                className="text-purple-400 hover:text-purple-300"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
