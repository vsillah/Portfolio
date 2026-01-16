'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { 
  Plus, Trash2, ArrowLeft, Upload, X, Video, Image as ImageIcon,
  Loader2, AlertCircle, CheckCircle2, Star, GripVertical,
  ExternalLink, Play, Globe, User
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import Link from 'next/link'

interface Demo {
  id: string
  prototype_id: string
  title: string
  description: string | null
  demo_type: 'video' | 'iframe' | 'image' | 'link'
  demo_url: string
  persona_type: string | null
  journey_focus: string | null
  is_primary: boolean
  display_order: number
}

interface AppPrototype {
  id: string
  title: string
}

type NotificationType = 'success' | 'error' | 'info'

interface Notification {
  type: NotificationType
  message: string
}

const DEMO_TYPES = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'iframe', label: 'Embedded Frame', icon: Globe },
  { value: 'image', label: 'Image/Screenshot', icon: ImageIcon },
  { value: 'link', label: 'External Link', icon: ExternalLink },
]

const PERSONA_TYPES = [
  'Admin',
  'End User',
  'Developer',
  'Business Owner',
  'Customer',
  'Manager',
  'Analyst',
  'Guest',
]

export default function PrototypeDemosPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [demos, setDemos] = useState<Demo[]>([])
  const [prototype, setPrototype] = useState<AppPrototype | null>(null)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDemo, setEditingDemo] = useState<Demo | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    demo_type: 'video' as Demo['demo_type'],
    demo_url: '',
    persona_type: '',
    journey_focus: '',
    is_primary: false,
  })

  const showNotification = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const response = await fetch(`/api/prototypes/${params.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          showNotification('error', 'Prototype not found')
          router.push('/admin/content/prototypes')
          return
        }
        throw new Error('Failed to fetch prototype')
      }

      const data = await response.json()
      setPrototype({ id: data.id, title: data.title })
      setDemos(data.demos || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      showNotification('error', 'Failed to load demos')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, showNotification])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleReorder = async (newOrder: Demo[]) => {
    const oldDemos = [...demos]
    setDemos(newOrder)

    try {
      const session = await getCurrentSession()
      if (!session) return

      // Update display_order for all demos
      await Promise.all(
        newOrder.map((demo, index) =>
          fetch(`/api/prototypes/${params.id}/demos/${demo.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ display_order: index }),
          })
        )
      )
    } catch (error) {
      console.error('Error reordering demos:', error)
      setDemos(oldDemos)
      showNotification('error', 'Failed to reorder demos')
    }
  }

  const handleSetPrimary = async (demoId: string) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/prototypes/${params.id}/demos/${demoId}/set-primary`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to set primary demo')
      }

      // Update local state
      setDemos(prev => prev.map(demo => ({
        ...demo,
        is_primary: demo.id === demoId,
      })))
      
      showNotification('success', 'Primary demo updated')
    } catch (error) {
      console.error('Error setting primary demo:', error)
      showNotification('error', 'Failed to set primary demo')
    }
  }

  const handleDelete = async (demoId: string) => {
    if (!confirm('Are you sure you want to delete this demo?')) return

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/prototypes/${params.id}/demos/${demoId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete demo')
      }

      setDemos(prev => prev.filter(demo => demo.id !== demoId))
      showNotification('success', 'Demo deleted successfully')
    } catch (error) {
      console.error('Error deleting demo:', error)
      showNotification('error', 'Failed to delete demo')
    }
  }

  const handleEdit = (demo: Demo) => {
    setEditingDemo(demo)
    setFormData({
      title: demo.title,
      description: demo.description || '',
      demo_type: demo.demo_type,
      demo_url: demo.demo_url,
      persona_type: demo.persona_type || '',
      journey_focus: demo.journey_focus || '',
      is_primary: demo.is_primary,
    })
    setShowAddForm(true)
  }

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingMedia(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('prototypeId', params.id)
      uploadFormData.append('mediaType', formData.demo_type === 'video' ? 'demo_video' : 'demo_image')

      const response = await fetch('/api/prototypes/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: uploadFormData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload media')
      }

      const data = await response.json()
      setFormData(prev => ({ ...prev, demo_url: data.public_url }))
      showNotification('success', 'Media uploaded successfully')
    } catch (error: any) {
      console.error('Error uploading media:', error)
      showNotification('error', error.message || 'Failed to upload media')
    } finally {
      setUploadingMedia(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showNotification('error', 'Title is required')
      return
    }
    if (!formData.demo_url.trim()) {
      showNotification('error', 'Demo URL is required')
      return
    }

    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const payload = {
        title: formData.title,
        description: formData.description || null,
        demo_type: formData.demo_type,
        demo_url: formData.demo_url,
        persona_type: formData.persona_type || null,
        journey_focus: formData.journey_focus || null,
        is_primary: formData.is_primary,
        display_order: editingDemo ? editingDemo.display_order : demos.length,
      }

      const url = editingDemo 
        ? `/api/prototypes/${params.id}/demos/${editingDemo.id}`
        : `/api/prototypes/${params.id}/demos`
      
      const response = await fetch(url, {
        method: editingDemo ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save demo')
      }

      showNotification('success', editingDemo ? 'Demo updated successfully' : 'Demo created successfully')
      resetForm()
      fetchData()
    } catch (error: any) {
      console.error('Error saving demo:', error)
      showNotification('error', error.message || 'Failed to save demo')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setShowAddForm(false)
    setEditingDemo(null)
    setFormData({
      title: '',
      description: '',
      demo_type: 'video',
      demo_url: '',
      persona_type: '',
      journey_focus: '',
      is_primary: false,
    })
  }

  const getDemoTypeIcon = (type: string) => {
    const demoType = DEMO_TYPES.find(t => t.value === type)
    return demoType?.icon || Video
  }

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin" size={24} />
            <span>Loading demos...</span>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white">
        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${
                notification.type === 'success' 
                  ? 'bg-green-600' 
                  : notification.type === 'error'
                  ? 'bg-red-600'
                  : 'bg-blue-600'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <Breadcrumbs items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Content Management', href: '/admin/content' },
              { label: 'Prototypes', href: '/admin/content/prototypes' },
              { label: prototype?.title || 'Edit', href: `/admin/content/prototypes/${params.id}` },
              { label: 'Demos' }
            ]} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <Link 
                  href={`/admin/content/prototypes/${params.id}`}
                  className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft size={20} />
                </Link>
                <div>
                  <h1 className="text-3xl font-bold">Manage Demos</h1>
                  <p className="text-gray-400 text-sm mt-1">
                    {prototype?.title} • {demos.length} demo{demos.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {!showAddForm && (
                <motion.button
                  onClick={() => setShowAddForm(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center gap-2 font-medium"
                >
                  <Plus size={18} />
                  Add Demo
                </motion.button>
              )}
            </div>

            {/* Add/Edit Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8"
                >
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">
                        {editingDemo ? 'Edit Demo' : 'Add New Demo'}
                      </h2>
                      <button
                        onClick={resetForm}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Title <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Demo title"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Demo Type
                          </label>
                          <select
                            value={formData.demo_type}
                            onChange={(e) => setFormData(prev => ({ ...prev, demo_type: e.target.value as Demo['demo_type'] }))}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                          >
                            {DEMO_TYPES.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          rows={2}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                          placeholder="Brief description of this demo..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Demo URL <span className="text-red-400">*</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={formData.demo_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, demo_url: e.target.value }))}
                            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="https://..."
                          />
                          {(formData.demo_type === 'video' || formData.demo_type === 'image') && (
                            <label className={`px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors flex items-center gap-2 ${uploadingMedia ? 'opacity-50' : ''}`}>
                              {uploadingMedia ? (
                                <Loader2 className="animate-spin" size={18} />
                              ) : (
                                <Upload size={18} />
                              )}
                              <span className="text-sm">Upload</span>
                              <input
                                type="file"
                                accept={formData.demo_type === 'video' ? 'video/*' : 'image/*'}
                                onChange={handleMediaUpload}
                                className="hidden"
                                disabled={uploadingMedia}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Persona Type
                            <span className="text-gray-500 font-normal ml-2">(optional)</span>
                          </label>
                          <select
                            value={formData.persona_type}
                            onChange={(e) => setFormData(prev => ({ ...prev, persona_type: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                          >
                            <option value="">Select persona...</option>
                            {PERSONA_TYPES.map(persona => (
                              <option key={persona} value={persona}>{persona}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Journey Focus
                            <span className="text-gray-500 font-normal ml-2">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={formData.journey_focus}
                            onChange={(e) => setFormData(prev => ({ ...prev, journey_focus: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="e.g., Onboarding, Checkout, Dashboard"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_primary"
                          checked={formData.is_primary}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="is_primary" className="text-sm text-gray-300">
                          Set as primary demo (shown by default)
                        </label>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <motion.button
                          type="submit"
                          disabled={saving}
                          whileHover={{ scale: saving ? 1 : 1.02 }}
                          whileTap={{ scale: saving ? 1 : 0.98 }}
                          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="animate-spin" size={18} />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} />
                              {editingDemo ? 'Update Demo' : 'Create Demo'}
                            </>
                          )}
                        </motion.button>
                        <button
                          type="button"
                          onClick={resetForm}
                          className="px-6 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Demos List */}
            {demos.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                  <Video size={32} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No demos yet</h3>
                <p className="text-gray-500 mb-6">Add your first demo to showcase this prototype</p>
                {!showAddForm && (
                  <motion.button
                    onClick={() => setShowAddForm(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-purple-500/50 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add First Demo
                  </motion.button>
                )}
              </motion.div>
            ) : (
              <Reorder.Group
                axis="y"
                values={demos}
                onReorder={handleReorder}
                className="space-y-3"
              >
                {demos.map((demo, index) => {
                  const TypeIcon = getDemoTypeIcon(demo.demo_type)
                  return (
                    <Reorder.Item
                      key={demo.id}
                      value={demo}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 ${
                          demo.is_primary ? 'border-purple-500/50' : 'border-gray-800'
                        }`}
                      >
                        <div className="p-2 bg-gray-800 rounded-lg cursor-grab">
                          <GripVertical size={18} className="text-gray-500" />
                        </div>

                        <div className="p-3 bg-gray-800 rounded-lg">
                          <TypeIcon size={24} className="text-purple-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white truncate">{demo.title}</h3>
                            {demo.is_primary && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/30 flex items-center gap-1">
                                <Star size={10} />
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span className="capitalize">{demo.demo_type}</span>
                            {demo.persona_type && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <User size={12} />
                                  {demo.persona_type}
                                </span>
                              </>
                            )}
                            {demo.journey_focus && (
                              <>
                                <span>•</span>
                                <span>{demo.journey_focus}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={demo.demo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                            title="Preview"
                          >
                            <Play size={16} />
                          </a>
                          {!demo.is_primary && (
                            <button
                              onClick={() => handleSetPrimary(demo.id)}
                              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                              title="Set as primary"
                            >
                              <Star size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(demo)}
                            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                            title="Edit"
                          >
                            <ExternalLink size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(demo.id)}
                            className="p-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </motion.div>
                    </Reorder.Item>
                  )
                })}
              </Reorder.Group>
            )}

            {/* Help text */}
            {demos.length > 1 && (
              <p className="text-center text-gray-500 text-sm mt-6">
                Drag and drop to reorder demos • The primary demo is shown by default
              </p>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
