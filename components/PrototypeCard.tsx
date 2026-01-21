'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Smartphone, Globe, Wrench, Sparkles, 
  ExternalLink, Download, MessageSquare, Star,
  CheckCircle2, TrendingUp, Info, ShoppingCart
} from 'lucide-react'
import Link from 'next/link'
import PrototypeDemoSelector from './PrototypeDemoSelector'
import PrototypeEnrollment from './PrototypeEnrollment'
import PrototypeFeedback from './PrototypeFeedback'
import ExpandableText from '@/components/ui/ExpandableText'

interface Demo {
  id: string
  title: string
  description: string | null
  demo_type: string
  demo_url: string
  persona_type: string | null
  journey_focus: string | null
  is_primary: boolean
  display_order: number
}

interface AppPrototype {
  id: string
  title: string
  description: string
  purpose: string
  production_stage: 'Dev' | 'QA' | 'Pilot' | 'Production'
  channel: 'Web' | 'Mobile'
  product_type: 'Utility' | 'Experience'
  thumbnail_url?: string
  download_url?: string
  app_repo_url?: string
  demos?: Demo[]
  feedback_count?: number
  user_enrollment?: string | null
  analytics?: {
    active_users?: number
    pageviews?: number
    downloads?: number
  }
  linked_product?: {
    id: number
    price: number | null
  } | null
}

export default function PrototypeCard({ prototype, user, index, onEnrollmentSuccess }: any) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Dev': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5'
      case 'QA': return 'text-blue-400 border-blue-500/30 bg-blue-500/5'
      case 'Pilot': return 'text-radiant-gold border-radiant-gold/30 bg-radiant-gold/5'
      case 'Production': return 'text-green-400 border-green-500/30 bg-green-500/5'
      default: return 'text-platinum-white/40 border-platinum-white/10'
    }
  }

  const TypeIcon = prototype.product_type === 'Utility' ? Wrench : Sparkles
  const ChannelIcon = prototype.channel === 'Mobile' ? Smartphone : Globe

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group relative bg-silicon-slate/40 backdrop-blur-md rounded-2xl overflow-hidden border border-radiant-gold/5 hover:border-radiant-gold/20 transition-all duration-500 flex flex-col hover:-translate-y-2"
    >
      {/* Mouse Tracking Glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212, 175, 55, 0.05), transparent 40%)`
        }}
      />

      {/* Media Section */}
      <div className="relative h-56 overflow-hidden flex-shrink-0">
        {prototype.demos && prototype.demos.length > 0 ? (
          <PrototypeDemoSelector
            demos={prototype.demos}
            prototypeId={prototype.id}
            onDemoChange={setSelectedDemoId}
          />
        ) : (
          <img
            src={prototype.thumbnail_url || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800'}
            alt={prototype.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[30%] group-hover:grayscale-0"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-silicon-slate via-transparent to-transparent opacity-60" />
        
        {/* Stage Badge */}
        <div className={`absolute top-6 left-6 px-3 py-1 rounded-full text-[10px] font-heading tracking-widest uppercase border ${getStageColor(prototype.production_stage)} backdrop-blur-md`}>
          {prototype.production_stage}
        </div>
      </div>

      <div className="p-8 flex flex-col flex-grow relative z-10">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-premium text-2xl text-platinum-white group-hover:text-radiant-gold transition-colors">
            {prototype.title}
          </h3>
          <div className="flex gap-3 text-platinum-white/30">
            <ChannelIcon size={16} />
            <TypeIcon size={16} />
          </div>
        </div>

        <ExpandableText
          text={prototype.description}
          maxHeight={60}
          className="font-body text-platinum-white/50 text-sm leading-relaxed mb-6"
          expandButtonColor="text-radiant-gold hover:text-gold-light"
        />

        {/* Analytics/Metrics */}
        {prototype.analytics && (
          <div className="flex flex-wrap gap-4 mb-8">
            {prototype.analytics.active_users && (
              <div className="flex items-center gap-2 text-green-400/80">
                <TrendingUp size={12} />
                <span className="text-[10px] font-heading tracking-wider uppercase">{prototype.analytics.active_users} Users</span>
              </div>
            )}
            {prototype.feedback_count && (
              <div className="flex items-center gap-2 text-radiant-gold/80">
                <Star size={12} />
                <span className="text-[10px] font-heading tracking-wider uppercase">{prototype.feedback_count} Reviews</span>
              </div>
            )}
          </div>
        )}

        <div className="flex-grow" />

        {/* Actions */}
        <div className="space-y-3 pt-6 border-t border-radiant-gold/5">
          {prototype.linked_product && (
            <Link
              href={`/store/${prototype.linked_product.id}`}
              className="w-full flex items-center justify-center gap-3 py-3 bg-radiant-gold text-imperial-navy rounded-full text-[10px] font-heading tracking-widest uppercase font-bold hover:brightness-110 transition-all"
            >
              <ShoppingCart size={14} />
              <span>Get Access</span>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3">
            {prototype.app_repo_url && (
              <a
                href={prototype.app_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 border border-platinum-white/10 rounded-full text-[10px] font-heading tracking-widest uppercase text-platinum-white/60 hover:text-platinum-white hover:border-platinum-white/20 transition-all"
              >
                Repo
              </a>
            )}
            <button
              onClick={() => setShowFeedback(!showFeedback)}
              className="flex items-center justify-center gap-2 py-2 border border-platinum-white/10 rounded-full text-[10px] font-heading tracking-widest uppercase text-platinum-white/60 hover:text-platinum-white hover:border-platinum-white/20 transition-all"
            >
              {showFeedback ? 'Hide' : 'Feedback'}
            </button>
          </div>
        </div>

        {/* Feedback Section Overlay */}
        {showFeedback && (
          <div className="mt-6 pt-6 border-t border-radiant-gold/5">
            <PrototypeFeedback
              prototypeId={prototype.id}
              stage={prototype.production_stage}
              user={user}
              userEnrollment={prototype.user_enrollment || null}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}
