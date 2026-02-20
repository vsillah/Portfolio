'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, X, Copy } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import {
  CATEGORY_LABELS,
  ACCESS_TYPE_LABELS,
  type LeadMagnetCategory,
  type LeadMagnetAccessType,
} from '@/lib/constants/lead-magnet-category'
import {
  FUNNEL_STAGE_OPTIONS,
  getFunnelStageLabel,
  type LeadMagnetFunnelStage,
} from '@/lib/constants/lead-magnet-funnel'

interface LeadMagnet {
  id: number
  title: string
  description: string | null
  file_path: string | null
  file_type: string
  file_size: number | null
  download_count: number
  is_active: boolean
  created_at: string
  category?: string
  access_type?: string
  funnel_stage?: string
  display_order?: number
  private_link_token?: string | null
  slug?: string | null
  outcome_group_id?: string | null
}

interface OutcomeGroup {
  id: string
  slug: string
  label: string
  display_order: number
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
    category: 'gate_keeper' as LeadMagnetCategory,
    access_type: 'public_gated' as LeadMagnetAccessType,
    funnel_stage: 'attention_capture' as LeadMagnetFunnelStage,
    slug: '',
    outcome_group_id: '',
  })
  const [outcomeGroups, setOutcomeGroups] = useState<OutcomeGroup[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<LeadMagnet>>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null)
  const [funnelFilter, setFunnelFilter] = useState<string>('all')

  useEffect(() => {
    fetchLeadMagnets()
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

  const fetchLeadMagnets = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/lead-magnets?admin=1', {
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
          category: formData.category,
          access_type: formData.access_type,
          funnel_stage: formData.funnel_stage,
          ...(formData.slug.trim() ? { slug: formData.slug.trim() } : {}),
          ...(formData.outcome_group_id ? { outcome_group_id: formData.outcome_group_id } : {}),
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.details ? `${err.error}: ${err.details}` : (err.error || 'Failed to create lead magnet'))
      }
      setFormData({
        title: '',
        description: '',
        file: null,
        category: 'gate_keeper',
        access_type: 'public_gated',
        funnel_stage: 'attention_capture',
        slug: '',
        outcome_group_id: '',
      })
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
    setFormData({
      title: '',
      description: '',
      file: null,
      category: 'gate_keeper',
      access_type: 'public_gated',
      funnel_stage: 'attention_capture',
      slug: '',
      outcome_group_id: '',
    })
    setFormError(null)
  }

  const handleEdit = (magnet: LeadMagnet) => {
    setEditingId(magnet.id)
    setEditForm({
      title: magnet.title,
      description: magnet.description ?? '',
      category: (magnet.category as LeadMagnetCategory) || 'gate_keeper',
      access_type: (magnet.access_type as LeadMagnetAccessType) || 'public_gated',
      funnel_stage: (magnet.funnel_stage as LeadMagnetFunnelStage) || 'attention_capture',
      display_order: magnet.display_order,
      slug: magnet.slug ?? '',
      private_link_token: magnet.private_link_token ?? '',
      is_active: magnet.is_active,
      outcome_group_id: magnet.outcome_group_id ?? '',
    })
  }

  const handleSaveEdit = useCallback(async () => {
    if (editingId == null) return
    const session = await getCurrentSession()
    if (!session?.access_token) return
    const payload: Record<string, unknown> = {
      title: editForm.title,
      description: editForm.description ?? null,
      category: editForm.category,
      access_type: editForm.access_type,
      funnel_stage: editForm.funnel_stage,
      display_order: typeof editForm.display_order === 'number' ? editForm.display_order : undefined,
      slug: editForm.slug || null,
      private_link_token: editForm.private_link_token || null,
      is_active: editForm.is_active,
      outcome_group_id: editForm.outcome_group_id || null,
    }
    const res = await fetch(`/api/lead-magnets/${editingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json()
      setFormError(err?.error || 'Failed to update')
      return
    }
    setEditingId(null)
    setEditForm({})
    setFormError(null)
    await fetchLeadMagnets()
  }, [editingId, editForm])

  const handleDelete = useCallback(async (id: number) => {
    const session = await getCurrentSession()
    if (!session?.access_token) return
    const res = await fetch(`/api/lead-magnets/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      setFormError('Failed to delete')
      return
    }
    setDeleteConfirmId(null)
    await fetchLeadMagnets()
  }, [])

  const getPrivateLinkUrl = (magnet: LeadMagnet): string | null => {
    const token = magnet.private_link_token
    if (!token) return null
    const slug = (magnet.slug ?? '').toLowerCase()
    const title = (magnet.title ?? '').toLowerCase()
    if (slug.includes('roi') || title.includes('roi')) {
      return `${typeof window !== 'undefined' ? window.location.origin : ''}/tools/roi/${token}`
    }
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/tools/link/${token}`
  }

  const handleCopyLink = useCallback(async (magnet: LeadMagnet) => {
    const url = getPrivateLinkUrl(magnet)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopyFeedback(magnet.id)
      setTimeout(() => setCopyFeedback(null), 2000)
    } catch {
      setFormError('Could not copy to clipboard')
    }
  }, [])

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as LeadMagnetCategory })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      {(Object.entries(CATEGORY_LABELS) as [LeadMagnetCategory, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Access</label>
                    <select
                      value={formData.access_type}
                      onChange={(e) => setFormData({ ...formData, access_type: e.target.value as LeadMagnetAccessType })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      {(Object.entries(ACCESS_TYPE_LABELS) as [LeadMagnetAccessType, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Funnel stage</label>
                    <select
                      value={formData.funnel_stage}
                      onChange={(e) => setFormData({ ...formData, funnel_stage: e.target.value as LeadMagnetFunnelStage })}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      {FUNNEL_STAGE_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Slug (optional)</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="e.g. scorecard, roi-calculator"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Outcome group (pricing chart)</label>
                  <select
                    value={formData.outcome_group_id}
                    onChange={(e) => setFormData({ ...formData, outcome_group_id: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">None</option>
                    {outcomeGroups.map((og) => (
                      <option key={og.id} value={og.id}>{og.label}</option>
                    ))}
                  </select>
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

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-gray-300">Filter by stage</label>
            <select
              value={funnelFilter}
              onChange={(e) => setFunnelFilter(e.target.value)}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              aria-label="Filter lead magnets by funnel stage"
            >
              <option value="all">All stages</option>
              {FUNNEL_STAGE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : (
            <>
            <div className="space-y-8">
              {(() => {
                const filtered = funnelFilter === 'all'
                  ? leadMagnets
                  : leadMagnets.filter((m) => m.funnel_stage === funnelFilter)
                const byStage = filtered.reduce((acc, m) => {
                  const stage = m.funnel_stage ?? 'attention_capture'
                  if (!acc[stage]) acc[stage] = []
                  acc[stage].push(m)
                  return acc
                }, {} as Record<string, LeadMagnet[]>)
                return FUNNEL_STAGE_OPTIONS.map(({ value, label }) => {
                  const items = byStage[value] ?? []
                  if (items.length === 0) return null
                  return (
                    <section key={value} aria-labelledby={`stage-${value}`}>
                      <h2 id={`stage-${value}`} className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
                        {label}
                      </h2>
                      <div className="space-y-4">
                        {items.map((magnet) => (
                <div
                  key={magnet.id}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between flex-wrap gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{magnet.title}</h3>
                    <p className="text-gray-400 text-sm mb-2">{magnet.description ?? '—'}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span>{magnet.download_count} downloads</span>
                      <span>•</span>
                      <span>{magnet.file_type}</span>
                      <span>•</span>
                      <span>{magnet.is_active ? 'Active' : 'Inactive'}</span>
                      {magnet.category && (
                        <>
                          <span>•</span>
                          <span>{CATEGORY_LABELS[magnet.category as LeadMagnetCategory] ?? magnet.category}</span>
                        </>
                      )}
                      {magnet.funnel_stage && (
                        <>
                          <span>•</span>
                          <span>{getFunnelStageLabel(magnet.funnel_stage)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPrivateLinkUrl(magnet) && (
                      <button
                        onClick={() => handleCopyLink(magnet)}
                        className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 flex items-center gap-1"
                        title="Copy private link"
                      >
                        <Copy size={18} />
                        {copyFeedback === magnet.id ? (
                          <span className="text-xs text-green-400">Copied</span>
                        ) : null}
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(magnet)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      aria-label="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(magnet.id)}
                      className="p-2 bg-red-600 rounded-lg hover:bg-red-700"
                      aria-label="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                        ))}
                      </div>
                    </section>
                  )
                })
              })()}
            </div>

            {editingId != null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                onClick={() => { setEditingId(null); setEditForm({}); setFormError(null) }}
              >
                <div
                  className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Edit Lead Magnet</h2>
                    <button
                      onClick={() => { setEditingId(null); setEditForm({}) }}
                      className="p-2 hover:bg-gray-800 rounded"
                      aria-label="Close"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  {formError && <p className="text-red-400 text-sm mb-4">{formError}</p>}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                      <input
                        type="text"
                        value={editForm.title ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                      <textarea
                        value={editForm.description ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                        <select
                          value={editForm.category ?? 'gate_keeper'}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value as LeadMagnetCategory })}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                        >
                          {(Object.entries(CATEGORY_LABELS) as [LeadMagnetCategory, string][]).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Access</label>
                        <select
                          value={editForm.access_type ?? 'public_gated'}
                          onChange={(e) => setEditForm({ ...editForm, access_type: e.target.value as LeadMagnetAccessType })}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                        >
                          {(Object.entries(ACCESS_TYPE_LABELS) as [LeadMagnetAccessType, string][]).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Funnel stage</label>
                        <select
                          value={editForm.funnel_stage ?? 'attention_capture'}
                          onChange={(e) => setEditForm({ ...editForm, funnel_stage: e.target.value as LeadMagnetFunnelStage })}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                        >
                          {FUNNEL_STAGE_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Slug</label>
                      <input
                        type="text"
                        value={editForm.slug ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                        placeholder="e.g. roi-calculator"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Outcome group (pricing chart)</label>
                      <select
                        value={editForm.outcome_group_id ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, outcome_group_id: e.target.value || null })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      >
                        <option value="">None</option>
                        {outcomeGroups.map((og) => (
                          <option key={og.id} value={og.id}>{og.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Private link token</label>
                      <input
                        type="text"
                        value={editForm.private_link_token ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, private_link_token: e.target.value || null })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm"
                        placeholder="Leave empty or set token for private link"
                      />
                      <p className="text-gray-500 text-xs mt-1">For ROI Calculator use a long random string; link will be /tools/roi/[token]</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit-active"
                        checked={editForm.is_active !== false}
                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="edit-active" className="text-sm text-gray-300">Active</label>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setEditForm({}) }}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {deleteConfirmId != null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                onClick={() => setDeleteConfirmId(null)}
              >
                <div
                  className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-white font-medium mb-4">Delete this lead magnet? This cannot be undone.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => deleteConfirmId != null && handleDelete(deleteConfirmId)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
