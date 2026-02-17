'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { 
  Save, Trash2, ArrowLeft, Upload, X, Image as ImageIcon,
  Loader2, AlertCircle, CheckCircle2, ExternalLink, 
  Smartphone, Globe, Wrench, Sparkles, RefreshCw, Plus,
  Video, GripVertical, Star, Play, User
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

interface StageHistory {
  id: string
  old_stage: string | null
  new_stage: string
  changed_at: string
  change_reason: string | null
}

interface AppPrototype {
  id: string
  title: string
  description: string
  purpose: string
  production_stage: 'Dev' | 'QA' | 'Pilot' | 'Production'
  channel: 'Web' | 'Mobile'
  product_type: 'Utility' | 'Experience'
  thumbnail_url: string | null
  download_url: string | null
  app_repo_url: string | null
  deployment_platform: string | null
  analytics_source: string | null
  analytics_project_id: string | null
  created_at: string
  updated_at: string
  demos?: Demo[]
  stage_history?: StageHistory[]
}

type NotificationType = 'success' | 'error' | 'info'

interface Notification {
  type: NotificationType
  message: string
}

const PRODUCTION_STAGES = ['Dev', 'QA', 'Pilot', 'Production'] as const
const CHANNELS = ['Web', 'Mobile'] as const
const PRODUCT_TYPES = ['Utility', 'Experience'] as const

const DEPLOYMENT_PLATFORMS = [
  'Vercel', 'Netlify', 'AWS', 'Google Cloud', 'Azure', 
  'Heroku', 'Railway', 'Render', 'DigitalOcean', 'Custom',
]

const ANALYTICS_SOURCES = [
  'Google Analytics', 'Mixpanel', 'Amplitude', 
  'PostHog', 'Plausible', 'Fathom', 'Custom',
]

const DEMO_TYPES = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'iframe', label: 'Embedded Frame', icon: Globe },
  { value: 'image', label: 'Image/Screenshot', icon: ImageIcon },
  { value: 'link', label: 'External Link', icon: ExternalLink },
]

const PERSONA_TYPES = [
  'Admin', 'End User', 'Developer', 'Business Owner', 
  'Customer', 'Manager', 'Analyst', 'Guest',
]

