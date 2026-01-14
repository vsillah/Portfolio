'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, EyeOff, ArrowUp, ArrowDown, Upload, File, X, DollarSign, Image as ImageIcon } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

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
  created_at: string
  updated_at: string
}

const PRODUCT_TYPES = [
  { value: 'ebook', label: 'E-Book' },
  { value: 'training', label: 'Training Curriculum' },
  { value: 'calculator', label: 'AI Audit Calculator' },
  { value: 'music', label: 'Music' },
  { value: 'app', label: 'App Download' },
  { value: 'merchandise', label: 'Merchandise' },
]

export default function ProductsManagementPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'ebook',
    price: '',
    image_url: '',
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

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/products?active=false', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setProducts(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchProducts()
      } else {
        alert('Failed to delete product')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete product')
    }
  }

  const handleToggleActive = async (product: Product) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_active: !product.is_active,
        }),
      })

      if (response.ok) {
        fetchProducts()
      } else {
        alert('Failed to update product')
      }
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Failed to update product')
    }
  }

  const handleMoveOrder = async (product: Product, direction: 'up' | 'down') => {
    const currentIndex = products.findIndex(p => p.id === product.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= products.length) return

    const targetProduct = products[newIndex]
    const newOrder = targetProduct.display_order

    try {
      const session = await getCurrentSession()
      if (!session) return

      // Swap display orders
      await Promise.all([
        fetch(`/api/products/${product.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: newOrder }),
        }),
        fetch(`/api/products/${targetProduct.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: product.display_order }),
        }),
      ])

      fetchProducts()
    } catch (error) {
      console.error('Error moving product:', error)
      alert('Failed to reorder product')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const session = await getCurrentSession()
      if (!session) return

      const payload = {
        title: formData.title,
        description: formData.description || null,
        type: formData.type,
        price: formData.price ? parseFloat(formData.price) : null,
        image_url: formData.image_url || null,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        display_order: formData.display_order,
        file_path: uploadedFile?.file_path || null,
      }

      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

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
        setEditingProduct(null)
        setFormData({
          title: '',
          description: '',
          type: 'ebook',
          price: '',
          image_url: '',
          is_active: true,
          is_featured: false,
          display_order: 0,
        })
        setUploadedFile(null)
        fetchProducts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save product')
      }
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Failed to save product')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const formData = new FormData()
      formData.append('file', file)
      if (editingProduct) {
        formData.append('productId', editingProduct.id.toString())
      }

      const response = await fetch('/api/products/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
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
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      title: product.title,
      description: product.description || '',
      type: product.type,
      price: product.price?.toString() || '',
      image_url: product.image_url || '',
      is_active: product.is_active,
      is_featured: product.is_featured,
      display_order: product.display_order,
    })
    if (product.file_path) {
      setUploadedFile({
        file_path: product.file_path,
        file_type: 'application/octet-stream',
        file_size: 0,
        file_name: product.file_path.split('/').pop() || 'file',
      })
    } else {
      setUploadedFile(null)
    }
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingProduct(null)
    setUploadedFile(null)
    setFormData({
      title: '',
      description: '',
      type: 'ebook',
      price: '',
      image_url: '',
      is_active: true,
      is_featured: false,
      display_order: 0,
    })
  }

  const getTypeLabel = (type: string) => {
    return PRODUCT_TYPES.find(t => t.value === type)?.label || type
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Products' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Products Management</h1>
              <p className="text-gray-400">Manage lead magnets and products</p>
            </div>
            {!showAddForm && (
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Add Product
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
                {editingProduct ? 'Edit Product' : 'Add New Product'}
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
                      {PRODUCT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
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
                        onClick={handleRemoveFile}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label 
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-750 hover:border-purple-500 transition-colors"
                    >
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
                  {uploadingFile && (
                    <p className="mt-2 text-sm text-gray-400">Uploading file...</p>
                  )}
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
                    {editingProduct ? 'Update Product' : 'Create Product'}
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
              <div className="text-gray-400">Loading products...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No products found. Add your first one!</p>
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-blue-500/50 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                Add New Product
              </motion.button>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{product.title}</h3>
                      {product.is_active ? (
                        <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/50">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded border border-gray-600/50">
                          Inactive
                        </span>
                      )}
                      {product.is_featured && (
                        <span className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded border border-purple-600/50">
                          Featured
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-gray-400 text-sm mb-2 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <span className="px-2 py-1 bg-gray-800 rounded text-xs">
                        {getTypeLabel(product.type)}
                      </span>
                      {product.price !== null ? (
                        <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs">
                          ${product.price.toFixed(2)}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                          Free
                        </span>
                      )}
                      <span>•</span>
                      <span>Order: {product.display_order}</span>
                      {product.file_path && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-blue-400">
                            <File size={14} />
                            File attached
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMoveOrder(product, 'up')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move up"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(product, 'down')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move down"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(product)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title={product.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {product.is_active ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 bg-red-600 rounded-lg hover:bg-red-700"
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
