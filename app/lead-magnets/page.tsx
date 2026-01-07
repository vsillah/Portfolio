'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/components/AuthProvider'
import ProtectedRoute from '@/components/ProtectedRoute'
import LeadMagnetCard from '@/components/LeadMagnetCard'
import { getCurrentSession } from '@/lib/auth'
import { getSignedUrl } from '@/lib/storage'

interface LeadMagnet {
  id: number
  title: string
  description: string | null
  file_type: string
  file_size: number | null
  download_count: number
  file_path: string
  created_at: string
}

export default function LeadMagnetsPage() {
  const { user } = useAuth()
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLeadMagnets()
  }, [user])

  const fetchLeadMagnets = async () => {
    if (!user) return

    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      const response = await fetch('/api/lead-magnets', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch lead magnets')
      }

      const data = await response.json()
      setLeadMagnets(data.leadMagnets || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load lead magnets')
    } finally {
      setLoading(false)
    }
  }

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
      
      // Open download URL in new tab
      window.open(data.downloadUrl, '_blank')
      
      // Refresh the list to update download counts
      setTimeout(() => {
        fetchLeadMagnets()
      }, 1000)
    } catch (err: any) {
      alert(err.message || 'Failed to download')
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold mb-2">Lead Magnets</h1>
            <p className="text-gray-400">Exclusive resources available for download</p>
          </motion.div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading lead magnets...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400">{error}</div>
            </div>
          ) : leadMagnets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400">No lead magnets available yet.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {leadMagnets.map((leadMagnet) => (
                <LeadMagnetCard
                  key={leadMagnet.id}
                  leadMagnet={leadMagnet}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
