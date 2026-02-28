'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ShoppingCart, DollarSign, Clock, Users, MapPin, Video, Building, MessageSquare, Image as ImageIcon, Check, ArrowRight, Play } from 'lucide-react'
import { useState, useRef } from 'react'
import Link from 'next/link'
import type { Service } from '@/lib/types/store'
import { formatDollarAmount } from '@/lib/pricing-model'

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

export default function ServiceCard({ service, onAddToCart, onRequestQuote, viewDetailsHref }: ServiceCardProps) {
  const [imageError, setImageError] = useState(false)
  const [showAdded, setShowAdded] = useState(false)
  const addedTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleAction = () => {
    if (service.is_quote_based && onRequestQuote) {
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
      className="bg-silicon-slate border border-silicon-slate rounded-xl overflow-hidden hover:border-radiant-gold/50 transition-colors"
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-bronze/20 to-radiant-gold/20">
        {service.image_url && !imageError ? (
          <Image
            src={service.image_url}
            alt={service.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 320px"
            unoptimized
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-radiant-gold">
              {TYPE_ICONS[service.service_type] || <Users size={48} />}
            </div>
          </div>
        )}
        {service.is_featured && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-radiant-gold text-imperial-navy text-xs font-semibold rounded">
            Featured
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-1 bg-silicon-slate/80 text-foreground text-xs rounded flex items-center gap-1">
          {TYPE_ICONS[service.service_type]}
          {TYPE_LABELS[service.service_type] || service.service_type}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{service.title}</h3>
        
        {/* Service Details */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Delivery Method */}
          <span className="px-2 py-1 bg-silicon-slate text-platinum-white text-xs rounded flex items-center gap-1">
            {delivery.icon}
            {delivery.label}
          </span>
          
          {/* Duration */}
          {service.duration_description && (
            <span className="px-2 py-1 bg-silicon-slate text-platinum-white text-xs rounded flex items-center gap-1">
              <Clock size={12} />
              {service.duration_description}
            </span>
          )}
          
          {/* Participants */}
          {service.max_participants && (
            <span className="px-2 py-1 bg-silicon-slate text-platinum-white text-xs rounded flex items-center gap-1">
              <Users size={12} />
              {service.min_participants}-{service.max_participants}
            </span>
          )}
        </div>

        {service.description && (
          <p className="text-platinum-white/80 text-sm mb-4 line-clamp-3">{service.description}</p>
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

        {/* Price and Action Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {service.is_quote_based ? (
              <span className="text-lg font-semibold text-yellow-400">Contact for Pricing</span>
            ) : service.price !== null ? (
              <>
                <DollarSign className="text-green-400" size={20} />
                <span className="text-2xl font-bold text-white">{formatDollarAmount(service.price)}</span>
              </>
            ) : (
              <span className="text-lg font-semibold text-green-400">Free</span>
            )}
          </div>
          <motion.button
            onClick={handleAction}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 transition-colors ${
              service.is_quote_based
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-700 hover:to-orange-700'
                : 'btn-gold'
            }`}
          >
            {service.is_quote_based ? (
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
