'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, ShoppingCart, ArrowLeft, Users, Video, MapPin, Building } from 'lucide-react'
import ServiceCard from '@/components/ServiceCard'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { addServiceToCart, getCart } from '@/lib/cart'

interface Service {
  id: string
  title: string
  description: string | null
  service_type: string
  delivery_method: string
  duration_hours: number | null
  duration_description: string | null
  price: number | null
  is_quote_based: boolean
  min_participants: number
  max_participants: number | null
  image_url: string | null
  is_featured: boolean
}

const SERVICE_TYPES = [
  { value: 'all', label: 'All Services' },
  { value: 'training', label: 'Training Programs' },
  { value: 'speaking', label: 'Speaking Engagements' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'workshop', label: 'Workshops' },
  { value: 'warranty', label: 'Warranty & Guarantees' },
]

const DELIVERY_METHODS = [
  { value: 'all', label: 'All Delivery' },
  { value: 'virtual', label: 'Virtual', icon: <Video size={14} /> },
  { value: 'in_person', label: 'In-Person', icon: <MapPin size={14} /> },
  { value: 'hybrid', label: 'Hybrid', icon: <Building size={14} /> },
]

// Loading fallback component
function ServicesLoading() {
  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="text-gray-400">Loading services...</div>
        </div>
      </div>
    </div>
  )
}

// Main services content that uses useSearchParams
function ServicesContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [services, setServices] = useState<Service[]>([])
  const [filteredServices, setFilteredServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedDelivery, setSelectedDelivery] = useState('all')
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  // Read type from URL query params on mount
  useEffect(() => {
    const typeParam = searchParams.get('type')
    if (typeParam && SERVICE_TYPES.some(t => t.value === typeParam)) {
      setSelectedType(typeParam)
    }
    const deliveryParam = searchParams.get('delivery')
    if (deliveryParam && DELIVERY_METHODS.some(d => d.value === deliveryParam)) {
      setSelectedDelivery(deliveryParam)
    }
  }, [searchParams])

  useEffect(() => {
    fetchServices()
    loadCartCount()
  }, [])

  useEffect(() => {
    filterServices()
  }, [services, searchQuery, selectedType, selectedDelivery, showFeaturedOnly])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services?active=true')
      if (response.ok) {
        const data = await response.json()
        setServices(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCartCount = () => {
    if (typeof window !== 'undefined') {
      const cart = getCart()
      setCartCount(cart.length)
    }
  }

  const filterServices = () => {
    let filtered = [...services]

    if (selectedType !== 'all') {
      filtered = filtered.filter(s => s.service_type === selectedType)
    }

    if (selectedDelivery !== 'all') {
      filtered = filtered.filter(s => s.delivery_method === selectedDelivery)
    }

    if (showFeaturedOnly) {
      filtered = filtered.filter(s => s.is_featured)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
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

    setFilteredServices(filtered)
  }

  const handleAddToCart = (serviceId: string) => {
    if (typeof window !== 'undefined') {
      addServiceToCart(serviceId)
      loadCartCount()
      
      // Show feedback
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

  const handleRequestQuote = (serviceId: string) => {
    // Navigate to contact page with service info
    router.push(`/?contact=true&service=${serviceId}`)
  }

  const handleViewCart = () => {
    router.push('/checkout')
  }

  const updateUrlParams = (type: string, delivery: string) => {
    const url = new URL(window.location.href)
    if (type === 'all') {
      url.searchParams.delete('type')
    } else {
      url.searchParams.set('type', type)
    }
    if (delivery === 'all') {
      url.searchParams.delete('delivery')
    } else {
      url.searchParams.set('delivery', delivery)
    }
    router.replace(url.pathname + url.search, { scroll: false })
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
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Users className="text-cyan-500" />
                Services
              </h1>
              <p className="text-gray-400">Training, consulting, coaching, and speaking engagements</p>
            </div>
            {cartCount > 0 && (
              <motion.button
                onClick={handleViewCart}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-lg flex items-center gap-2"
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
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedType}
                onChange={(e) => {
                  const newType = e.target.value
                  setSelectedType(newType)
                  updateUrlParams(newType, selectedDelivery)
                }}
                className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                {SERVICE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <select
                value={selectedDelivery}
                onChange={(e) => {
                  const newDelivery = e.target.value
                  setSelectedDelivery(newDelivery)
                  updateUrlParams(selectedType, newDelivery)
                }}
                className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                {DELIVERY_METHODS.map(delivery => (
                  <option key={delivery.value} value={delivery.value}>{delivery.label}</option>
                ))}
              </select>
              <motion.button
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  showFeaturedOnly
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <Filter size={18} className="inline mr-2" />
                Featured
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Services Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading services...</div>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400 mb-4">No services found.</p>
            {searchQuery || selectedType !== 'all' || selectedDelivery !== 'all' || showFeaturedOnly ? (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedType('all')
                  setSelectedDelivery('all')
                  setShowFeaturedOnly(false)
                  updateUrlParams('all', 'all')
                }}
                className="text-cyan-400 hover:text-cyan-300"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onAddToCart={handleAddToCart}
                onRequestQuote={handleRequestQuote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Main page component with Suspense boundary
export default function ServicesPage() {
  return (
    <Suspense fallback={<ServicesLoading />}>
      <ServicesContent />
    </Suspense>
  )
}
