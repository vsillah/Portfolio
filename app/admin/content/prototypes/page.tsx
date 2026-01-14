'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, History, BarChart3, Film, X } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    purpose: '',
    production_stage: 'Dev' as 'Dev' | 'QA' | 'Pilot' | 'Production',
    channel: 'Web' as 'Web' | 'Mobile',
    product_type: 'Utility' as 'Utility' | 'Experience',
    thumbnail_url: '',
    download_url: '',
    app_repo_url: '',
    deployment_platform: '',
    analytics_source: '',
    analytics_project_id: '',
  })

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const session = await getCurrentSession()
      if (!session) {
        alert('Please log in to create a prototype')
        return
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        purpose: formData.purpose,
        production_stage: formData.production_stage,
        channel: formData.channel,
        product_type: formData.product_type,
        thumbnail_url: formData.thumbnail_url || null,
        download_url: formData.download_url || null,
        app_repo_url: formData.app_repo_url || null,
        deployment_platform: formData.deployment_platform || null,
        analytics_source: formData.analytics_source || null,
        analytics_project_id: formData.analytics_project_id || null,
      }

      const response = await fetch('/api/prototypes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setShowAddForm(false)
        setFormData({
          title: '',
          description: '',
          purpose: '',
          production_stage: 'Dev',
          channel: 'Web',
          product_type: 'Utility',
          thumbnail_url: '',
          download_url: '',
          app_repo_url: '',
          deployment_platform: '',
          analytics_source: '',
          analytics_project_id: '',
        })
        fetchPrototypes()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create prototype')
      }
    } catch (error) {
      console.error('Error creating prototype:', error)
      alert('Failed to create prototype')
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setFormData({
      title: '',
      description: '',
      purpose: '',
      production_stage: 'Dev',
      channel: 'Web',
      product_type: 'Utility',
      thumbnail_url: '',
      download_url: '',
      app_repo_url: '',
      deployment_platform: '',
      analytics_source: '',
      analytics_project_id: '',
    })
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Prototypes' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Prototypes Management</h1>
              <p className="text-gray-400">Manage app prototype demos</p>
            </div>
            {!showAddForm && (
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Add Prototype
              </motion.button>
            )}
          </div>

          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Add New Prototype</h2>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Purpose *</label>
                  <textarea
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    rows={3}
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Production Stage *</label>
                    <select
                      value={formData.production_stage}
                      onChange={(e) => setFormData({ ...formData, production_stage: e.target.value as 'Dev' | 'QA' | 'Pilot' | 'Production' })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value="Dev">Dev</option>
                      <option value="QA">QA</option>
                      <option value="Pilot">Pilot</option>
                      <option value="Production">Production</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Channel *</label>
                    <select
                      value={formData.channel}
                      onChange={(e) => setFormData({ ...formData, channel: e.target.value as 'Web' | 'Mobile' })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value="Web">Web</option>
                      <option value="Mobile">Mobile</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Product Type *</label>
                    <select
                      value={formData.product_type}
                      onChange={(e) => setFormData({ ...formData, product_type: e.target.value as 'Utility' | 'Experience' })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value="Utility">Utility</option>
                      <option value="Experience">Experience</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Thumbnail URL</label>
                  <input
                    type="url"
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Download URL</label>
                    <input
                      type="url"
                      value={formData.download_url}
                      onChange={(e) => setFormData({ ...formData, download_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">App Repo URL</label>
                    <input
                      type="url"
                      value={formData.app_repo_url}
                      onChange={(e) => setFormData({ ...formData, app_repo_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Deployment Platform</label>
                    <input
                      type="text"
                      value={formData.deployment_platform}
                      onChange={(e) => setFormData({ ...formData, deployment_platform: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="e.g., Vercel, AWS"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Analytics Source</label>
                    <input
                      type="text"
                      value={formData.analytics_source}
                      onChange={(e) => setFormData({ ...formData, analytics_source: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="e.g., Google Analytics"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Analytics Project ID</label>
                    <input
                      type="text"
                      value={formData.analytics_project_id}
                      onChange={(e) => setFormData({ ...formData, analytics_project_id: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg"
                  >
                    Create Prototype
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleCancel}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-gray-800 border border-gray-700 text-white font-semibold rounded-lg hover:border-gray-600"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {prototypes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-4">No prototypes yet. Create your first prototype!</p>
                  {!showAddForm && (
                    <motion.button
                      onClick={() => setShowAddForm(true)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500/50 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Plus size={20} />
                      Add New Prototype
                    </motion.button>
                  )}
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

        </div>
      </div>
    </ProtectedRoute>
  )
}
