'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, History, BarChart3, Film } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import { getCurrentSession } from '@/lib/auth'

interface AppPrototype {
  id: string
  title: string
  description: string
  production_stage: 'Dev' | 'QA' | 'Pilot' | 'Production'
  channel: 'Web' | 'Mobile'
  product_type: 'Utility' | 'Experience'
  created_at: string
}

export default function PrototypesManagementPage() {
  const [prototypes, setPrototypes] = useState<AppPrototype[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPrototypes()
  }, [])

  const fetchPrototypes = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/prototypes', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPrototypes(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch prototypes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Dev': return 'text-yellow-400'
      case 'QA': return 'text-blue-400'
      case 'Pilot': return 'text-purple-400'
      case 'Production': return 'text-green-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Prototypes Management</h1>
              <p className="text-gray-400">Manage app prototype demos</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Add Prototype
            </motion.button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {prototypes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No prototypes yet. Create your first prototype!</p>
                </div>
              ) : (
                prototypes.map((prototype) => (
                  <div
                    key={prototype.id}
                    className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{prototype.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStageColor(prototype.production_stage)}`}>
                          {prototype.production_stage}
                        </span>
                        <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-300">
                          {prototype.channel}
                        </span>
                        <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-300">
                          {prototype.product_type}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{prototype.description}</p>
                      <p className="text-xs text-gray-500">
                        Created: {new Date(prototype.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/content/prototypes/${prototype.id}`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                          <Edit size={18} />
                        </button>
                      </Link>
                      <Link href={`/admin/content/prototypes/${prototype.id}/history`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                          <History size={18} />
                        </button>
                      </Link>
                      <Link href={`/admin/content/prototypes/${prototype.id}/demos`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                          <Film size={18} />
                        </button>
                      </Link>
                      <Link href={`/admin/content/prototypes/${prototype.id}/analytics`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                          <BarChart3 size={18} />
                        </button>
                      </Link>
                      <button className="p-2 bg-red-600 rounded-lg hover:bg-red-700">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-8">
            <Link href="/admin/content">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white hover:border-purple-500/50 transition-colors flex items-center gap-2"
              >
                Back to Content Management
              </motion.button>
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