export default function PrototypeEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalData, setOriginalData] = useState<AppPrototype | null>(null)
  
  // Demo state
  const [demos, setDemos] = useState<Demo[]>([])
  const [showAddDemo, setShowAddDemo] = useState(false)
  const [editingDemo, setEditingDemo] = useState<Demo | null>(null)
  const [savingDemo, setSavingDemo] = useState(false)
  const [uploadingDemoMedia, setUploadingDemoMedia] = useState(false)
  const [demoFormData, setDemoFormData] = useState({
    title: '',
    description: '',
    demo_type: 'video' as Demo['demo_type'],
    demo_url: '',
    persona_type: '',
    journey_focus: '',
    is_primary: false,
  })
  
  const [formData, setFormData] = useState<AppPrototype>({
    id: '',
    title: '',
    description: '',
    purpose: '',
    production_stage: 'Dev',
    channel: 'Web',
    product_type: 'Utility',
    thumbnail_url: null,
    download_url: null,
    app_repo_url: null,
    deployment_platform: null,
    analytics_source: null,
    analytics_project_id: null,
    created_at: '',
    updated_at: '',
  })

  const showNotification = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  const fetchPrototype = useCallback(async () => {
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
      setFormData(data)
      setOriginalData(data)
      setDemos(data.demos || [])
    } catch (error) {
      console.error('Error fetching prototype:', error)
      showNotification('error', 'Failed to load prototype')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, showNotification])

  useEffect(() => {
    fetchPrototype()
  }, [fetchPrototype])

  // Track changes
  useEffect(() => {
    if (originalData) {
      const hasFormChanges = 
        formData.title !== originalData.title ||
        formData.description !== originalData.description ||
        formData.purpose !== originalData.purpose ||
        formData.production_stage !== originalData.production_stage ||
        formData.channel !== originalData.channel ||
        formData.product_type !== originalData.product_type ||
        formData.thumbnail_url !== originalData.thumbnail_url ||
        formData.download_url !== originalData.download_url ||
        formData.app_repo_url !== originalData.app_repo_url ||
        formData.deployment_platform !== originalData.deployment_platform ||
        formData.analytics_source !== originalData.analytics_source ||
        formData.analytics_project_id !== originalData.analytics_project_id
      setHasChanges(hasFormChanges)
    }
  }, [formData, originalData])

  const handleInputChange = (field: keyof AppPrototype, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingThumbnail(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('prototypeId', params.id)
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
      showNotification('success', 'Thumbnail uploaded successfully')
    } catch (error: any) {
      console.error('Error uploading thumbnail:', error)
      showNotification('error', error.message || 'Failed to upload thumbnail')
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const handleRemoveThumbnail = () => {
    setFormData(prev => ({ ...prev, thumbnail_url: null }))
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showNotification('error', 'Title is required')
      return
    }
    if (!formData.description.trim()) {
      showNotification('error', 'Description is required')
      return
    }
    if (!formData.purpose.trim()) {
      showNotification('error', 'Purpose is required')
      return
    }

    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const stageChanged = originalData && formData.production_stage !== originalData.production_stage

      const response = await fetch(`/api/prototypes/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          purpose: formData.purpose,
          production_stage: formData.production_stage,
          channel: formData.channel,
          product_type: formData.product_type,
          thumbnail_url: formData.thumbnail_url,
          download_url: formData.download_url || null,
          app_repo_url: formData.app_repo_url || null,
          deployment_platform: formData.deployment_platform || null,
          analytics_source: formData.analytics_source || null,
          analytics_project_id: formData.analytics_project_id || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save prototype')
      }

      if (stageChanged && originalData) {
        await fetch(`/api/prototypes/${params.id}/history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            old_stage: originalData.production_stage,
            new_stage: formData.production_stage,
          }),
        })
      }

      showNotification('success', 'Prototype saved successfully')
      setOriginalData(formData)
      setHasChanges(false)
    } catch (error: any) {
      console.error('Error saving prototype:', error)
      showNotification('error', error.message || 'Failed to save prototype')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const response = await fetch(`/api/prototypes/${params.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete prototype')
      }

      showNotification('success', 'Prototype deleted successfully')
      setTimeout(() => {
        router.push('/admin/content/prototypes')
      }, 1000)
    } catch (error: any) {
      console.error('Error deleting prototype:', error)
      showNotification('error', error.message || 'Failed to delete prototype')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Demo handlers
  const handleDemoMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingDemoMedia(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('prototypeId', params.id)
      uploadFormData.append('mediaType', demoFormData.demo_type === 'video' ? 'demo_video' : 'demo_image')

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
      setDemoFormData(prev => ({ ...prev, demo_url: data.public_url }))
      showNotification('success', 'Media uploaded successfully')
    } catch (error: any) {
      console.error('Error uploading media:', error)
      showNotification('error', error.message || 'Failed to upload media')
    } finally {
      setUploadingDemoMedia(false)
    }
  }

  const handleSaveDemo = async () => {
    if (!demoFormData.title.trim()) {
      showNotification('error', 'Demo title is required')
      return
    }
    if (!demoFormData.demo_url.trim()) {
      showNotification('error', 'Demo URL is required')
      return
    }

    setSavingDemo(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        showNotification('error', 'Please log in to continue')
        return
      }

      const payload = {
        title: demoFormData.title,
        description: demoFormData.description || null,
        demo_type: demoFormData.demo_type,
        demo_url: demoFormData.demo_url,
        persona_type: demoFormData.persona_type || null,
        journey_focus: demoFormData.journey_focus || null,
        is_primary: demoFormData.is_primary,
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

      showNotification('success', editingDemo ? 'Demo updated' : 'Demo added')
      resetDemoForm()
      fetchPrototype()
    } catch (error: any) {
      console.error('Error saving demo:', error)
      showNotification('error', error.message || 'Failed to save demo')
    } finally {
      setSavingDemo(false)
    }
  }

  const handleEditDemo = (demo: Demo) => {
    setEditingDemo(demo)
    setDemoFormData({
      title: demo.title,
      description: demo.description || '',
      demo_type: demo.demo_type,
      demo_url: demo.demo_url,
      persona_type: demo.persona_type || '',
      journey_focus: demo.journey_focus || '',
      is_primary: demo.is_primary,
    })
    setShowAddDemo(true)
  }

  const handleDeleteDemo = async (demoId: string) => {
    if (!confirm('Delete this demo?')) return

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
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete demo')
      }

      setDemos(prev => prev.filter(d => d.id !== demoId))
      showNotification('success', 'Demo deleted')
    } catch (error: any) {
      showNotification('error', error.message || 'Failed to delete demo')
    }
  }

  const handleSetPrimaryDemo = async (demoId: string) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/prototypes/${params.id}/demos/${demoId}/set-primary`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to set primary')

      setDemos(prev => prev.map(d => ({ ...d, is_primary: d.id === demoId })))
      showNotification('success', 'Primary demo updated')
    } catch (error) {
      showNotification('error', 'Failed to set primary demo')
    }
  }

  const handleReorderDemos = async (newOrder: Demo[]) => {
    const oldDemos = [...demos]
    setDemos(newOrder)

    try {
      const session = await getCurrentSession()
      if (!session) return

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
      setDemos(oldDemos)
      showNotification('error', 'Failed to reorder')
    }
  }

  const resetDemoForm = () => {
    setShowAddDemo(false)
    setEditingDemo(null)
    setDemoFormData({
      title: '',
      description: '',
      demo_type: 'video',
      demo_url: '',
      persona_type: '',
      journey_focus: '',
      is_primary: false,
    })
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
            <span>Loading prototype...</span>
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
                notification.type === 'success' ? 'bg-green-600' : notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-70">
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-white mb-2">Delete Prototype</h3>
                <p className="text-gray-400 mb-6">
                  Are you sure you want to delete &quot;<span className="text-white">{formData.title}</span>&quot;? 
                  This will also delete all demos, feedback, and analytics.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    {deleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <Breadcrumbs items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Content Management', href: '/admin/content' },
              { label: 'Prototypes', href: '/admin/content/prototypes' },
              { label: formData.title || 'Edit Prototype' }
            ]} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <Link 
                  href="/admin/content/prototypes"
                  className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft size={20} />
                </Link>
                <div>
                  <h1 className="text-3xl font-bold">Edit Prototype</h1>
                  <p className="text-gray-400 text-sm mt-1">
                    Last updated: {formData.updated_at ? new Date(formData.updated_at).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {hasChanges && (
                  <span className="text-yellow-400 text-sm flex items-center gap-1">
                    <AlertCircle size={14} />
                    Unsaved changes
                  </span>
                )}
                <motion.button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  whileHover={{ scale: saving || !hasChanges ? 1 : 1.02 }}
                  whileTap={{ scale: saving || !hasChanges ? 1 : 0.98 }}
                  className={`px-5 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                    hasChanges ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {saving ? <><Loader2 className="animate-spin" size={18} />Saving...</> : <><Save size={18} />Save Changes</>}
                </motion.button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-5 py-2 bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg hover:bg-red-600/30 flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Basic Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="text-purple-400" size={20} />
                  Basic Information
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                      placeholder="Enter prototype title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                      placeholder="Describe what this prototype does..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Purpose <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.purpose}
                      onChange={(e) => handleInputChange('purpose', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                      placeholder="What problem does this prototype solve?"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Classification */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold mb-4">Classification</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Production Stage</label>
                    <select
                      value={formData.production_stage}
                      onChange={(e) => handleInputChange('production_stage', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">Channel</label>
                    <select
                      value={formData.channel}
                      onChange={(e) => handleInputChange('channel', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      {CHANNELS.map(channel => (
                        <option key={channel} value={channel}>{channel}</option>
                      ))}
                    </select>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                      {formData.channel === 'Mobile' ? <><Smartphone size={16} /> Mobile App</> : <><Globe size={16} /> Web Application</>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Product Type</label>
                    <select
                      value={formData.product_type}
                      onChange={(e) => handleInputChange('product_type', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      {PRODUCT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                      {formData.product_type === 'Utility' ? <><Wrench size={16} /> Utility Tool</> : <><Sparkles size={16} /> Experience App</>}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Thumbnail Image */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon className="text-pink-400" size={20} />
                  Thumbnail Image
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                  Upload a cover image for your prototype. This appears in listings and cards.
                  <span className="text-gray-500 ml-1">(Max 50MB)</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    {formData.thumbnail_url ? (
                      <div className="space-y-3">
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-gray-700">
                          <img src={formData.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={handleRemoveThumbnail}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg hover:bg-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700">
                          <Upload size={16} />
                          <span className="text-sm">Replace Image</span>
                          <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={uploadingThumbnail} />
                        </label>
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        uploadingThumbnail ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600'
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
                        <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={uploadingThumbnail} />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Or enter URL directly</label>
                    <input
                      type="url"
                      value={formData.thumbnail_url || ''}
                      onChange={(e) => handleInputChange('thumbnail_url', e.target.value || null)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Demo Media */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Video className="text-blue-400" size={20} />
                      Demo Media
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Add videos, screenshots, or embedded demos. The primary demo is shown by default.
                      <span className="text-gray-500 ml-1">(Max 50MB per file)</span>
                    </p>
                  </div>
                  {!showAddDemo && (
                    <button
                      onClick={() => setShowAddDemo(true)}
                      className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 flex items-center gap-2 text-sm"
                    >
                      <Plus size={16} />
                      Add Demo
                    </button>
                  )}
                </div>

                {/* Add/Edit Demo Form */}
                <AnimatePresence>
                  {showAddDemo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium">{editingDemo ? 'Edit Demo' : 'Add New Demo'}</h3>
                        <button onClick={resetDemoForm} className="p-1 hover:bg-gray-700 rounded">
                          <X size={18} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                            <input
                              type="text"
                              value={demoFormData.title}
                              onChange={(e) => setDemoFormData(prev => ({ ...prev, title: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                              placeholder="Demo title"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                            <select
                              value={demoFormData.demo_type}
                              onChange={(e) => setDemoFormData(prev => ({ ...prev, demo_type: e.target.value as Demo['demo_type'] }))}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            >
                              {DEMO_TYPES.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Demo URL *
                            {(demoFormData.demo_type === 'video' || demoFormData.demo_type === 'image') && (
                              <span className="text-gray-500 font-normal ml-2">(or upload, max 50MB)</span>
                            )}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={demoFormData.demo_url}
                              onChange={(e) => setDemoFormData(prev => ({ ...prev, demo_url: e.target.value }))}
                              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                              placeholder="https://..."
                            />
                            {(demoFormData.demo_type === 'video' || demoFormData.demo_type === 'image') && (
                              <label className={`px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700 flex items-center gap-2 ${uploadingDemoMedia ? 'opacity-50' : ''}`} title="Max 50MB">
                                {uploadingDemoMedia ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                <span className="text-sm">Upload</span>
                                <input
                                  type="file"
                                  accept={demoFormData.demo_type === 'video' ? 'video/*' : 'image/*'}
                                  onChange={handleDemoMediaUpload}
                                  className="hidden"
                                  disabled={uploadingDemoMedia}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                          <input
                            type="text"
                            value={demoFormData.description}
                            onChange={(e) => setDemoFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            placeholder="Brief description..."
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Persona Type</label>
                            <select
                              value={demoFormData.persona_type}
                              onChange={(e) => setDemoFormData(prev => ({ ...prev, persona_type: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            >
                              <option value="">None</option>
                              {PERSONA_TYPES.map(persona => (
                                <option key={persona} value={persona}>{persona}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Journey Focus</label>
                            <input
                              type="text"
                              value={demoFormData.journey_focus}
                              onChange={(e) => setDemoFormData(prev => ({ ...prev, journey_focus: e.target.value }))}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                              placeholder="e.g., Onboarding, Checkout"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="demo_is_primary"
                            checked={demoFormData.is_primary}
                            onChange={(e) => setDemoFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600"
                          />
                          <label htmlFor="demo_is_primary" className="text-sm text-gray-300">Set as primary demo</label>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveDemo}
                            disabled={savingDemo}
                            className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm disabled:opacity-50"
                          >
                            {savingDemo ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                            {editingDemo ? 'Update' : 'Add Demo'}
                          </button>
                          <button onClick={resetDemoForm} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Demo List */}
                {demos.length === 0 && !showAddDemo ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-lg">
                    <Video className="mx-auto text-gray-600 mb-2" size={32} />
                    <p className="text-gray-500 text-sm mb-3">No demos yet</p>
                    <button
                      onClick={() => setShowAddDemo(true)}
                      className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-sm inline-flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add First Demo
                    </button>
                  </div>
                ) : demos.length > 0 && (
                  <Reorder.Group axis="y" values={demos} onReorder={handleReorderDemos} className="space-y-2">
                    {demos.map((demo) => {
                      const TypeIcon = getDemoTypeIcon(demo.demo_type)
                      return (
                        <Reorder.Item key={demo.id} value={demo} className="cursor-grab active:cursor-grabbing">
                          <div className={`flex items-center gap-3 p-3 bg-gray-800/50 border rounded-lg ${demo.is_primary ? 'border-purple-500/50' : 'border-gray-700'}`}>
                            <GripVertical size={16} className="text-gray-500" />
                            <div className="p-2 bg-gray-700 rounded">
                              <TypeIcon size={18} className="text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{demo.title}</span>
                                {demo.is_primary && (
                                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
                                    <Star size={10} />Primary
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="capitalize">{demo.demo_type}</span>
                                {demo.persona_type && <><span>•</span><span className="flex items-center gap-1"><User size={10} />{demo.persona_type}</span></>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <a href={demo.demo_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-700 rounded" title="Preview">
                                <Play size={14} />
                              </a>
                              {!demo.is_primary && (
                                <button onClick={() => handleSetPrimaryDemo(demo.id)} className="p-1.5 hover:bg-gray-700 rounded" title="Set as primary">
                                  <Star size={14} />
                                </button>
                              )}
                              <button onClick={() => handleEditDemo(demo)} className="p-1.5 hover:bg-gray-700 rounded" title="Edit">
                                <ExternalLink size={14} />
                              </button>
                              <button onClick={() => handleDeleteDemo(demo.id)} className="p-1.5 hover:bg-red-600/20 text-red-400 rounded" title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </Reorder.Item>
                      )
                    })}
                  </Reorder.Group>
                )}
                {demos.length > 1 && (
                  <p className="text-center text-gray-500 text-xs mt-3">Drag to reorder demos</p>
                )}
              </motion.div>

              {/* URLs & Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <ExternalLink className="text-blue-400" size={20} />
                  URLs & Links
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Download URL <span className="text-gray-500 font-normal">(for mobile apps)</span>
                    </label>
                    <input
                      type="url"
                      value={formData.download_url || ''}
                      onChange={(e) => handleInputChange('download_url', e.target.value || null)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://apps.apple.com/..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Repository URL <span className="text-gray-500 font-normal">(GitHub, etc.)</span>
                    </label>
                    <input
                      type="url"
                      value={formData.app_repo_url || ''}
                      onChange={(e) => handleInputChange('app_repo_url', e.target.value || null)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://github.com/..."
                    />
                  </div>
                </div>
              </motion.div>

              {/* Deployment & Analytics */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="text-green-400" size={20} />
                  Deployment & Analytics
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Deployment Platform</label>
                    <select
                      value={formData.deployment_platform || ''}
                      onChange={(e) => handleInputChange('deployment_platform', e.target.value || null)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select platform...</option>
                      {DEPLOYMENT_PLATFORMS.map(platform => (
                        <option key={platform} value={platform}>{platform}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Analytics Source</label>
                    <select
                      value={formData.analytics_source || ''}
                      onChange={(e) => handleInputChange('analytics_source', e.target.value || null)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select source...</option>
                      {ANALYTICS_SOURCES.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Analytics Project ID</label>
                    <input
                      type="text"
                      value={formData.analytics_project_id || ''}
                      onChange={(e) => handleInputChange('analytics_project_id', e.target.value || null)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="e.g., UA-XXXXXXXX-X"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Metadata & Quick Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div><span className="text-gray-500">ID:</span> <span className="font-mono">{formData.id.slice(0, 8)}...</span></div>
                    <div><span className="text-gray-500">Created:</span> {formData.created_at ? new Date(formData.created_at).toLocaleDateString() : 'N/A'}</div>
                    <div><span className="text-gray-500">Updated:</span> {formData.updated_at ? new Date(formData.updated_at).toLocaleDateString() : 'N/A'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/content/prototypes/${params.id}/history`}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-sm flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      Stage History ({formData.stage_history?.length || 0})
                    </Link>
                    <Link
                      href={`/admin/content/prototypes/${params.id}/analytics`}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 text-sm flex items-center gap-2"
                    >
                      <ExternalLink size={14} />
                      Analytics
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
