'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, DollarSign, Clock, Users, MapPin, Video, Building, MessageSquare, Image as ImageIcon, Check } from 'lucide-react'
import { useState, useRef } from 'react'
import type { Service } from '@/lib/types/store'

interface ServiceCardProps {
  service: Service
  onAddToCart: (serviceId: string) => void
  onRequestQuote?: (serviceId: string) => void
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

export default function ServiceCard({ service, onAddToCart, onRequestQuote }: ServiceCardProps) {
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
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-colors"
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-cyan-900/20 to-blue-900/20">
        {service.image_url && !imageError ? (
          <img
            src={service.image_url}
            alt={service.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-cyan-600">
              {TYPE_ICONS[service.service_type] || <Users size={48} />}
            </div>
          </div>
        )}
        {service.is_featured && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-cyan-600 text-white text-xs font-semibold rounded">
            Featured
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-1 bg-gray-900/80 text-white text-xs rounded flex items-center gap-1">
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
          <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded flex items-center gap-1">
            {delivery.icon}
            {delivery.label}
          </span>
          
          {/* Duration */}
          {service.duration_description && (
            <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded flex items-center gap-1">
              <Clock size={12} />
              {service.duration_description}
            </span>
          )}
          
          {/* Participants */}
          {service.max_participants && (
            <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded flex items-center gap-1">
              <Users size={12} />
              {service.min_participants}-{service.max_participants}
            </span>
          )}
        </div>

        {service.description && (
          <p className="text-gray-400 text-sm mb-4 line-clamp-3">{service.description}</p>
        )}

        {/* Price and Action Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {service.is_quote_based ? (
              <span className="text-lg font-semibold text-yellow-400">Contact for Pricing</span>
            ) : service.price !== null ? (
              <>
                <DollarSign className="text-green-400" size={20} />
                <span className="text-2xl font-bold text-white">${service.price.toFixed(2)}</span>
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
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700'
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
