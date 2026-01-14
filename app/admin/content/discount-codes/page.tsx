'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Tag, Calendar, Users } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface DiscountCode {
  id: number
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  applicable_product_ids: number[] | null
  max_uses: number | null
  used_count: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function DiscountCodesManagementPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    applicable_product_ids: '',
    max_uses: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    is_active: true,
  })

  useEffect(() => {
    fetchCodes()
  }, [])

  const fetchCodes = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/discount-codes', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCodes(data.codes || [])
      }
    } catch (error) {
      console.error('Failed to fetch discount codes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this discount code?')) return

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/discount-codes/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchCodes()
      } else {
        alert('Failed to delete discount code')
      }
    } catch (error) {
      console.error('Error deleting discount code:', error)
      alert('Failed to delete discount code')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const session = await getCurrentSession()
      if (!session) return

      const payload = {
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        applicable_product_ids: formData.applicable_product_ids
          ? formData.applicable_product_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
          : null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_from: formData.valid_from || new Date().toISOString(),
        valid_until: formData.valid_until || null,
        is_active: formData.is_active,
      }

      const url = editingCode ? `/api/discount-codes/${editingCode.id}` : '/api/discount-codes'
      const method = editingCode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setShowAddForm(false)
        setEditingCode(null)
        setFormData({
          code: '',
          discount_type: 'percentage',
          discount_value: '',
          applicable_product_ids: '',
          max_uses: '',
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: '',
          is_active: true,
        })
        fetchCodes()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save discount code')
      }
    } catch (error) {
      console.error('Error saving discount code:', error)
      alert('Failed to save discount code')
    }
  }

  const handleEdit = (code: DiscountCode) => {
    setEditingCode(code)
    setFormData({
      code: code.code,
      discount_type: code.discount_type,
      discount_value: code.discount_value.toString(),
      applicable_product_ids: code.applicable_product_ids?.join(', ') || '',
      max_uses: code.max_uses?.toString() || '',
      valid_from: code.valid_from ? new Date(code.valid_from).toISOString().split('T')[0] : '',
      valid_until: code.valid_until ? new Date(code.valid_until).toISOString().split('T')[0] : '',
      is_active: code.is_active,
    })
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingCode(null)
    setFormData({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      applicable_product_ids: '',
      max_uses: '',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      is_active: true,
    })
  }

  const isExpired = (code: DiscountCode) => {
    if (!code.valid_until) return false
    return new Date(code.valid_until) < new Date()
  }

  const isExhausted = (code: DiscountCode) => {
    if (!code.max_uses) return false
    return code.used_count >= code.max_uses
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Discount Codes' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Discount Codes</h1>
              <p className="text-gray-400">Manage discount codes and promotions</p>
            </div>
            {!showAddForm && (
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Add Discount Code
              </motion.button>
            )}
          </div>

          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl"
            >
              <h2 className="text-2xl font-bold mb-4">
                {editingCode ? 'Edit Discount Code' : 'Add New Discount Code'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Code *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 font-mono"
                      placeholder="SAVE20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Discount Type *</label>
                    <select
                      value={formData.discount_type}
                      onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Discount Value * ({formData.discount_type === 'percentage' ? '%' : '$'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Applicable Product IDs (comma-separated, leave empty for all products)
                  </label>
                  <input
                    type="text"
                    value={formData.applicable_product_ids}
                    onChange={(e) => setFormData({ ...formData, applicable_product_ids: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="1, 2, 3"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Uses (leave empty for unlimited)</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_uses}
                      onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Valid From *</label>
                    <input
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Valid Until (optional)</label>
                    <input
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Active</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg"
                  >
                    {editingCode ? 'Update Code' : 'Create Code'}
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
              <div className="text-gray-400">Loading discount codes...</div>
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No discount codes found. Create your first one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {codes.map((code) => (
                <motion.div
                  key={code.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <Tag className="text-purple-400" size={24} />
                        <h3 className="text-xl font-bold text-white font-mono">{code.code}</h3>
                        {code.is_active ? (
                          <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/50">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded border border-gray-600/50">
                            Inactive
                          </span>
                        )}
                        {isExpired(code) && (
                          <span className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded border border-red-600/50">
                            Expired
                          </span>
                        )}
                        {isExhausted(code) && (
                          <span className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 rounded border border-yellow-600/50">
                            Exhausted
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 mb-1">Discount</p>
                          <p className="text-white font-semibold">
                            {code.discount_type === 'percentage'
                              ? `${code.discount_value}%`
                              : `$${code.discount_value.toFixed(2)}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Usage</p>
                          <p className="text-white font-semibold">
                            {code.used_count} / {code.max_uses || '∞'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Valid From</p>
                          <p className="text-white">
                            {new Date(code.valid_from).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-1">Valid Until</p>
                          <p className="text-white">
                            {code.valid_until
                              ? new Date(code.valid_until).toLocaleDateString()
                              : 'No expiry'}
                          </p>
                        </div>
                      </div>
                      {code.applicable_product_ids && code.applicable_product_ids.length > 0 && (
                        <p className="text-sm text-gray-400 mt-2">
                          Applies to products: {code.applicable_product_ids.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(code)}
                        className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(code.id)}
                        className="p-2 bg-red-600 rounded-lg hover:bg-red-700"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
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
