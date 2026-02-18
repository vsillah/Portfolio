'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, ArrowRight, Building, Users, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPriceOrFree } from '@/lib/pricing-model'

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
  image_url: string | null
  is_featured: boolean
  display_order: number
}

const TYPE_LABELS: Record<string, string> = {
  training: 'Training',
  speaking: 'Speaking',
  consulting: 'Consulting',
  coaching: 'Coaching',
  workshop: 'Workshop',
  warranty: 'Warranty',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  training: <Users size={20} />,
  speaking: <MessageSquare size={20} />,
  consulting: <Building size={20} />,
  coaching: <Users size={20} />,
  workshop: <Users size={20} />,
  warranty: <Briefcase size={20} />,
}

const DELIVERY_LABELS: Record<string, string> = {
  virtual: 'Virtual',
  in_person: 'In-Person',
  hybrid: 'Hybrid',
}

const SUBSECTION_ACCENTS: Record<string, { border: string; badge: string; icon: string; hover: string }> = {
  build: {
    border: 'border-cyan-500/30',
    badge: 'border-cyan-500/30 text-cyan-400',
    icon: 'text-cyan-500/40',
    hover: 'hover:border-cyan-500/40 group-hover:text-cyan-400',
  },
  advisory: {
    border: 'border-amber-500/30',
    badge: 'border-amber-500/30 text-amber-400',
    icon: 'text-amber-500/40',
    hover: 'hover:border-amber-500/40 group-hover:text-amber-400',
  },
  warranty: {
    border: 'border-slate-500/30',
    badge: 'border-slate-400/30 text-slate-400',
    icon: 'text-slate-500/40',
    hover: 'hover:border-slate-500/40 group-hover:text-slate-400',
  },
}

function getSubsection(service: Service): 'build' | 'advisory' | 'warranty' {
  if (service.service_type === 'warranty') return 'warranty'
  if (service.service_type === 'consulting') return 'build'
  return 'advisory'
}

