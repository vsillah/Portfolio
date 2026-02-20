'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ShoppingCart,
  ArrowLeft,
  MessageSquare,
  Check,
  Video,
  MapPin,
  Building,
  Clock,
  Users,
  Package,
  ExternalLink,
} from 'lucide-react'
import { addServiceToCart } from '@/lib/cart'
import { formatCurrency } from '@/lib/pricing-model'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import Breadcrumbs from '@/components/Breadcrumbs'

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
  min_participants?: number
  max_participants?: number | null
  deliverables?: string[] | null
  topics?: string[] | null
  image_url: string | null
  is_featured: boolean
}

interface BundleRef {
  name: string
  slug: string
  segment: string
  pricingUrl: string
}

const TYPE_LABELS: Record<string, string> = {
  training: 'Training',
  speaking: 'Speaking',
  consulting: 'Consulting',
  coaching: 'Coaching',
  workshop: 'Workshop',
  warranty: 'Warranty',
}

const DELIVERY_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  virtual: { icon: <Video size={16} />, label: 'Virtual' },
  in_person: { icon: <MapPin size={16} />, label: 'In-Person' },
  hybrid: { icon: <Building size={16} />, label: 'Hybrid' },
}

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const serviceId = params.id as string

  const [service, setService] = useState<Service | null>(null)
  const [bundles, setBundles] = useState<BundleRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdded, setShowAdded] = useState(false)

  useEffect(() => {
    fetchService()
    fetchBundles()
  }, [serviceId])

  const fetchService = async () => {
    try {
      const response = await fetch(`/api/services/${serviceId}`)
      if (response.ok) {
        const data = await response.json()
        setService(data)
      }
    } catch (error) {
      console.error('Failed to fetch service:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBundles = async () => {
    try {
      const response = await fetch(`/api/services/${serviceId}/bundles`)
      if (response.ok) {
        const data = await response.json()
        setBundles(data.bundles || [])
      }
    } catch (error) {
      console.error('Failed to fetch bundles:', error)
    }
  }

  const handleAddToCart = () => {
    if (!service) return
    addServiceToCart(service.id)
    setShowAdded(true)
    setTimeout(() => setShowAdded(false), 1500)
  }

  const handleRequestQuote = () => {
    router.push(`/?contact=true&service=${serviceId}`)
  }

  const handleAction = () => {
    if (service?.is_quote_based) {
      handleRequestQuote()
    } else {
      handleAddToCart()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <div className="pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="text-gray-400">Loading service...</div>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <div className="pt-24 pb-12 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-gray-400 mb-4">Service not found</p>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
            >
              <ArrowLeft size={20} />
              Back to Services
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const delivery = DELIVERY_ICONS[service.delivery_method] || DELIVERY_ICONS.virtual
  const deliverablesList = Array.isArray(service.deliverables) ? service.deliverables : []
  const topicsList = Array.isArray(service.topics) ? service.topics : []
  const breadcrumbItems: { label: string; href?: string }[] = [
    { label: 'Services', href: '/services' },
    { label: String(service.title) },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={breadcrumbItems} />

          {/* Back link */}
          <div className="mb-8">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Services
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden"
          >
            {/* Hero */}
            <div className="relative h-64 md:h-80 bg-gradient-to-br from-cyan-900/20 to-blue-900/20">
              {service.image_url ? (
                <Image
                  src={service.image_url}
                  alt={service.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building className="text-cyan-500/40" size={80} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <span className="px-3 py-1 bg-gray-900/80 rounded-full text-xs font-heading tracking-wider text-cyan-400 uppercase">
                  {TYPE_LABELS[service.service_type] || service.service_type}
                </span>
                {service.is_featured && (
                  <span className="ml-2 px-3 py-1 bg-cyan-500/90 text-imperial-navy rounded-full text-xs font-bold uppercase">
                    Featured
                  </span>
                )}
                <h1 className="font-premium text-3xl md:text-4xl text-white mt-4">
                  {service.title}
                </h1>
              </div>
            </div>

            <div className="p-8 md:p-10">
              {/* Meta row */}
              <div className="flex flex-wrap gap-4 mb-6 text-gray-400">
                <span className="flex items-center gap-2">
                  {delivery.icon}
                  {delivery.label}
                </span>
                {service.duration_description && (
                  <span className="flex items-center gap-2">
                    <Clock size={16} />
                    {service.duration_description}
                  </span>
                )}
                {service.max_participants && (
                  <span className="flex items-center gap-2">
                    <Users size={16} />
                    {service.min_participants ?? 1}–{service.max_participants} participants
                  </span>
                )}
              </div>

              {/* Description */}
              {service.description && (
                <p className="text-gray-300 text-lg leading-relaxed mb-8">
                  {service.description}
                </p>
              )}

              {/* Topics */}
              {topicsList.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-heading uppercase tracking-wider text-gray-400 mb-3">
                    Topics Covered
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {topicsList.map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1 bg-gray-800 text-cyan-400 rounded-full text-sm"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Deliverables */}
              {deliverablesList.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-heading uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                    <Package size={16} />
                    Deliverables
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

              {/* Available in packages */}
              {bundles.length > 0 && (
                <div className="mb-8 p-6 bg-gray-800/50 rounded-xl border border-gray-700">
                  <h3 className="text-sm font-heading uppercase tracking-wider text-gray-400 mb-3">
                    Available in Packages
                  </h3>
                  <p className="text-gray-300 text-sm mb-4">
                    This service is included in the following pricing tiers:
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

              {/* Price and CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-6 border-t border-gray-800">
                <div>
                  {service.is_quote_based ? (
                    <span className="text-xl font-semibold text-yellow-400">
                      Contact for Pricing
                    </span>
                  ) : service.price !== null ? (
                    <span className="text-3xl font-bold text-white">
                      {formatCurrency(service.price)}
                    </span>
                  ) : (
                    <span className="text-xl font-semibold text-green-400">Free</span>
                  )}
                </div>
                <motion.button
                  onClick={handleAction}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`px-8 py-4 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    service.is_quote_based
                      ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-700 hover:to-orange-700'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700'
                  }`}
                >
                  {service.is_quote_based ? (
                    <>
                      <MessageSquare size={20} />
                      Request Quote
                    </>
                  ) : showAdded ? (
                    <>
                      <Check size={20} />
                      Added to Cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={20} />
                      Add to Cart
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
