'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, DollarSign, Clock, Users, MapPin, Video, Building, MessageSquare, Check, ArrowRight, Play, ImageOff } from 'lucide-react'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import type { Service } from '@/lib/types/store'
import { formatDollarAmount } from '@/lib/pricing-model'
import { resolveThemeImageUrl } from '@/lib/visual-asset-variants'
import { resolveServiceGallery } from '@/lib/showcase-preview'
import ShowcaseCarousel from './ShowcaseCarousel'

interface ServiceCardProps {
  service: Service
  onAddToCart: (serviceId: string) => void
  onRequestQuote?: (serviceId: string) => void
  /** When set, shows a "View details" link to the service detail page */
  viewDetailsHref?: string
}

const TYPE_LABELS: Record<string, string> = {
  training: 'Training Program',
  speaking: 'Speaking Engagement',
  consulting: 'Consulting',
  coaching: 'Coaching',
  workshop: 'Workshop',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  training: <Users size={16} />,
  speaking: <MessageSquare size={16} />,
  consulting: <Building size={16} />,
  coaching: <Users size={16} />,
  workshop: <Users size={16} />,
}

const DELIVERY_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  virtual: { icon: <Video size={14} />, label: 'Virtual' },
  in_person: { icon: <MapPin size={14} />, label: 'In-Person' },
  hybrid: { icon: <Building size={14} />, label: 'Hybrid' },
}

const SELF_PACED_COURSE_ID = 'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2'

export default function ServiceCard({ service, onAddToCart, onRequestQuote, viewDetailsHref }: ServiceCardProps) {
  const [showAdded, setShowAdded] = useState(false)
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { resolvedTheme } = useTheme()
  const imageUrl = resolveThemeImageUrl({
    imageUrl: service.image_url,
    imageVariants: service.image_variants,
    theme: resolvedTheme,
  })
  const gallery = resolveServiceGallery(service.id, service.image_url)
  const quoteRequired = service.is_quote_based || service.price === null

  const handleAction = () => {
    if (quoteRequired && onRequestQuote) {
      onRequestQuote(service.id)
    } else {
      onAddToCart(service.id)
      setShowAdded(true)
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
      addedTimerRef.current = setTimeout(() => setShowAdded(false), 1000)
    }
  }

  const delivery = DELIVERY_ICONS[service.delivery_method] || DELIVERY_ICONS.virtual

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="agent-ops-card group flex h-full flex-col rounded-xl border transition-colors hover:border-radiant-gold/50"
    >
      {/* Image */}
      <div className="relative border-b border-radiant-gold/10 bg-[#101c2d]">
        {gallery.length > 0 ? (
          <ShowcaseCarousel frames={gallery} title={service.title} fallbackUrl={imageUrl} />
        ) : (
          <div className="flex aspect-[5/3] flex-col items-center justify-center gap-3 px-6 text-center text-white/75">
            <ImageOff size={26} aria-hidden="true" />
            <p className="text-sm font-semibold">Service visual pending</p>
            <p className="max-w-xs text-xs leading-5">A reviewed service image or deliverable preview has not been added. Open details to learn what is included.</p>
          </div>
        )}
        {gallery.length === 1 && <p className="px-3 py-2 text-xs text-white/70">More service evidence pending · <Link href={viewDetailsHref || `/services/${service.id}`} className="underline underline-offset-2 hover:text-white">View details</Link></p>}
        {service.is_featured && (
          <div className="pointer-events-none absolute z-30 top-2 right-2 px-2 py-1 bg-radiant-gold text-imperial-navy text-xs font-semibold rounded">
            Featured
          </div>
        )}
        <div className="pointer-events-none absolute z-30 top-2 left-2 max-w-[60%] px-2 py-1 bg-silicon-slate/90 text-foreground text-xs rounded flex items-center gap-1">
          {TYPE_ICONS[service.service_type]}
          {TYPE_LABELS[service.service_type] || service.service_type}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{service.title}</h3>
        
        {/* Service Details */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Delivery Method */}
          <span className="px-2 py-1 bg-silicon-slate text-foreground text-xs rounded flex items-center gap-1">
            {delivery.icon}
            {delivery.label}
          </span>
          
          {/* Duration */}
          {service.duration_description && (
            <span className="px-2 py-1 bg-silicon-slate text-foreground text-xs rounded flex items-center gap-1">
              <Clock size={12} />
              {service.duration_description}
            </span>
          )}
          
          {/* Participants */}
          {service.max_participants && (
            <span className="px-2 py-1 bg-silicon-slate text-foreground text-xs rounded flex items-center gap-1">
              <Users size={12} />
              {service.min_participants}-{service.max_participants}
            </span>
          )}
        </div>

        {service.description && (
          <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{service.description}</p>
        )}

        {/* View details link */}
        {viewDetailsHref && (
          <div className="mb-3">
            <Link
              href={viewDetailsHref}
              className="text-radiant-gold hover:text-gold-light text-sm flex items-center gap-1"
            >
              View details
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Watch video link */}
        {service.video_url && (
          <div className="mb-3">
            <a
              href={service.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-radiant-gold hover:text-gold-light text-sm flex items-center gap-1"
            >
              <Play size={14} />
              Watch video
            </a>
          </div>
        )}
        {service.id === SELF_PACED_COURSE_ID && !service.video_url && (
          <div className="mb-3">
            <button type="button" disabled aria-describedby={`course-preview-status-${service.id}`} className="flex cursor-not-allowed items-center gap-1 text-sm text-muted-foreground/80">
              <Play size={14} aria-hidden="true" /> Watch course preview
            </button>
            <p id={`course-preview-status-${service.id}`} className="mt-1 text-xs text-muted-foreground">Preview pending script review, an approved render, and a bound video.</p>
          </div>
        )}
        {service.presentation_url && (
          <a href={service.presentation_url} target="_blank" rel="noopener noreferrer" className="mb-3 flex items-center gap-1 text-sm text-radiant-gold hover:text-gold-light">
            View presentation <ArrowRight size={14} aria-hidden="true" />
          </a>
        )}

        {/* Price and Action Button */}
        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {quoteRequired ? (
              <span className="text-lg font-semibold text-radiant-gold">Price on request</span>
            ) : service.price !== null ? (
              <>
                <DollarSign className="text-radiant-gold" size={20} />
                <span className="text-2xl font-bold text-white">{formatDollarAmount(service.price)}</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-radiant-gold">Free</span>
            )}
          </div>
          <motion.button
            onClick={handleAction}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="agent-ops-button-primary shrink-0"
          >
            {quoteRequired ? (
              <>
                <MessageSquare size={18} />
                Request Quote
              </>
            ) : showAdded ? (
              <>
                <Check size={18} />
                Added!
              </>
            ) : (
              <>
                <ShoppingCart size={18} />
                Add to Cart
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
