'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, X } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file: null as File | null,
  })

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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const session = await getCurrentSession()
    if (!session?.access_token) {
      setFormError('Not authenticated')
      return
    }
    if (!formData.title.trim()) {
      setFormError('Title is required')
      return
    }
    if (!formData.file) {
      setFormError('Please select a file (PDF or image)')
      return
    }
    setSubmitting(true)
    try {
      const uploadForm = new FormData()
      uploadForm.append('file', formData.file)
      uploadForm.append('bucket', 'lead-magnets')
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: uploadForm,
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || 'Failed to upload file')
      }
      const { path } = await uploadRes.json()
      const ext = formData.file.name.split('.').pop() || 'pdf'
      const fileType = formData.file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream')
      const createRes = await fetch('/api/lead-magnets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          file_path: path,
          file_type: fileType,
          file_size: formData.file.size,
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.details ? `${err.error}: ${err.details}` : (err.error || 'Failed to create lead magnet'))
      }
      setFormData({ title: '', description: '', file: null })
      setShowAddForm(false)
      await fetchLeadMagnets()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add lead magnet')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setFormData({ title: '', description: '', file: null })
    setFormError(null)
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Lead Magnets' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Lead Magnets Management</h1>
              <p className="text-gray-400">Manage downloadable resources</p>
            </div>
            {!showAddForm && (
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Add Lead Magnet
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
                <h2 className="text-2xl font-bold">Add New Lead Magnet</h2>
                <button
                  onClick={handleCancelAdd}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Cancel"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-6">
                {formError && (
                  <p className="text-red-400 text-sm">{formError}</p>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Free eBook, Checklist"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 resize-none"
                    rows={3}
                    placeholder="Brief description of the lead magnet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">File (PDF or image) *</label>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] ?? null })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer"
                    required
                  />
                  <p className="text-gray-500 text-xs mt-1">Max 10MB. PDF, JPEG, PNG, GIF, WebP, SVG.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancelAdd}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Uploading...' : 'Add Lead Magnet'}
                  </button>
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
