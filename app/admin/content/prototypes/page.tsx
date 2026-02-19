'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, Trash2, Edit, History, BarChart3, Film, X, 
  Upload, Loader2, Image as ImageIcon, Smartphone, Globe, Wrench, Sparkles
} from 'lucide-react'
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
  thumbnail_url?: string
  created_at: string
}

const PRODUCTION_STAGES = ['Dev', 'QA', 'Pilot', 'Production'] as const
const CHANNELS = ['Web', 'Mobile'] as const
const PRODUCT_TYPES = ['Utility', 'Experience'] as const

const DEPLOYMENT_PLATFORMS = [
  'Vercel',
  'Netlify',
  'AWS',
  'Google Cloud',
  'Azure',
  'Heroku',
  'Railway',
  'Render',
  'DigitalOcean',
  'Custom',
]

const ANALYTICS_SOURCES = [
  'Google Analytics',
  'Mixpanel',
  'Amplitude',
  'PostHog',
  'Plausible',
  'Fathom',
  'Custom',
]

export default function PrototypesManagementPage() {
  const [prototypes, setPrototypes] = useState<AppPrototype[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
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
      case 'Dev': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'QA': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'Pilot': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'Production': return 'bg-green-500/20 text-green-400 border-green-500/50'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingThumbnail(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        alert('Please log in to continue')
        return
      }

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('mediaType', 'thumbnail')

      const response = await fetch('/api/prototypes/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: uploadFormData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload image')
      }

      const data = await response.json()
      setFormData(prev => ({ ...prev, thumbnail_url: data.public_url }))
    } catch (error: any) {
      console.error('Error uploading thumbnail:', error)
      alert(error.message || 'Failed to upload thumbnail')
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const handleRemoveThumbnail = () => {
    setFormData(prev => ({ ...prev, thumbnail_url: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

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
        resetForm()
        fetchPrototypes()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create prototype')
      }
    } catch (error) {
      console.error('Error creating prototype:', error)
      alert('Failed to create prototype')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
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

  const handleCancel = () => {
    setShowAddForm(false)
    resetForm()
  }

  const handleDelete = async (prototype: AppPrototype) => {
    if (!confirm(`Are you sure you want to delete "${prototype.title}"? This will also delete all associated demos, feedback, and analytics. This action cannot be undone.`)) {
      return
    }

    setDeletingId(prototype.id)
    try {
      const session = await getCurrentSession()
      if (!session) {
        alert('Please log in to continue')
        return
      }

      const response = await fetch(`/api/prototypes/${prototype.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchPrototypes()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete prototype')
      }
    } catch (error) {
      console.error('Error deleting prototype:', error)
      alert('Failed to delete prototype')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Add New Prototype</h2>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-400" />
                    Basic Information
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                      placeholder="Enter prototype title"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors resize-none"
                      rows={3}
                      placeholder="Describe what this prototype does..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Purpose <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors resize-none"
                      rows={2}
                      placeholder="What problem does this prototype solve?"
                      required
                    />
                  </div>
                </div>

                {/* Classification */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-300">Classification</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Production Stage <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={formData.production_stage}
                        onChange={(e) => setFormData({ ...formData, production_stage: e.target.value as 'Dev' | 'QA' | 'Pilot' | 'Production' })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      >
                        {PRODUCTION_STAGES.map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                      <div className={`mt-2 px-3 py-1 rounded text-xs font-semibold border inline-block ${getStageColor(formData.production_stage)}`}>
                        {formData.production_stage}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Channel <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={formData.channel}
                        onChange={(e) => setFormData({ ...formData, channel: e.target.value as 'Web' | 'Mobile' })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      >
                        {CHANNELS.map(channel => (
                          <option key={channel} value={channel}>{channel}</option>
                        ))}
                      </select>
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                        {formData.channel === 'Mobile' ? (
                          <><Smartphone size={16} /> Mobile App</>
                        ) : (
                          <><Globe size={16} /> Web Application</>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Product Type <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={formData.product_type}
                        onChange={(e) => setFormData({ ...formData, product_type: e.target.value as 'Utility' | 'Experience' })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      >
                        {PRODUCT_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                        {formData.product_type === 'Utility' ? (
                          <><Wrench size={16} /> Utility Tool</>
                        ) : (
                          <><Sparkles size={16} /> Experience App</>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thumbnail Upload */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-300 flex items-center gap-2">
                    <ImageIcon size={18} className="text-pink-400" />
                    Thumbnail Image
                    <span className="text-gray-500 font-normal text-sm">(Max 50MB)</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      {formData.thumbnail_url ? (
                        <div className="space-y-3">
                          <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-700">
                            <img
                              src={formData.thumbnail_url}
                              alt="Thumbnail preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveThumbnail}
                              className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700 hover:border-gray-600 transition-colors">
                            <Upload size={16} />
                            <span className="text-sm">Replace Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleThumbnailUpload}
                              className="hidden"
                              disabled={uploadingThumbnail}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          uploadingThumbnail 
                            ? 'border-purple-500 bg-purple-500/10' 
                            : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600'
                        }`}>
                          {uploadingThumbnail ? (
                            <div className="flex flex-col items-center">
                              <Loader2 className="animate-spin text-purple-400 mb-2" size={32} />
                              <span className="text-sm text-gray-400">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Upload className="text-gray-400 mb-2" size={32} />
                              <span className="text-sm text-gray-400 mb-1">Click to upload</span>
                              <span className="text-xs text-gray-500">PNG, JPG, GIF, WebP</span>
                              <span className="text-xs text-yellow-500/80 mt-1">Max file size: 50MB</span>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleThumbnailUpload}
                            className="hidden"
                            disabled={uploadingThumbnail}
                          />
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Or enter URL directly
                      </label>
                      <input
                        type="url"
                        value={formData.thumbnail_url}
                        onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        placeholder="https://example.com/image.jpg"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Upload an image or paste a URL to an existing image
                      </p>
                    </div>
                  </div>
                </div>

                {/* URLs & Links */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-300">URLs & Links</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Download URL
                        <span className="text-gray-500 font-normal ml-2">(for mobile apps)</span>
                      </label>
                      <input
                        type="url"
                        value={formData.download_url}
                        onChange={(e) => setFormData({ ...formData, download_url: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        placeholder="https://apps.apple.com/... or https://play.google.com/..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Repository URL
                        <span className="text-gray-500 font-normal ml-2">(GitHub, GitLab, etc.)</span>
                      </label>
                      <input
                        type="url"
                        value={formData.app_repo_url}
                        onChange={(e) => setFormData({ ...formData, app_repo_url: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        placeholder="https://github.com/username/repo"
                      />
                    </div>
                  </div>
                </div>

                {/* Deployment & Analytics */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-300">Deployment & Analytics</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Deployment Platform
                      </label>
                      <select
                        value={formData.deployment_platform}
                        onChange={(e) => setFormData({ ...formData, deployment_platform: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                      >
                        <option value="">Select platform...</option>
                        {DEPLOYMENT_PLATFORMS.map(platform => (
                          <option key={platform} value={platform}>{platform}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Analytics Source
                      </label>
                      <select
                        value={formData.analytics_source}
                        onChange={(e) => setFormData({ ...formData, analytics_source: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                      >
                        <option value="">Select source...</option>
                        {ANALYTICS_SOURCES.map(source => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Analytics Project ID
                      </label>
                      <input
                        type="text"
                        value={formData.analytics_project_id}
                        onChange={(e) => setFormData({ ...formData, analytics_project_id: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        placeholder="e.g., UA-XXXXXXXX-X"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-800">
                  <motion.button
                    type="submit"
                    disabled={submitting || uploadingThumbnail}
                    whileHover={{ scale: submitting ? 1 : 1.02 }}
                    whileTap={{ scale: submitting ? 1 : 0.98 }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Create Prototype
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 bg-gray-800 border border-gray-700 text-white font-semibold rounded-lg hover:border-gray-600 transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="animate-spin mx-auto mb-2" size={24} />
              <div className="text-gray-400">Loading prototypes...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {prototypes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                    <Sparkles size={32} className="text-gray-600" />
                  </div>
                  <p className="mb-4">No prototypes yet. Create your first prototype!</p>
                  {!showAddForm && (
                    <motion.button
                      onClick={() => setShowAddForm(true)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500/50 transition-colors inline-flex items-center gap-2"
                    >
                      <Plus size={20} />
                      Add New Prototype
                    </motion.button>
                  )}
                </div>
              ) : (
                prototypes.map((prototype) => (
                  <motion.div
                    key={prototype.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Thumbnail Preview */}
                      {prototype.thumbnail_url ? (
                        <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                          <img
                            src={prototype.thumbnail_url}
                            alt={prototype.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-14 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                          <ImageIcon size={20} className="text-gray-600" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-xl font-bold text-white truncate">{prototype.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-semibold border ${getStageColor(prototype.production_stage)}`}>
                            {prototype.production_stage}
                          </span>
                          <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-300 flex items-center gap-1">
                            {prototype.channel === 'Mobile' ? <Smartphone size={12} /> : <Globe size={12} />}
                            {prototype.channel}
                          </span>
                          <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-300 flex items-center gap-1">
                            {prototype.product_type === 'Utility' ? <Wrench size={12} /> : <Sparkles size={12} />}
                            {prototype.product_type}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-2 line-clamp-1">{prototype.description}</p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(prototype.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Link href={`/admin/content/prototypes/${prototype.id}`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors" title="Edit">
                          <Edit size={18} />
                        </button>
                      </Link>
                      <Link href={`/admin/content/prototypes/${prototype.id}/history`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors" title="History">
                          <History size={18} />
                        </button>
                      </Link>
                      <Link href={`/admin/content/prototypes/${prototype.id}/demos`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors" title="Demos">
                          <Film size={18} />
                        </button>
                      </Link>
                      <Link href={`/admin/content/prototypes/${prototype.id}/analytics`}>
                        <button className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors" title="Analytics">
                          <BarChart3 size={18} />
                        </button>
                      </Link>
                      <button 
                        onClick={() => handleDelete(prototype)}
                        disabled={deletingId === prototype.id}
                        className="p-2 bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Delete"
                      >
                        {deletingId === prototype.id ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  )
}
