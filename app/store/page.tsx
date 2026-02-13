'use client'

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, ShoppingCart, ArrowLeft, AlertCircle, HelpCircle } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import ServiceCard from '@/components/ServiceCard'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { addToCart, addServiceToCart, getCartCount } from '@/lib/cart'
import Link from 'next/link'
import type { Product, Service } from '@/lib/types/store'

type ItemCategory = 'all' | 'products' | 'services'

const PRODUCT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'ebook', label: 'E-Books' },
  // Note: 'training' also exists in SERVICE_TYPES. The type filter dropdown is only
  // shown when a specific category (Products or Services) is selected, so the overlap
  // is not user-facing. If the dropdown is ever shown in 'all' mode, namespace these
  // values (e.g. 'product_training' / 'service_training') to avoid ambiguity.
  { value: 'training', label: 'Training' },
  { value: 'calculator', label: 'Calculators' },
  { value: 'music', label: 'Music' },
  { value: 'app', label: 'Apps' },
  { value: 'merchandise', label: 'Merchandise' },
]

const SERVICE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'training', label: 'Training' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'warranty', label: 'Warranty' },
]

// Loading fallback component
function StoreLoading() {
  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="text-gray-400">Loading store...</div>
        </div>
      </div>
    </div>
  )
}

// Main store content that uses useSearchParams
function StoreContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [itemCategory, setItemCategory] = useState<ItemCategory>('all')
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  // Guard: only sync URL -> state on initial mount
  const initializedRef = useRef(false)

  // Determine which type filter list to show based on category
  const activeTypeFilters = itemCategory === 'services' ? SERVICE_TYPES : PRODUCT_TYPES

  // Debounce search input (250ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Read type/category from URL query params on initial mount only
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const typeParam = searchParams.get('type')
    const categoryParam = searchParams.get('category') as ItemCategory | null
    if (categoryParam && ['all', 'products', 'services'].includes(categoryParam)) {
      setItemCategory(categoryParam)
    }
    if (typeParam) {
      const allTypes = [...PRODUCT_TYPES, ...SERVICE_TYPES]
      if (allTypes.some(t => t.value === typeParam)) {
        setSelectedType(typeParam)
      }
    }
  }, [searchParams])

  useEffect(() => {
    fetchData()
    loadCartCount()
  }, [])

  const fetchData = async () => {
    setFetchError(null)
    try {
      const [productsRes, servicesRes] = await Promise.all([
        fetch('/api/products?active=true'),
        fetch('/api/services?active=true'),
      ])

      let hasError = false

      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data || [])
      } else {
        hasError = true
      }

      if (servicesRes.ok) {
        const data = await servicesRes.json()
        if (Array.isArray(data)) {
          setServices(data)
        }
      } else {
        hasError = true
      }

      if (hasError) {
        setFetchError('Some store data could not be loaded. You may be seeing partial results.')
      }
    } catch (error) {
      console.error('Failed to fetch store data:', error)
      setFetchError('Failed to load store data. Please try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }

  const loadCartCount = () => {
    setCartCount(getCartCount())
  }

  // Derived filtered lists via useMemo (no extra render cycle)
  const filteredProducts = useMemo(() => {
    if (itemCategory !== 'all' && itemCategory !== 'products') return []

    let filtered = [...products]

    // Only apply type filter when viewing products specifically (not 'all')
    if (selectedType !== 'all' && itemCategory === 'products') {
      filtered = filtered.filter(p => p.type === selectedType)
    }

    if (showFeaturedOnly) {
      filtered = filtered.filter(p => p.is_featured)
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase()
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      )
    }

    filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      return 0
    })

    return filtered
  }, [products, debouncedSearch, selectedType, itemCategory, showFeaturedOnly])

  const filteredServices = useMemo(() => {
    if (itemCategory !== 'all' && itemCategory !== 'services') return []

    let filtered = [...services]

    // Only apply type filter when viewing services specifically (not 'all')
    if (selectedType !== 'all' && itemCategory === 'services') {
      filtered = filtered.filter(s => s.service_type === selectedType)
    }

    if (showFeaturedOnly) {
      filtered = filtered.filter(s => s.is_featured)
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase()
      filtered = filtered.filter(s =>
        s.title.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query))
      )
    }

    filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      return 0
    })

    return filtered
  }, [services, debouncedSearch, selectedType, itemCategory, showFeaturedOnly])

  const handleAddToCart = useCallback((productId: number) => {
    addToCart(productId)
    setCartCount(getCartCount())
    // "Added!" feedback is handled inside ProductCard via its own state
  }, [])

  const handleAddServiceToCart = useCallback((serviceId: string) => {
    addServiceToCart(serviceId)
    setCartCount(getCartCount())
    // "Added!" feedback is handled inside ServiceCard via its own state
  }, [])

  const handleRequestQuote = useCallback((serviceId: string) => {
    router.push(`/contact?subject=${encodeURIComponent('Service Quote Request')}&service_id=${serviceId}`)
  }, [router])

  const handleViewCart = () => {
    router.push('/checkout')
  }

  const handleCategoryChange = (category: ItemCategory) => {
    setItemCategory(category)
    setSelectedType('all')
    const url = new URL(window.location.href)
    if (category === 'all') {
      url.searchParams.delete('category')
    } else {
      url.searchParams.set('category', category)
    }
    url.searchParams.delete('type')
    router.replace(url.pathname + url.search, { scroll: false })
  }

  const totalItems = filteredProducts.length + filteredServices.length

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
              <h1 className="text-4xl font-bold mb-2">Store</h1>
              <p className="text-gray-400">Browse our collection of products, merchandise, and services</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/help" className="text-gray-400 hover:text-white transition-colors" aria-label="Help">
                <HelpCircle size={20} />
              </Link>
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
          </div>

          {/* Error Banner */}
          {fetchError && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-300 text-sm">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{fetchError}</span>
              <button
                onClick={() => { setLoading(true); setFetchError(null); fetchData() }}
                className="ml-auto text-red-400 hover:text-red-200 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Category Toggle */}
          <div className="flex gap-2 mb-4">
            {([
              { value: 'all', label: 'All' },
              { value: 'products', label: 'Products' },
              { value: 'services', label: 'Services' },
            ] as { value: ItemCategory; label: string }[]).map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  itemCategory === cat.value
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search store..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-2">
              {itemCategory !== 'all' && (
                <select
                  value={selectedType}
                  onChange={(e) => {
                    const newType = e.target.value
                    setSelectedType(newType)
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
                  {activeTypeFilters.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              )}
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

        {/* Store Items */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading store...</div>
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No items found.</p>
            {searchQuery || selectedType !== 'all' || showFeaturedOnly || itemCategory !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedType('all')
                  setShowFeaturedOnly(false)
                  handleCategoryChange('all')
                }}
                className="text-purple-400 hover:text-purple-300"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-10">
            {/* Products Section */}
            {filteredProducts.length > 0 && (
              <div>
                {itemCategory === 'all' && (
                  <h2 className="text-2xl font-bold mb-6 text-gray-200">Products</h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={`product-${product.id}`}
                      product={product}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Services Section */}
            {filteredServices.length > 0 && (
              <div>
                {itemCategory === 'all' && (
                  <h2 className="text-2xl font-bold mb-6 text-gray-200">Services</h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredServices.map((service) => (
                    <ServiceCard
                      key={`service-${service.id}`}
                      service={service}
                      onAddToCart={handleAddServiceToCart}
                      onRequestQuote={handleRequestQuote}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Main page component with Suspense boundary
export default function StorePage() {
  return (
    <Suspense fallback={<StoreLoading />}>
      <StoreContent />
    </Suspense>
  )
}
