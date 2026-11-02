'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, ShoppingCart, ArrowLeft, ArrowRight, Users, Video, MapPin, Building, HelpCircle } from 'lucide-react'
import ServiceCard from '@/components/ServiceCard'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { addServiceToCart, getCart } from '@/lib/cart'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

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
  video_url: string | null
  video_thumbnail_url: string | null
  presentation_url: string | null
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
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading services...</div>
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

  const filterServices = useCallback(() => {
    let filtered = [...services]
    if (selectedType !== 'all') {
      filtered = filtered.filter((s) => s.service_type === selectedType)
    }
    if (selectedDelivery !== 'all') {
      filtered = filtered.filter((s) => s.delivery_method === selectedDelivery)
    }
    if (showFeaturedOnly) {
      filtered = filtered.filter((s) => s.is_featured)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          (s.description && s.description.toLowerCase().includes(query)) ||
          (s.id === 'a34b8a0a-d65c-42c8-970b-9a77e043e329' && "julie's family learning".includes(query))
      )
    }
    filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      return 0
    })
    setFilteredServices(filtered)
  }, [services, searchQuery, selectedType, selectedDelivery, showFeaturedOnly])

  useEffect(() => {
    filterServices()
  }, [filterServices])

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

  const handleAddToCart = (serviceId: string) => {
    if (typeof window !== 'undefined') {
      addServiceToCart(serviceId)
      loadCartCount()
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
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
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
            className="mb-4 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft size={20} />
            Back to Home
          </button>
          
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center gap-3">
                <Users className="text-foreground" />
                Services
              </h1>
              <p className="text-muted-foreground">Training, consulting, coaching, and speaking engagements</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Help">
                <HelpCircle size={20} />
              </Link>
            {cartCount > 0 && (
              <motion.button
                onClick={handleViewCart}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="service-primary-action relative px-6 py-3"
              >
                <ShoppingCart size={20} />
                View Cart
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                    {cartCount}
                  </span>
                )}
              </motion.button>
            )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-card-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                aria-label="Service type"
                value={selectedType}
                onChange={(e) => {
                  const newType = e.target.value
                  setSelectedType(newType)
                  updateUrlParams(newType, selectedDelivery)
                }}
                className="max-w-full rounded-lg border border-border bg-card px-4 py-2 text-card-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {SERVICE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <select
                aria-label="Delivery method"
                value={selectedDelivery}
                onChange={(e) => {
                  const newDelivery = e.target.value
                  setSelectedDelivery(newDelivery)
                  updateUrlParams(selectedType, newDelivery)
                }}
                className="max-w-full rounded-lg border border-border bg-card px-4 py-2 text-card-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {DELIVERY_METHODS.map(delivery => (
                  <option key={delivery.value} value={delivery.value}>{delivery.label}</option>
                ))}
              </select>
              <motion.button
                type="button"
                aria-pressed={showFeaturedOnly}
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  showFeaturedOnly
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-card text-card-foreground hover:border-accent'
                }`}
              >
                <Filter size={18} className="inline mr-2" />
                Featured
              </motion.button>
            </div>
          </div>
          {!loading && <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">Showing {filteredServices.length} of {services.length} services</p>}
        </motion.div>

        <Link href="/speaking" className="mb-8 flex flex-wrap items-center justify-between gap-3 border-l-4 border-accent bg-card px-5 py-4 text-card-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span><strong className="block text-lg">Planning a speaking event?</strong><span className="text-sm text-muted-foreground">Build a short Speaker Fit Brief before exploring the engagement.</span></span>
          <span className="inline-flex items-center gap-2 font-semibold underline decoration-accent underline-offset-4">Explore speaking <ArrowRight size={17} /></span>
        </Link>

        {/* Services Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">Loading services...</div>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto mb-4 text-muted-foreground" size={48} />
            <p className="mb-4 text-muted-foreground">No services found.</p>
            {searchQuery || selectedType !== 'all' || selectedDelivery !== 'all' || showFeaturedOnly ? (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedType('all')
                  setSelectedDelivery('all')
                  setShowFeaturedOnly(false)
                  updateUrlParams('all', 'all')
                }}
                className="font-semibold text-foreground underline decoration-accent underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                viewDetailsHref={`/services/${service.id}`}
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
