'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Filter, ShoppingCart, ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import PrototypeCard from './PrototypeCard'
import PrototypeFilters from './PrototypeFilters'

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
  demos?: Array<{
    id: string
    title: string
    description: string | null
    demo_type: string
    demo_url: string
    persona_type: string | null
    journey_focus: string | null
    is_primary: boolean
    display_order: number
  }>
  stage_history?: Array<{
    old_stage: string | null
    new_stage: string
    changed_at: string
  }>
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

export default function AppPrototypes() {
  const { user, isAdmin } = useAuth()
  const [prototypes, setPrototypes] = useState<AppPrototype[]>([])
  const [filteredPrototypes, setFilteredPrototypes] = useState<AppPrototype[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filter states
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const fetchPrototypes = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/prototypes')
      if (!response.ok) throw new Error('Failed to fetch prototypes')
      const data = await response.json()
      setPrototypes(data)
    } catch (error) {
      console.error('Error fetching prototypes:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const applyFilters = useCallback(() => {
    let filtered = [...prototypes]
    if (stageFilter) {
      filtered = filtered.filter((p) => p.production_stage === stageFilter)
    }
    if (channelFilter) {
      filtered = filtered.filter((p) => p.channel === channelFilter)
    }
    if (typeFilter) {
      filtered = filtered.filter((p) => p.product_type === typeFilter)
    }
    setFilteredPrototypes(filtered)
  }, [prototypes, stageFilter, channelFilter, typeFilter])

  useEffect(() => {
    fetchPrototypes()
  }, [user, fetchPrototypes])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleEnrollmentSuccess = (prototypeId: string, enrollmentType: string) => {
    setPrototypes(prev => prev.map(p => 
      p.id === prototypeId 
        ? { ...p, user_enrollment: enrollmentType }
        : p
    ))
  }

  return (
    <section id="prototypes" className="py-32 px-6 sm:px-10 lg:px-12 bg-imperial-navy relative overflow-hidden">
      {/* Aurora */}
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-bronze/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
            <Sparkles className="w-3 h-3 text-radiant-gold" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
              Beta
            </span>
          </div>
          <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
            <span className="italic text-radiant-gold">Prototypes</span>
          </h2>
          <p className="font-body text-platinum-white/50 text-lg max-w-2xl mx-auto mb-10">
            Experimental applications and innovative prototypes in various stages of development.
          </p>
          <Link 
            href="/store?type=app"
            className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/60 hover:text-radiant-gold transition-colors pb-2 border-b border-platinum-white/10"
          >
            <span>Explore Apps Store</span>
            <ArrowRight size={14} />
          </Link>
        </motion.div>

        {/* Filters */}
        <div className="mb-12">
          <PrototypeFilters
            stageFilter={stageFilter}
            channelFilter={channelFilter}
            typeFilter={typeFilter}
            onStageChange={setStageFilter}
            onChannelChange={setChannelFilter}
            onTypeChange={setTypeFilter}
          />
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[400px] bg-silicon-slate/20 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-10 flex items-center justify-between">
              <p className="text-[10px] font-heading tracking-widest text-platinum-white/30 uppercase">
                {filteredPrototypes.length} Prototypes Found
              </p>
            </div>

            {/* Prototypes Grid */}
            {filteredPrototypes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {filteredPrototypes.map((prototype, index) => (
                  <PrototypeCard
                    key={prototype.id}
                    prototype={prototype}
                    user={user}
                    isAdmin={isAdmin}
                    onEnrollmentSuccess={handleEnrollmentSuccess}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-32 glass-card border-radiant-gold/10">
                <Filter className="mx-auto mb-6 text-radiant-gold/20" size={48} />
                <p className="font-body text-platinum-white/40">No prototypes match your current refinements.</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