export default function Services() {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services?active=true')
      if (response.ok) {
        const data = await response.json()
        const sorted = (data || [])
          .sort((a: Service, b: Service) => {
            if (a.is_featured && !b.is_featured) return -1
            if (!a.is_featured && b.is_featured) return 1
            return (a.display_order ?? 0) - (b.display_order ?? 0)
          })
          .slice(0, 9)
        setServices(sorted)
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const grouped = useMemo(() => {
    const build: Service[] = []
    const advisory: Service[] = []
    const warranty: Service[] = []
    for (const s of services) {
      const sub = getSubsection(s)
      if (sub === 'build') build.push(s)
      else if (sub === 'advisory') advisory.push(s)
      else warranty.push(s)
    }
    return { build, advisory, warranty }
  }, [services])

  const handleCardClick = (serviceId: string) => {
    router.push(`/services/${serviceId}`)
  }

  const SubsectionGrid = ({
    items,
    category,
    title,
    accent,
  }: {
    items: Service[]
    category: 'build' | 'advisory' | 'warranty'
    title: string
    accent: (typeof SUBSECTION_ACCENTS)['build']
  }) => {
    if (items.length === 0) return null
    return (
      <div className="mb-16 last:mb-0">
        <h3 className="text-lg font-heading uppercase tracking-wider text-platinum-white/70 mb-6">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {items.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.08 }}
              onClick={() => handleCardClick(service.id)}
              className={`group relative bg-silicon-slate/40 backdrop-blur-md rounded-2xl overflow-hidden border border-radiant-gold/5 ${accent.border} transition-all duration-500 cursor-pointer`}
            >
              <div className="relative h-64 overflow-hidden">
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-imperial-navy">
                    <span className={accent.icon}>
                      {TYPE_ICONS[service.service_type] || <Briefcase size={48} />}
                    </span>
                  </div>
                )}
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                  <span className={`px-3 py-1 bg-imperial-navy/80 backdrop-blur-md rounded-full text-[10px] font-heading tracking-widest uppercase ${accent.badge}`}>
                    {TYPE_LABELS[service.service_type] || service.service_type}
                  </span>
                  {service.is_featured && (
                    <span className="px-3 py-1 bg-cyan-500/90 text-imperial-navy rounded-full text-[10px] font-heading tracking-widest uppercase font-bold">
                      Featured
                    </span>
                  )}
                </div>
                <div className="absolute bottom-6 right-6 px-4 py-2 bg-imperial-navy/90 backdrop-blur-md border border-radiant-gold/20 rounded-full text-radiant-gold text-sm font-heading tracking-tighter">
                  {service.is_quote_based
                    ? 'Quote'
                    : service.price !== null
                      ? formatPriceOrFree(service.price)
                      : 'Free'}
                </div>
              </div>
              <div className="p-8">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-[10px] font-heading text-platinum-white/60 uppercase tracking-wider">
                    {DELIVERY_LABELS[service.delivery_method] || service.delivery_method}
                  </span>
                  {service.duration_description && (
                    <>
                      <span className="text-platinum-white/30">·</span>
                      <span className="text-[10px] font-body text-platinum-white/50">
                        {service.duration_description}
                      </span>
                    </>
                  )}
                </div>
                <h3 className={`font-premium text-2xl text-platinum-white transition-colors mb-3 ${accent.hover}`}>
                  {service.title}
                </h3>
                {service.description && (
                  <p className="font-body text-platinum-white/50 text-sm line-clamp-2 mb-8">
                    {service.description}
                  </p>
                )}
                <div className={`w-full flex items-center justify-center gap-3 py-3 border rounded-full transition-all duration-300 ${category === 'build' ? 'border-cyan-500/20 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/40' : category === 'advisory' ? 'border-amber-500/20 group-hover:bg-amber-500/10 group-hover:border-amber-500/40' : 'border-slate-500/20 group-hover:bg-slate-500/10 group-hover:border-slate-500/40'}`}>
                  <span className={`text-[10px] font-heading tracking-widest uppercase ${accent.badge.split(' ')[1] || 'text-cyan-400'}`}>
                    View Details
                  </span>
                  <ArrowRight size={14} className={accent.badge.split(' ')[1] || 'text-cyan-400'} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <section id="services" className="py-32 bg-silicon-slate/10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="h-10 w-48 bg-silicon-slate/20 mx-auto rounded-full animate-pulse" />
        </div>
      </section>
    )
  }

  if (services.length === 0) {
    return null
  }

  return (
    <section id="services" className="py-32 px-6 sm:px-10 lg:px-12 bg-silicon-slate/10 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="pill-badge bg-silicon-slate/30 border-cyan-500/30 mb-6 mx-auto">
            <Briefcase className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-cyan-400">
              Services
            </span>
          </div>
          <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
            <span className="italic text-cyan-400">Services</span>
          </h2>
          <p className="font-body text-platinum-white/50 text-lg max-w-2xl mx-auto">
            Trainings, speaking engagements, consulting, and more—delivered in-person or virtually.
          </p>
        </motion.div>

        {/* Services by subsection */}
        <SubsectionGrid items={grouped.build} category="build" title="What We Build" accent={SUBSECTION_ACCENTS.build} />
        <SubsectionGrid items={grouped.advisory} category="advisory" title="Advisory & Training" accent={SUBSECTION_ACCENTS.advisory} />
        <SubsectionGrid items={grouped.warranty} category="warranty" title="Warranty & Support" accent={SUBSECTION_ACCENTS.warranty} />

        {/* View All */}
        <div className="text-center mt-20 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/services"
            className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/60 hover:text-cyan-400 transition-colors pb-2 border-b border-platinum-white/10"
          >
            <span>View All Services</span>
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/60 hover:text-cyan-400 transition-colors pb-2 border-b border-platinum-white/10"
          >
            <span>See Pricing &amp; Packages</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}
