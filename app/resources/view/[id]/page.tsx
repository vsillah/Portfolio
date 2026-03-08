'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Video, AlertCircle } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Navigation from '@/components/Navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

interface LeadMagnet {
  id: string
  title: string
  description?: string | null
  presentation_url?: string | null
  video_url?: string | null
}

export default function ResourceViewPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : null
  const [leadMagnet, setLeadMagnet] = useState<LeadMagnet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      setError('Invalid resource')
      setLoading(false)
      return
    }
    let cancelled = false
    getCurrentSession()
      .then((session) => {
        if (!session?.access_token || cancelled) return
        return fetch(`/api/lead-magnets/${id}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })
      })
      .then((res) => {
        if (!res) return
        if (!res.ok) {
          if (res.status === 404) setError('Resource not found')
          else setError('Failed to load resource')
          return
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const lm = data?.leadMagnet
        if (lm) setLeadMagnet(lm)
        else setError('Resource not found')
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load resource')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <ProtectedRoute>
      <Navigation />
      <div className="min-h-screen bg-imperial-navy text-platinum-white pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Store', href: '/store' },
              { label: 'Resources', href: '/resources' },
              { label: loading ? '...' : leadMagnet?.title ?? 'View' },
            ]}
          />
          <div className="mb-6">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 text-platinum-white/80 hover:text-platinum-white transition-colors"
            >
              <ArrowLeft size={18} />
              Back to Resources
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12 text-platinum-white/60">Loading...</div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 flex flex-col items-center gap-4"
            >
              <AlertCircle className="text-amber-400" size={40} />
              <p className="text-platinum-white">{error}</p>
              <Link
                href="/resources"
                className="inline-flex items-center gap-2 px-4 py-2 bg-radiant-gold/20 text-radiant-gold rounded-lg hover:bg-radiant-gold/30 transition-colors"
              >
                <ArrowLeft size={18} />
                Back to Resources
              </Link>
            </motion.div>
          ) : leadMagnet?.presentation_url ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <h1 className="text-2xl font-bold text-platinum-white">{leadMagnet.title}</h1>
              {leadMagnet.description && (
                <p className="text-platinum-white/80 text-sm">{leadMagnet.description}</p>
              )}
              <div className="w-full max-w-[700px] mx-auto aspect-video min-h-[450px] rounded-xl overflow-hidden border border-gray-700 bg-black">
                <iframe
                  src={leadMagnet.presentation_url}
                  title={leadMagnet.title}
                  allow="fullscreen"
                  className="w-full h-full min-h-[450px]"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gray-700 bg-gray-900/50 p-6 space-y-4"
            >
              <h1 className="text-xl font-bold text-platinum-white">{leadMagnet?.title ?? 'Resource'}</h1>
              <p className="text-platinum-white/70">This resource has no embedded presentation.</p>
              <div className="flex flex-wrap gap-3">
                {leadMagnet?.video_url && (
                  <a
                    href={leadMagnet.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                  >
                    <Video size={18} />
                    Watch video
                  </a>
                )}
                <Link
                  href="/resources"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-radiant-gold/20 text-radiant-gold rounded-lg hover:bg-radiant-gold/30 transition-colors"
                >
                  <ArrowLeft size={18} />
                  Back to Resources
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
