'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, EyeOff, ArrowUp, ArrowDown, File } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { PRODUCT_TYPE_LABELS } from '@/lib/constants/products'
import { formatCurrency } from '@/lib/pricing-model'
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
  created_at: string
  updated_at: string
  asset_url?: string | null
  instructions_file_path?: string | null
}

export default function ProductsManagementPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

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
        const list = (data || []).filter((p: Product) => p.type !== 'merchandise')
        setProducts(list)
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

  const getTypeLabel = (type: string) => {
    return PRODUCT_TYPE_LABELS[type as keyof typeof PRODUCT_TYPE_LABELS] ?? type
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
            <Link href="/admin/content/products/new">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg"
              >
                <Plus size={20} />
                Add Product
              </motion.span>
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading products...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No products found. Add your first one!</p>
              <Link href="/admin/content/products/new">
                <motion.span
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-blue-500/50 transition-colors"
                >
                  <Plus size={20} />
                  Add New Product
                </motion.span>
              </Link>
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
                          {formatCurrency(product.price)}
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
                      {product.type === 'template' && product.asset_url && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-cyan-400">Asset link</span>
                        </>
                      )}
                      {product.type === 'template' && product.instructions_file_path && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-green-400">Install guide</span>
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
                    <Link
                      href={`/admin/content/products/${product.id}`}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 inline-flex"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </Link>
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
