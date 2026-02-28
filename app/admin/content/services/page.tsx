'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, EyeOff, ArrowUp, ArrowDown, DollarSign, Clock, Users, Star, X } from 'lucide-react'
import { ImageUrlInput } from '@/components/admin/ImageUrlInput'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import { formatCurrency } from '@/lib/pricing-model'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface Service {
  id: string
  title: string
  description: string | null
  service_type: string
  delivery_method: string
  duration_hours: number | null
  duration_description: string | null
  price: number | null
  is_quote_based: boolean
  min_participants: number
  max_participants: number | null
  prerequisites: string | null
  deliverables: string[]
  topics: string[]
  image_url: string | null
  video_url: string | null
  video_thumbnail_url: string | null
  is_active: boolean
  is_featured: boolean
  display_order: number
  outcome_group_id: string | null
  created_at: string
  updated_at: string
}

interface OutcomeGroup {
  id: string
  slug: string
  label: string
  display_order: number
}

const SERVICE_TYPES = [
  { value: 'training', label: 'Training Program' },
  { value: 'speaking', label: 'Speaking Engagement' },
  { value: 'consulting', label: 'Consulting/Advisory' },
  { value: 'coaching', label: 'Coaching Sessions' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'warranty', label: 'Warranty/Guarantee' },
]

const DELIVERY_METHODS = [
  { value: 'virtual', label: 'Virtual (Online)' },
  { value: 'in_person', label: 'In-Person' },
  { value: 'hybrid', label: 'Hybrid' },
]

