'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Filter } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
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

  useEffect(() => {
    fetchPrototypes()
  }, [user])

  useEffect(() => {
    applyFilters()
  }, [prototypes, stageFilter, channelFilter, typeFilter])

  const fetchPrototypes = async () => {
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
  }

  const applyFilters = () => {
    let filtered = [...prototypes]

    if (stageFilter) {
      filtered = filtered.filter(p => p.production_stage === stageFilter)
    }
    if (channelFilter) {
      filtered = filtered.filter(p => p.channel === channelFilter)
    }
    if (typeFilter) {
      filtered = filtered.filter(p => p.product_type === typeFilter)
    }

    setFilteredPrototypes(filtered)
  }

  const handleEnrollmentSuccess = (prototypeId: string, enrollmentType: string) => {
    setPrototypes(prev => prev.map(p => 
      p.id === prototypeId 
        ? { ...p, user_enrollment: enrollmentType }
        : p
    ))
  }

  return (
    <section id="prototypes" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="text-purple-500" size={40} />
            <h2 className="text-4xl md:text-5xl font-bold">
              <span className="gradient-text">App Prototypes</span>
            </h2>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Explore innovative applications across different stages of development
          </p>
        </motion.div>

        {/* Filters */}
        <PrototypeFilters
          stageFilter={stageFilter}
          channelFilter={channelFilter}
          typeFilter={typeFilter}
          onStageChange={setStageFilter}
          onChannelChange={setChannelFilter}
          onTypeChange={setTypeFilter}
        />

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-gray-400">Loading prototypes...</div>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-6 text-gray-400">
              Showing {filteredPrototypes.length} of {prototypes.length} prototypes
            </div>

            {/* Prototypes Grid */}
            {filteredPrototypes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <div className="text-center py-20 text-gray-500">
                <Filter className="mx-auto mb-4 opacity-50" size={48} />
                <p>No prototypes match your filters. Try adjusting your selection.</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
