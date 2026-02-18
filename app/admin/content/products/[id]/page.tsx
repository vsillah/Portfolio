'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Upload, File, X, DollarSign, Image as ImageIcon } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from '@/lib/constants/products'
import Link from 'next/link'

interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  file_path: string | null
  image_url: string | null
  is_active: boolean
  is_featured: boolean
  display_order: number
  asset_url?: string | null
  instructions_file_path?: string | null
}

const PRODUCT_TYPE_OPTIONS = PRODUCT_TYPES.filter((t) => t !== 'merchandise').map((value) => ({
  value,
  label: PRODUCT_TYPE_LABELS[value],
}))

export default function ProductEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'ebook',
    price: '',
    image_url: '',
    asset_url: '',
    is_active: true,
    is_featured: false,
    display_order: 0,
  })
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{
    file_path: string
    file_type: string
    file_size: number
    file_name: string
  } | null>(null)
  const [uploadingInstructions, setUploadingInstructions] = useState(false)
  const [uploadedInstructionsFile, setUploadedInstructionsFile] = useState<{
    file_path: string
    file_type: string
    file_size: number
    file_name: string
  } | null>(null)

  useEffect(() => {
    if (isNew) return
    const session = getCurrentSession()
    session.then((s) => {
      if (!s) return
      fetch(`/api/products/${id}`, {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
        .then((res) => {
          if (!res.ok) {
            if (res.status === 404) router.push('/admin/content/products')
            return null
          }
          return res.json()
        })
        .then((data) => {
          if (!data?.product) return
          const p = data.product as Product
          setFormData({
            title: p.title,
            description: p.description || '',
            type: p.type,
            price: p.price?.toString() || '',
            image_url: p.image_url || '',
            asset_url: p.asset_url || '',
            is_active: p.is_active,
            is_featured: p.is_featured,
            display_order: p.display_order,
          })
          if (p.file_path) {
            setUploadedFile({
              file_path: p.file_path,
              file_type: 'application/octet-stream',
              file_size: 0,
              file_name: p.file_path.split('/').pop() || 'file',
            })
          } else setUploadedFile(null)
          if (p.instructions_file_path) {
            setUploadedInstructionsFile({
              file_path: p.instructions_file_path,
              file_type: 'application/pdf',
              file_size: 0,
              file_name: p.instructions_file_path.split('/').pop() || 'install-guide',
            })
          } else setUploadedInstructionsFile(null)
        })
        .catch((err) => console.error('Failed to fetch product:', err))
        .finally(() => setLoading(false))
    })
  }, [id, isNew, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const session = await getCurrentSession()
    if (!session) return
    const payload = {
      title: formData.title,
      description: formData.description || null,
      type: formData.type,
      price: formData.price ? parseFloat(formData.price) : null,
      image_url: formData.image_url || null,
      asset_url: formData.type === 'template' ? (formData.asset_url || null) : null,
      instructions_file_path: formData.type === 'template' ? (uploadedInstructionsFile?.file_path || null) : null,
      is_active: formData.is_active,
      is_featured: formData.is_featured,
      display_order: formData.display_order,
      file_path: uploadedFile?.file_path || null,
    }
    const url = isNew ? '/api/products' : `/api/products/${id}`
    const method = isNew ? 'POST' : 'PUT'
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      router.push('/admin/content/products')
    } else {
      const err = await response.json()
      alert(err.error || 'Failed to save product')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const fd = new FormData()
      fd.append('file', file)
      fd.append('purpose', 'product')
      if (!isNew) fd.append('productId', id)
      const response = await fetch('/api/products/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      if (response.ok) {
        const data = await response.json()
        setUploadedFile({
          file_path: data.file_path,
          file_type: data.file_type,
          file_size: data.file_size,
          file_name: file.name,
        })
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload file')
      }
    } catch (err) {
      console.error('Error uploading file:', err)
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleInstructionsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingInstructions(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const fd = new FormData()
      fd.append('file', file)
      fd.append('purpose', 'instructions')
      if (!isNew) fd.append('productId', id)
      const response = await fetch('/api/products/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      if (response.ok) {
        const data = await response.json()
        setUploadedInstructionsFile({
          file_path: data.file_path,
          file_type: data.file_type,
          file_size: data.file_size,
          file_name: file.name,
        })
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload instructions file')
      }
    } catch (err) {
      console.error('Error uploading instructions file:', err)
      alert('Failed to upload instructions file')
    } finally {
      setUploadingInstructions(false)
    }
  }

  if (!isNew && loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
          <div className="text-gray-400">Loading product...</div>
        </div>
      </ProtectedRoute>
    )
  }

  const breadcrumbLabel = isNew ? 'New product' : (formData.title || 'Edit product')

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Content Management', href: '/admin/content' },
              { label: 'Products', href: '/admin/content/products' },
              { label: breadcrumbLabel },
            ]}
          />
          <div className="mb-6">
            <Link
              href="/admin/content/products"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Products
            </Link>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-gray-900 border border-gray-800 rounded-xl"
          >
            <h2 className="text-2xl font-bold mb-4">
              {isNew ? 'Add New Product' : 'Edit Product'}
            </h2>
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
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Product Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  >
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Price (leave empty for free)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Image URL</label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
              {formData.type === 'template' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Asset URL (repo, n8n export, or external link)</label>
                    <input
                      type="url"
                      value={formData.asset_url}
                      onChange={(e) => setFormData({ ...formData, asset_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://github.com/... or link to template asset"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Install instructions (PDF or doc)</label>
                    {uploadedInstructionsFile ? (
                      <div className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <File size={20} className="text-cyan-400" />
                          <div>
                            <p className="text-sm text-white">{uploadedInstructionsFile.file_name}</p>
                            <p className="text-xs text-gray-400">
                              {(uploadedInstructionsFile.file_size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUploadedInstructionsFile(null)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:border-cyan-500/50 transition-colors">
                        <div className="flex flex-col items-center justify-center py-3">
                          <Upload className="w-6 h-6 mb-1 text-gray-400" />
                          <p className="text-xs text-gray-400">Upload install guide (PDF, etc.)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleInstructionsUpload}
                          disabled={uploadingInstructions}
                          accept=".pdf,.doc,.docx,.txt,.md"
                        />
                      </label>
                    )}
                    {uploadingInstructions && <p className="mt-2 text-sm text-gray-400">Uploading...</p>}
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Product File (PDF, Document, Audio, etc.)</label>
                {uploadedFile ? (
                  <div className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <File size={20} className="text-blue-400" />
                      <div>
                        <p className="text-sm text-white">{uploadedFile.file_name}</p>
                        <p className="text-xs text-gray-400">
                          {(uploadedFile.file_size / 1024).toFixed(2)} KB • {uploadedFile.file_type}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-750 hover:border-purple-500 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PDF, DOC, MP3, ZIP, etc. (MAX. 50MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      accept=".pdf,.doc,.docx,.txt,.zip,.mp3,.mp4,.wav,.jpg,.png"
                    />
                  </label>
                )}
                {uploadingFile && <p className="mt-2 text-sm text-gray-400">Uploading file...</p>}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Display Order</label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
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
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Featured</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-4">
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg"
                >
                  {isNew ? 'Create Product' : 'Update Product'}
                </motion.button>
                <Link
                  href="/admin/content/products"
                  className="px-6 py-2 bg-gray-800 border border-gray-700 text-white font-semibold rounded-lg hover:border-gray-600 inline-flex items-center"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