export default function ServicesManagementPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    service_type: 'consulting',
    delivery_method: 'virtual',
    duration_hours: '',
    duration_description: '',
    price: '',
    is_quote_based: false,
    min_participants: '1',
    max_participants: '',
    prerequisites: '',
    deliverables: '',
    topics: '',
    image_url: '',
    video_url: '',
    video_thumbnail_url: '',
    offer_video_as_lead_magnet: false,
    is_active: true,
    is_featured: false,
    display_order: 0,
    outcome_group_id: '',
  })
  const [outcomeGroups, setOutcomeGroups] = useState<OutcomeGroup[]>([])
  /** Map service_id -> lead_magnet id for "offer video as lead magnet" checkbox */
  const [leadMagnetByServiceId, setLeadMagnetByServiceId] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    fetchServices()
  }, [])

  useEffect(() => {
    getCurrentSession().then((s) => {
      if (!s?.access_token) return
      fetch('/api/admin/outcome-groups', { headers: { Authorization: `Bearer ${s.access_token}` } })
        .then((res) => res.ok ? res.json() : [])
        .then((list) => setOutcomeGroups(Array.isArray(list) ? list : []))
        .catch(() => setOutcomeGroups([]))
    })
  }, [])

  useEffect(() => {
    getCurrentSession().then((s) => {
      if (!s?.access_token) return
      fetch('/api/lead-magnets?admin=1', { headers: { Authorization: `Bearer ${s.access_token}` } })
        .then((res) => res.ok ? res.json() : { leadMagnets: [] })
        .then((data) => {
          const list = data?.leadMagnets || []
          const map = new Map<string, string>()
          for (const lm of list) {
            if (lm.service_id) map.set(lm.service_id, lm.id)
          }
          setLeadMagnetByServiceId(map)
        })
        .catch(() => setLeadMagnetByServiceId(new Map()))
    })
  }, [])

  const fetchServices = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/services?active=false', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setServices(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch services:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) return

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/services/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchServices()
      } else {
        alert('Failed to delete service')
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      alert('Failed to delete service')
    }
  }

  const handleToggleActive = async (service: Service) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_active: !service.is_active,
        }),
      })

      if (response.ok) {
        fetchServices()
      } else {
        alert('Failed to update service')
      }
    } catch (error) {
      console.error('Error updating service:', error)
      alert('Failed to update service')
    }
  }

  const handleToggleFeatured = async (service: Service) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_featured: !service.is_featured,
        }),
      })

      if (response.ok) {
        fetchServices()
      } else {
        alert('Failed to update service')
      }
    } catch (error) {
      console.error('Error updating service:', error)
      alert('Failed to update service')
    }
  }

  const handleMoveOrder = async (service: Service, direction: 'up' | 'down') => {
    const currentIndex = services.findIndex(s => s.id === service.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= services.length) return

    const targetService = services[newIndex]
    // Use array indices as display_order — always clean sequential values (0, 1, 2, ...)
    const orderForCurrent = newIndex
    const orderForTarget = currentIndex

    try {
      const session = await getCurrentSession()
      if (!session) return

      const [res1, res2] = await Promise.all([
        fetch(`/api/services/${service.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: orderForCurrent }),
        }),
        fetch(`/api/services/${targetService.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: orderForTarget }),
        }),
      ])

      if (!res1.ok || !res2.ok) {
        const err1 = await res1.json().catch(() => ({}))
        const err2 = await res2.json().catch(() => ({}))
        alert(err1?.error || err2?.error || 'Failed to reorder service')
        return
      }
      fetchServices()
    } catch (error) {
      console.error('Error moving service:', error)
      alert('Failed to reorder service')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const session = await getCurrentSession()
      if (!session) return

      // Parse deliverables and topics from comma-separated strings
      const deliverablesArray = formData.deliverables
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)
      
      const topicsArray = formData.topics
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const payload = {
        title: formData.title,
        description: formData.description || null,
        service_type: formData.service_type,
        delivery_method: formData.delivery_method,
        duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
        duration_description: formData.duration_description || null,
        price: formData.price ? parseFloat(formData.price) : null,
        is_quote_based: formData.is_quote_based,
        min_participants: parseInt(formData.min_participants) || 1,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        prerequisites: formData.prerequisites || null,
        deliverables: deliverablesArray,
        topics: topicsArray,
        image_url: formData.image_url || null,
        video_url: formData.video_url || null,
        video_thumbnail_url: formData.video_thumbnail_url || null,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        display_order: formData.display_order,
        outcome_group_id: formData.outcome_group_id || null,
      }

      const url = editingService ? `/api/services/${editingService.id}` : '/api/services'
      const method = editingService ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        const savedServiceId = result?.data?.id ?? editingService?.id

        if (formData.offer_video_as_lead_magnet && (formData.video_url || '').trim()) {
          const fromServiceRes = await fetch('/api/admin/lead-magnets/from-service', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ service_id: savedServiceId }),
          })
          if (fromServiceRes.ok) {
            const fromData = await fromServiceRes.json()
            const lmId = fromData?.leadMagnet?.id
            if (lmId) {
              setLeadMagnetByServiceId((prev) => new Map(prev).set(savedServiceId, lmId))
            }
          } else {
            const err = await fromServiceRes.json()
            console.error('Failed to create/update lead magnet from service:', err)
          }
        } else if (editingService && leadMagnetByServiceId.has(editingService.id)) {
          const lmId = leadMagnetByServiceId.get(editingService.id)
          if (lmId) {
            await fetch(`/api/lead-magnets/${lmId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ service_id: null }),
            })
            setLeadMagnetByServiceId((prev) => {
              const next = new Map(prev)
              next.delete(editingService.id)
              return next
            })
          }
        }

        setShowAddModal(false)
        setEditingService(null)
        resetForm()
        fetchServices()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save service')
      }
    } catch (error) {
      console.error('Error saving service:', error)
      alert('Failed to save service')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      service_type: 'consulting',
      delivery_method: 'virtual',
      duration_hours: '',
      duration_description: '',
      price: '',
      is_quote_based: false,
      min_participants: '1',
      max_participants: '',
      prerequisites: '',
      deliverables: '',
      topics: '',
      image_url: '',
      video_url: '',
      video_thumbnail_url: '',
      offer_video_as_lead_magnet: false,
      is_active: true,
      is_featured: false,
      display_order: 0,
      outcome_group_id: '',
    })
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      title: service.title,
      description: service.description || '',
      service_type: service.service_type,
      delivery_method: service.delivery_method,
      duration_hours: service.duration_hours?.toString() || '',
      duration_description: service.duration_description || '',
      price: service.price?.toString() || '',
      is_quote_based: service.is_quote_based,
      min_participants: service.min_participants.toString(),
      max_participants: service.max_participants?.toString() || '',
      prerequisites: service.prerequisites || '',
      deliverables: Array.isArray(service.deliverables) ? service.deliverables.join(', ') : '',
      topics: Array.isArray(service.topics) ? service.topics.join(', ') : '',
      image_url: service.image_url || '',
      video_url: service.video_url || '',
      video_thumbnail_url: service.video_thumbnail_url || '',
      offer_video_as_lead_magnet: leadMagnetByServiceId.has(service.id),
      is_active: service.is_active,
      is_featured: service.is_featured,
      display_order: service.display_order,
      outcome_group_id: service.outcome_group_id ?? '',
    })
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingService(null)
    resetForm()
  }

  const getTypeLabel = (type: string) => {
    return SERVICE_TYPES.find(t => t.value === type)?.label || type
  }

  const getDeliveryLabel = (method: string) => {
    return DELIVERY_METHODS.find(d => d.value === method)?.label || method
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Services' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Services Management</h1>
              <p className="text-platinum-white/70">Manage trainings, speaking engagements, consulting, and more</p>
            </div>
            <motion.button
              onClick={() => { resetForm(); setShowAddModal(true) }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-6 py-3 btn-gold font-semibold rounded-lg"
            >
              <Plus size={20} />
              Add Service
            </motion.button>
          </div>

          {(showAddModal || editingService) && (
            <div
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              onClick={handleCloseModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-modal-title"
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card border border-radiant-gold/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
              >
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-silicon-slate/95 backdrop-blur py-4 -mx-4 px-6 border-b border-silicon-slate z-10">
                  <h2 id="service-modal-title" className="text-xl font-semibold">
                    {editingService ? 'Edit Service' : 'Add New Service'}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 rounded-lg text-platinum-white/80 hover:text-foreground hover:bg-silicon-slate transition-colors"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 input-brand"
                    required
                    placeholder="e.g., AI Strategy Consulting"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 input-brand"
                    rows={3}
                    placeholder="Describe what this service includes..."
                  />
                </div>

                {/* Type and Delivery Method */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Service Type *</label>
                    <select
                      value={formData.service_type}
                      onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                      className="w-full px-4 py-2 input-brand"
                      required
                    >
                      {SERVICE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Delivery Method</label>
                    <select
                      value={formData.delivery_method}
                      onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value })}
                      className="w-full px-4 py-2 input-brand"
                    >
                      {DELIVERY_METHODS.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Duration (hours)</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/60" size={20} />
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.duration_hours}
                        onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 input-brand"
                        placeholder="e.g., 2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Duration Description</label>
                    <input
                      type="text"
                      value={formData.duration_description}
                      onChange={(e) => setFormData({ ...formData, duration_description: e.target.value })}
                      className="w-full px-4 py-2 input-brand"
                      placeholder="e.g., 2-day workshop, 6 weekly sessions"
                    />
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Price (leave empty if quote-based)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/60" size={20} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 input-brand"
                        placeholder="0.00"
                        disabled={formData.is_quote_based}
                      />
                    </div>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={formData.is_quote_based}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          is_quote_based: e.target.checked,
                          price: e.target.checked ? '' : formData.price
                        })}
                        className="w-4 h-4 rounded accent-radiant-gold"
                      />
                      <span>Quote-based pricing (contact for pricing)</span>
                    </label>
                  </div>
                </div>

                {/* Participants */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Min Participants</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/60" size={20} />
                      <input
                        type="number"
                        min="1"
                        value={formData.min_participants}
                        onChange={(e) => setFormData({ ...formData, min_participants: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 input-brand"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Participants (leave empty for unlimited)</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/60" size={20} />
                      <input
                        type="number"
                        min="1"
                        value={formData.max_participants}
                        onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 input-brand"
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                </div>

                {/* Prerequisites */}
                <div>
                  <label className="block text-sm font-medium mb-2">Prerequisites</label>
                  <textarea
                    value={formData.prerequisites}
                    onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                    className="w-full px-4 py-2 input-brand"
                    rows={2}
                    placeholder="What participants need before starting..."
                  />
                </div>

                {/* Deliverables */}
                <div>
                  <label className="block text-sm font-medium mb-2">Deliverables (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.deliverables}
                    onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                    className="w-full px-4 py-2 input-brand"
                    placeholder="e.g., Recorded sessions, Workbook, Certificate"
                  />
                </div>

                {/* Topics */}
                <div>
                  <label className="block text-sm font-medium mb-2">Topics Covered (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.topics}
                    onChange={(e) => setFormData({ ...formData, topics: e.target.value })}
                    className="w-full px-4 py-2 input-brand"
                    placeholder="e.g., AI Strategy, Implementation, ROI Analysis"
                  />
                </div>

                {/* Image URL */}
                <ImageUrlInput
                  value={formData.image_url}
                  onChange={(image_url) => setFormData({ ...formData, image_url })}
                  label="Image URL"
                  variant="brand"
                />

                {/* Video URL */}
                <div>
                  <label className="block text-sm font-medium mb-2">Video URL</label>
                  <input
                    type="url"
                    value={formData.video_url}
                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                    className="w-full px-4 py-2 input-brand"
                    placeholder="https://youtube.com/watch?v=... or Vimeo URL"
                  />
                </div>

                {/* Video thumbnail URL */}
                <div>
                  <label className="block text-sm font-medium mb-2">Video thumbnail URL (optional)</label>
                  <input
                    type="url"
                    value={formData.video_thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, video_thumbnail_url: e.target.value })}
                    className="w-full px-4 py-2 input-brand"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-platinum-white/60 mt-1">Used when showing the video as a lead magnet or in bundles.</p>
                </div>

                {/* Offer video as lead magnet */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="offer_video_as_lead_magnet"
                    checked={formData.offer_video_as_lead_magnet}
                    onChange={(e) => setFormData({ ...formData, offer_video_as_lead_magnet: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded accent-radiant-gold"
                  />
                  <label htmlFor="offer_video_as_lead_magnet" className="text-sm cursor-pointer">
                    Offer this service&apos;s video as a lead magnet (show on Resources page with &quot;Watch video&quot;). Requires a Video URL above.
                  </label>
                </div>

                {/* Display options */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Display Order</label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 input-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Outcome group (pricing chart)</label>
                    <select
                      value={formData.outcome_group_id}
                      onChange={(e) => setFormData({ ...formData, outcome_group_id: e.target.value })}
                      className="w-full px-4 py-2 input-brand"
                    >
                      <option value="">None</option>
                      {outcomeGroups.map((og) => (
                        <option key={og.id} value={og.id}>{og.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 rounded accent-radiant-gold"
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="w-4 h-4 rounded accent-radiant-gold"
                      />
                      <span>Featured</span>
                    </label>
                  </div>
                </div>

                {/* Form buttons */}
                <div className="flex gap-4 pt-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-2 btn-gold font-semibold rounded-lg"
                  >
                    {editingService ? 'Update Service' : 'Create Service'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-2 btn-ghost font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-platinum-white/70">Loading services...</div>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 text-platinum-white/70">
              <p className="mb-4">No services found. Add your first one!</p>
              <motion.button
                onClick={() => { resetForm(); setShowAddModal(true) }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 btn-gold font-semibold rounded-lg flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                Add New Service
              </motion.button>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-brand p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{service.title}</h3>
                      {service.is_active ? (
                        <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/50">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-silicon-slate/80 text-platinum-white/60 rounded border border-silicon-slate">
                          Inactive
                        </span>
                      )}
                      {service.is_featured && (
                        <span className="px-2 py-1 text-xs bg-radiant-gold/20 text-radiant-gold rounded border border-radiant-gold/50">
                          Featured
                        </span>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-platinum-white/70 text-sm mb-2 line-clamp-2">{service.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-platinum-white/60">
                      <span className="px-2 py-1 bg-silicon-slate/60 rounded text-xs">
                        {getTypeLabel(service.service_type)}
                      </span>
                      <span className="px-2 py-1 bg-silicon-slate/60 rounded text-xs">
                        {getDeliveryLabel(service.delivery_method)}
                      </span>
                      {service.is_quote_based ? (
                        <span className="px-2 py-1 bg-radiant-gold/20 text-radiant-gold rounded text-xs">
                          Contact for Pricing
                        </span>
                      ) : service.price !== null ? (
                        <span className="px-2 py-1 bg-radiant-gold/20 text-radiant-gold rounded text-xs">
                          {formatCurrency(service.price)}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">
                          Free
                        </span>
                      )}
                      {service.duration_description && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {service.duration_description}
                          </span>
                        </>
                      )}
                      {service.max_participants && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {service.min_participants}-{service.max_participants} participants
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>Order: {service.display_order}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMoveOrder(service, 'up')}
                      className="p-2 bg-silicon-slate/50 hover:bg-silicon-slate border border-silicon-slate rounded-lg text-platinum-white/80 hover:text-radiant-gold transition-colors"
                      title="Move up"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(service, 'down')}
                      className="p-2 bg-silicon-slate/50 hover:bg-silicon-slate border border-silicon-slate rounded-lg text-platinum-white/80 hover:text-radiant-gold transition-colors"
                      title="Move down"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      onClick={() => handleToggleFeatured(service)}
                      className={`p-2 rounded-lg transition-colors ${service.is_featured ? 'bg-radiant-gold/20 text-radiant-gold border border-radiant-gold/50' : 'bg-silicon-slate/50 border border-silicon-slate text-platinum-white/80 hover:text-radiant-gold'}`}
                      title={service.is_featured ? 'Remove Featured' : 'Mark as Featured'}
                    >
                      <Star size={18} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(service)}
                      className="p-2 bg-silicon-slate/50 hover:bg-silicon-slate border border-silicon-slate rounded-lg text-platinum-white/80 hover:text-radiant-gold transition-colors"
                      title={service.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {service.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={() => handleEdit(service)}
                      className="p-2 bg-silicon-slate/50 hover:bg-radiant-gold/20 border border-silicon-slate hover:border-radiant-gold/50 rounded-lg text-platinum-white/80 hover:text-radiant-gold transition-colors"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
