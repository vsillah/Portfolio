'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, X, Target } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface OutcomeGroup {
  id: string
  slug: string
  label: string
  display_order: number
  created_at?: string
  updated_at?: string
}

export default function OutcomeGroupsPage() {
  const [groups, setGroups] = useState<OutcomeGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ slug: '', label: '', display_order: 0 })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGroups = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/outcome-groups', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setGroups(Array.isArray(data) ? data : [])

      // Seed defaults in UI when table is empty (no hardcoding in DB)
      if (Array.isArray(data) && data.length === 0) {
        const seedRes = await fetch('/api/admin/outcome-groups/seed', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        })
        if (seedRes.ok) {
          const seedJson = await seedRes.json()
          const list = seedJson.data ?? []
          setGroups(list)
        }
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to load outcome groups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleCreate = () => {
    setEditingId(null)
    setFormData({ slug: '', label: '', display_order: groups.length })
    setShowForm(true)
    setError(null)
  }

  const handleEdit = (g: OutcomeGroup) => {
    setEditingId(g.id)
    setFormData({ slug: g.slug, label: g.label, display_order: g.display_order })
    setShowForm(true)
    setError(null)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }
      if (!formData.slug.trim() || !formData.label.trim()) {
        setError('Slug and label are required')
        return
      }

      const url = editingId
        ? `/api/admin/outcome-groups/${editingId}`
        : '/api/admin/outcome-groups'
      const method = editingId ? 'PATCH' : 'POST'
      const body = editingId
        ? { slug: formData.slug.trim(), label: formData.label.trim(), display_order: formData.display_order }
        : { slug: formData.slug.trim(), label: formData.label.trim(), display_order: formData.display_order }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err?.error || 'Failed to save')
        return
      }
      handleCancel()
      fetchGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this outcome group? Content using it will have no group until reassigned.')) return
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return

      const res = await fetch(`/api/admin/outcome-groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        fetchGroups()
        if (editingId === id) handleCancel()
      } else {
        const err = await res.json()
        alert(err?.error || 'Failed to delete')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to delete')
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Outcome Groups' },
          ]} />

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Outcome Groups</h1>
              <p className="text-platinum-white/80">
                Group products, services, training, and lead magnets by the outcome they help users achieve (e.g. pricing chart).
              </p>
            </div>
            {!showForm && (
              <motion.button
                onClick={handleCreate}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold rounded-lg"
              >
                <Plus size={20} />
                Add group
              </motion.button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-900/30 border border-red-500/50 text-red-200 text-sm">
              {error}
            </div>
          )}

          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  {editingId ? 'Edit outcome group' : 'New outcome group'}
                </h2>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  aria-label="Cancel"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Slug (e.g. capture_convert)</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="capture_convert"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Label (shown in pricing & content)</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="Capture & Convert Leads"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Display order</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg font-medium"
                  >
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {loading ? (
            <p className="text-platinum-white/70">Loading outcome groups...</p>
          ) : groups.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-gray-600 text-center text-platinum-white/70">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No outcome groups yet. Click &quot;Add group&quot; or refresh to seed defaults.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <motion.li
                  key={g.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl"
                >
                  <div>
                    <span className="font-medium text-white">{g.label}</span>
                    <span className="ml-3 text-sm text-gray-400">{g.slug}</span>
                    <span className="ml-3 text-xs text-gray-500">order: {g.display_order}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(g)}
                      className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(g.id)}
                      className="p-2 rounded-lg hover:bg-red-900/50 text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
