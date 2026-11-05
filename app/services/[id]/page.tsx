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
import PortfolioVisualMockup from '@/components/visual-assets/PortfolioVisualMockup'
import { recommendSpeakerFit, SPEAKING_SERVICE_ID, type SpeakerFitInput } from '@/lib/speaker-fit'
import ShowcaseCarousel from '@/components/ShowcaseCarousel'
import { resolveServiceGallery } from '@/lib/showcase-preview'
import { prototypeForService, prototypeGallery } from '@/lib/service-prototypes'

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
  const fromQuote = searchParams.get('fromQuote')
  const quoteBackHref = fromQuote === 'qa' && process.env.NODE_ENV === 'development'
    ? '/member/quote?qa=quote' : /^\d+$/.test(fromQuote || '') ? `/member/quote?orderId=${fromQuote}` : '/services'
  const serviceId = params.id as string
  const speakerBrief: SpeakerFitInput = {
    audience: searchParams.get('speakerAudience') || '',
    outcome: searchParams.get('speakerOutcome') || '',
    format: searchParams.get('speakerFormat') || '',
    topic: searchParams.get('speakerTopic') || '',
  }
  const speakerFit = serviceId === SPEAKING_SERVICE_ID ? recommendSpeakerFit(speakerBrief) : null
  const visualCapture = searchParams.get('visualCapture') === '1'
  const visualFocusCodes = (searchParams.get('visualFocus') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const forceGeneratedVisual = searchParams.get('visualRevision') === '1' || visualFocusCodes.some((code) => [
    'missing_image',
    'image_load_failure',
    'high_blank_space_ratio',
    'weak_feature_signal',
    'light_mode_mismatch',
    'dark_mode_mismatch',
    'candidate_below_quality_bar',
  ].includes(code))

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
    if (service?.is_quote_based || service?.price === null) {
      handleRequestQuote()
    } else {
      handleAddToCart()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="pt-24 pb-12 px-4 flex items-center justify-center">
          <div className="text-muted-foreground">Loading service...</div>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <div className="pt-24 pb-12 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <p className="mb-4 text-muted-foreground">Service not found</p>
            <Link
              href={quoteBackHref}
              className="inline-flex items-center gap-2 font-semibold text-foreground underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ArrowLeft size={20} />
              {quoteBackHref === '/services' ? 'Back to Services' : 'Back to quote catalog'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const delivery = DELIVERY_ICONS[service.delivery_method] || DELIVERY_ICONS.virtual
  const prototype = prototypeForService(service.id, service.image_url)
  const gallery = prototype ? prototypeGallery(service.id, service.image_url) : resolveServiceGallery(service.id, service.image_url)
  const quoteRequired = service.is_quote_based || service.price === null
  const deliverablesList = Array.isArray(service.deliverables) ? service.deliverables : []
  const topicsList = Array.isArray(service.topics) ? service.topics : []
  const breadcrumbItems: { label: string; href?: string }[] = [
    { label: 'Services', href: '/services' },
    { label: String(service.title) },
  ]

  if (visualCapture) {
    const typeLabel = TYPE_LABELS[service.service_type] || service.service_type || 'Service'
    const priceLabel = quoteRequired
      ? 'Custom scope'
      : service.price !== null
        ? formatCurrency(service.price)
        : 'Price on request'
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
    const useGeneratedVisual = !service.image_url || forceGeneratedVisual

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
              {useGeneratedVisual ? (
                <>
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-background">
                    <PortfolioVisualMockup
                      kind="service"
                      title={service.title}
                      eyebrow={typeLabel}
                      primaryLabel={deliveryLabel}
                      secondaryLabel={durationLabel}
                      items={[...featuredDeliverables, ...featuredTopics, ...deliveryPath]}
                      focusCodes={visualFocusCodes}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-background/80 p-5">
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        {delivery.icon}
                        <span className="text-sm font-bold uppercase tracking-wider">Delivery</span>
                      </div>
                      <p className="text-2xl font-bold">{deliveryLabel}</p>
                    </div>
                    <div className="rounded-xl border border-radiant-gold/40 bg-radiant-gold/10 p-5">
                      <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Investment</span>
                      <p className="mt-2 text-3xl font-bold text-radiant-gold">{priceLabel}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative h-72 overflow-hidden rounded-xl border border-border bg-background">
                    <Image
                      src={service.image_url || ''}
                      alt={service.title}
                      fill
                      className="object-cover"
                      sizes="520px"
                      priority
                    />
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
                </>
              )}
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
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={breadcrumbItems} />

          {/* Back link */}
          <div className="mb-8">
            <Link
              href={quoteBackHref}
              className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ArrowLeft size={20} />
              {quoteBackHref === '/services' ? 'Back to Services' : 'Back to quote catalog'}
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground"
          >
            {/* Service visual and title */}
            <div className="bg-muted/50">
              {gallery.length > 0 ? <ShowcaseCarousel frames={gallery} title={service.title} /> : (
                <div className="flex aspect-[5/3] items-center justify-center bg-muted text-center text-sm text-muted-foreground">
                  A reviewed service visual is not available yet.
                </div>
              )}
              <div className="px-6 pb-6 pt-5">
                <span className="rounded-full bg-card px-3 py-1 font-heading text-xs uppercase tracking-wider text-card-foreground">
                  {TYPE_LABELS[service.service_type] || service.service_type}
                </span>
                {service.is_featured && (
                  <span className="ml-2 rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase text-accent-foreground">
                    Featured
                  </span>
                )}
                <h1 className="mt-4 font-premium text-3xl text-card-foreground md:text-4xl">
                  {service.title}
                </h1>
                {prototype && <Link href={`/service-prototypes/${prototype.slug}`} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-card-foreground underline decoration-accent underline-offset-4">Explore interactive preview <ExternalLink size={15} /></Link>}
              </div>
            </div>

            <div className="p-8 md:p-10">
              {/* Meta row */}
              <div className="mb-6 flex flex-wrap gap-4 text-muted-foreground">
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
              {speakerFit && (
                <section className="mb-8 border-l-4 border-radiant-gold bg-radiant-gold/10 p-5" aria-label="Your speaker fit brief">
                  <p className="text-xs font-bold uppercase tracking-widest text-card-foreground">Your speaker fit brief</p>
                  <h2 className="mt-2 font-premium text-2xl text-card-foreground">{speakerFit.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-card-foreground">{speakerFit.fit}</p>
                  <p className="mt-3 text-xs text-muted-foreground">These choices are kept in this URL. Mention your event details when you inquire.</p>
                  <Link href="/speaking#brief" className="mt-3 inline-block text-sm font-semibold text-card-foreground underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent">Revise your brief</Link>
                </section>
              )}
              {service.description && (
                <p className="mb-8 text-lg leading-relaxed text-card-foreground">
                  {service.description}
                </p>
              )}

              {/* Topics */}
              {topicsList.length > 0 && (
                <div className="mb-8">
                  <h3 className="mb-3 font-heading text-sm uppercase tracking-wider text-muted-foreground">
                    Topics Covered
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {topicsList.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-3 py-1 text-sm text-foreground"
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
                  <h3 className="mb-3 flex items-center gap-2 font-heading text-sm uppercase tracking-wider text-muted-foreground">
                    <Package size={16} />
                    Deliverables
                  </h3>
                  <ul className="space-y-2">
                    {deliverablesList.map((d) => (
                      <li key={d} className="flex items-center gap-2 text-card-foreground">
                        <Check className="flex-shrink-0 text-foreground" size={18} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Available in packages */}
              {bundles.length > 0 && (
                <div className="mb-8 rounded-xl border border-border bg-muted p-6">
                  <h3 className="mb-3 font-heading text-sm uppercase tracking-wider text-muted-foreground">
                    Available in Packages
                  </h3>
                  <p className="mb-4 text-sm text-foreground">
                    This service is included in the following pricing tiers:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bundles.map((b) => (
                      <Link
                        key={`${b.slug}-${b.segment}`}
                        href={b.pricingUrl}
                        className="inline-flex items-center gap-2 rounded-lg border border-accent bg-card px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {b.name}
                        <ExternalLink size={14} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Price and CTA */}
              <div className="flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {quoteRequired ? (
                    <span className="text-xl font-semibold text-card-foreground">
                      Price on request
                    </span>
                  ) : service.price !== null ? (
                    <span className="text-3xl font-bold text-card-foreground">
                      {formatCurrency(service.price)}
                    </span>
                  ) : (
                    <span className="text-xl font-semibold text-card-foreground">Free</span>
                  )}
                </div>
                <motion.button
                  onClick={handleAction}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="service-primary-action min-h-12 justify-center px-8 py-4"
                >
                  {quoteRequired ? (
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
