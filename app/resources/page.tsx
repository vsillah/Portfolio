'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navigation from '@/components/Navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import LeadMagnetCard from '@/components/LeadMagnetCard'
import AIReadinessScorecard from '@/components/AIReadinessScorecard'
import { getCurrentSession } from '@/lib/auth'
import { FUNNEL_STAGE_OPTIONS } from '@/lib/constants/lead-magnet-funnel'

interface LeadMagnet {
  id: number
  title: string
  description: string | null
  file_type: string
  file_size: number | null
  download_count: number
  file_path: string | null
  created_at: string
  funnel_stage?: string
  funnel_stage_label?: string
  slug?: string | null
  type?: string | null
  /** When set (e.g. service video lead magnet), show "Watch video" CTA */
  video_url?: string | null
  video_thumbnail_url?: string | null
}

export default function ResourcesPage() {
  const { user } = useAuth()
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [funnelFilter, setFunnelFilter] = useState<string>('all')

  const fetchLeadMagnets = useCallback(async () => {
    if (!user) return
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      const params = new URLSearchParams()
      params.set('category', 'gate_keeper')
      params.set('access_type', 'public_gated')
      if (funnelFilter && funnelFilter !== 'all') {
        params.set('funnel_stage', funnelFilter)
      }

      const response = await fetch(`/api/lead-magnets?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch resources')
      }

      const data = await response.json()
      setLeadMagnets(data.leadMagnets || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources')
    } finally {
      setLoading(false)
    }
  }, [user, funnelFilter])

  useEffect(() => {
    fetchLeadMagnets()
  }, [fetchLeadMagnets])

  const handleDownload = async (id: number) => {
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/lead-magnets/${id}/download`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to initiate download')
      }

      const data = await response.json()
      window.open(data.downloadUrl, '_blank')
      setTimeout(() => fetchLeadMagnets(), 1000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download')
    }
  }

  const downloadItems = leadMagnets.filter((m) => m.slug !== 'scorecard' && !m.title?.toLowerCase().includes('scorecard'))

  return (
    <ProtectedRoute>
      <Navigation />
      <div className="min-h-screen bg-imperial-navy text-platinum-white pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={[{ label: 'Store', href: '/store' }, { label: 'Resources' }]} />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold mb-2 text-platinum-white">Resources</h1>
            <p className="text-platinum-white/80">
              Assess your AI readiness and get templates that help you close more deals.
            </p>
            <p className="text-platinum-white/60 text-sm mt-2">
              Prefer a form? Take the{' '}
              <Link href="/tools/audit" className="text-radiant-gold hover:underline">
                standalone AI &amp; Automation Audit
              </Link>
              .
            </p>
          </motion.div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-platinum-white/80 mb-2">
              Filter by stage
            </label>
            <select
              value={funnelFilter}
              onChange={(e) => setFunnelFilter(e.target.value)}
              className="w-full max-w-xs px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
              aria-label="Filter resources by funnel stage"
            >
              <option value="all">All</option>
              {FUNNEL_STAGE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-platinum-white/60">Loading resources...</div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : (
            <>
              <AIReadinessScorecard leadMagnets={downloadItems} />

              <section aria-labelledby="templates-heading">
                <h2 id="templates-heading" className="text-xl font-semibold text-platinum-white mb-4">
                  Templates & playbooks
                </h2>
                {downloadItems.length === 0 ? (
                  <div className="text-center py-8 text-platinum-white/60">
                    No resources in this stage yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {downloadItems.map((leadMagnet) => (
                      <LeadMagnetCard
                        key={leadMagnet.id}
                        leadMagnet={leadMagnet}
                        onDownload={handleDownload}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
