'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Download } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'

interface LeadMagnet {
  id: number
  title: string
  description: string | null
  file_path: string
  file_type: string
  file_size: number | null
  download_count: number
  is_active: boolean
  created_at: string
}

export default function LeadMagnetsManagementPage() {
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeadMagnets()
  }, [])

  const fetchLeadMagnets = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/lead-magnets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setLeadMagnets(data.leadMagnets || [])
      }
    } catch (error) {
      console.error('Failed to fetch lead magnets:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Lead Magnets Management</h1>
              <p className="text-gray-400">Manage downloadable resources</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Add Lead Magnet
            </motion.button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {leadMagnets.map((magnet) => (
                <div
                  key={magnet.id}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{magnet.title}</h3>
                    <p className="text-gray-400 text-sm mb-2">{magnet.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{magnet.download_count} downloads</span>
                      <span>•</span>
                      <span>{magnet.file_type}</span>
                      <span>•</span>
                      <span>{magnet.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                      <Edit size={18} />
                    </button>
                    <button className="p-2 bg-red-600 rounded-lg hover:bg-red-700">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
