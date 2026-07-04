'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const serviceId = params.id as string
  const visualCapture = searchParams.get('visualCapture') === '1'

  const [service, setService] = useState<Service | null>(null)
  const [bundles, setBundles] = useState<BundleRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdded, setShowAdded] = useState(false)

  const fetchService = useCallback(async () => {
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
  }, [serviceId])

  const fetchBundles = useCallback(async () => {
    try {
      const response = await fetch(`/api/services/${serviceId}/bundles`)
      if (response.ok) {
        const data = await response.json()
        setBundles(data.bundles || [])
      }
    } catch (error) {
      console.error('Failed to fetch bundles:', error)
    }
  }, [serviceId])

  useEffect(() => {
    fetchService()
    fetchBundles()
  }, [fetchService, fetchBundles])

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

  if (visualCapture) {
    const typeLabel = TYPE_LABELS[service.service_type] || service.service_type || 'Service'
    const priceLabel = service.is_quote_based
      ? 'Custom scope'
      : service.price !== null
        ? formatCurrency(service.price)
        : 'Free'
    const deliveryLabel = delivery.label
    const durationLabel = service.duration_description || (
      service.duration_hours ? `${service.duration_hours} hours` : 'Scoped delivery'
    )
    const featuredTopics = topicsList.length > 0
      ? topicsList.slice(0, 5)
      : ['Discovery', 'Implementation', 'Operator handoff']
    const featuredDeliverables = deliverablesList.length > 0
      ? deliverablesList.slice(0, 4)
      : ['Working session', 'Action plan', 'Implementation guidance', 'Follow-up notes']
    const deliveryPath = [
      'Diagnose the operating constraint',
      'Build the practical delivery plan',
      'Leave the team with a usable handoff',
    ]

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden p-10">
        <section
          data-visual-capture-frame
          className="relative h-[720px] w-[1280px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(18,30,49,0.08),rgba(212,175,55,0.16)_44%,transparent_72%)] dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.22),transparent_44%,rgba(234,236,238,0.08))]" />
          <div className="absolute left-0 top-0 h-full w-2 bg-radiant-gold" />
          <div className="relative grid h-full grid-cols-[0.9fr_1.1fr] gap-8 p-12">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="relative h-72 overflow-hidden rounded-xl border border-border bg-background">
                {service.image_url ? (
                  <Image
                    src={service.image_url}
                    alt={service.title}
                    fill
                    className="object-cover"
                    sizes="520px"
                    priority
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_35%_25%,rgba(212,175,55,0.3),transparent_34%),linear-gradient(135deg,rgba(44,62,80,0.14),rgba(212,175,55,0.2))] dark:bg-[radial-gradient(circle_at_35%_25%,rgba(212,175,55,0.3),transparent_34%),linear-gradient(135deg,rgba(234,236,238,0.1),rgba(212,175,55,0.16))]">
                    <Building className="h-20 w-20 text-radiant-gold" />
                    <span className="text-lg font-semibold text-muted-foreground">Service delivery visual</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-background/80 p-5">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    {delivery.icon}
                    <span className="text-sm font-bold uppercase tracking-wider">Delivery</span>
                  </div>
                  <p className="text-2xl font-bold">{deliveryLabel}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/80 p-5">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase tracking-wider">Timeline</span>
                  </div>
                  <p className="text-2xl font-bold">{durationLabel}</p>
                </div>
              </div>

              <div className="rounded-xl border border-radiant-gold/40 bg-radiant-gold/10 p-5">
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Investment</span>
                <p className="mt-2 text-4xl font-bold text-radiant-gold">{priceLabel}</p>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-between">
              <div>
                <div className="mb-7 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-radiant-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-imperial-navy">
                    {typeLabel}
                  </span>
                  {service.is_featured && (
                    <span className="rounded-full border border-radiant-gold/50 bg-radiant-gold/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-radiant-gold">
                      Featured
                    </span>
                  )}
                </div>
                <h1 className="font-premium text-[60px] leading-[0.98] text-foreground">
                  {service.title}
                </h1>
                {service.description && (
                  <p className="mt-6 max-h-32 overflow-hidden text-2xl leading-snug text-muted-foreground">
                    {service.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-[1fr_1fr] gap-5">
                <div className="rounded-xl border border-border bg-background/80 p-5">
                  <span className="mb-4 block text-sm font-bold uppercase tracking-wider text-muted-foreground">Delivery path</span>
                  <div className="space-y-3">
                    {deliveryPath.map((item, index) => (
                      <div key={item} className="flex items-start gap-3">
                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-silicon-slate text-xs font-bold text-platinum-white dark:bg-radiant-gold dark:text-imperial-navy">
                          {index + 1}
                        </span>
                        <span className="text-lg font-semibold leading-tight">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background/80 p-5">
                  <span className="mb-4 block text-sm font-bold uppercase tracking-wider text-muted-foreground">Deliverables</span>
                  <div className="space-y-3">
                    {featuredDeliverables.map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <Check className="mt-1 h-5 w-5 flex-none text-radiant-gold" />
                        <span className="text-lg font-semibold leading-tight">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {featuredTopics.map((topic) => (
                  <span key={topic} className="rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-bold text-muted-foreground">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

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
