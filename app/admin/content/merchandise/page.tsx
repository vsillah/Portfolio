'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Eye, EyeOff, Settings, Package, CheckCircle, XCircle, Loader, Upload, Image as ImageIcon, X } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import { formatCurrency } from '@/lib/pricing-model'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface MerchandiseProduct {
  id: number
  title: string
  description: string | null
  category: string | null
  printful_product_id: number | null
  base_cost: number | null
  markup_percentage: number | null
  is_print_on_demand: boolean
  is_active: boolean
  image_url: string | null
  variant_count?: number
  created_at: string
  updated_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  apparel: 'Apparel',
  houseware: 'Houseware',
  travel: 'Travel',
  office: 'Office',
}

export default function MerchandiseManagementPage() {
  const [products, setProducts] = useState<MerchandiseProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    success: boolean
    message: string
    results?: { created: number; updated: number; errors: string[] }
  } | null>(null)
  const [syncConfig, setSyncConfig] = useState({
    logoUrl: '',
    defaultMarkup: 50,
    generateMockups: true,
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, SVG)')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      
      setLogoFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return syncConfig.logoUrl || null
    
    setUploadingLogo(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Create form data for upload
      const formData = new FormData()
      formData.append('file', logoFile)
      formData.append('bucket', 'products')
      formData.append('folder', 'merchandise')

      // Upload via API route (bypasses RLS issues)
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      
      // Update sync config with the URL
      setSyncConfig(prev => ({ ...prev, logoUrl: data.publicUrl }))
      
      return data.publicUrl
    } catch (error: any) {
      console.error('Failed to upload logo:', error)
      alert(`Failed to upload logo: ${error.message}`)
      return null
    } finally {
      setUploadingLogo(false)
    }
  }

  const clearLogoFile = () => {
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const fetchProducts = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/products?type=merchandise&active=false', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Filter to only print-on-demand products
        const merchandiseProducts = (data || []).filter(
          (p: any) => p.is_print_on_demand === true
        )
        setProducts(merchandiseProducts)
      }
    } catch (error) {
      console.error('Failed to fetch merchandise:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncStatus(null)

    try {
      // Upload logo first if a file was selected
      let logoUrl = syncConfig.logoUrl
      if (logoFile) {
        const uploadedUrl = await handleUploadLogo()
        if (uploadedUrl) {
          logoUrl = uploadedUrl
        }
      }

      // Check if we have a logo URL (required for mockups, but optional for sync)
      if (!logoUrl && syncConfig.generateMockups) {
        setSyncStatus({
          success: false,
          message: 'Please provide a logo for mockup generation, or disable mockup generation',
        })
        setSyncing(false)
        return
      }

      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/merchandise/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          logoUrl: logoUrl || '',
          defaultMarkup: syncConfig.defaultMarkup,
          generateMockups: syncConfig.generateMockups && !!logoUrl,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSyncStatus({
          success: true,
          message: `Sync completed: ${data.results.created} created, ${data.results.updated} updated`,
          results: data.results,
        })
        fetchProducts() // Refresh product list
      } else {
        setSyncStatus({
          success: false,
          message: data.error || 'Sync failed',
        })
      }
    } catch (error: any) {
      setSyncStatus({
        success: false,
        message: error.message || 'Sync failed',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleToggleActive = async (product: MerchandiseProduct) => {
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

  const handleUpdateMarkup = async (product: MerchandiseProduct, newMarkup: number) => {
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
          markup_percentage: newMarkup,
        }),
      })

      if (response.ok) {
        fetchProducts()
      } else {
        alert('Failed to update markup')
      }
    } catch (error) {
      console.error('Error updating markup:', error)
      alert('Failed to update markup')
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Content', href: '/admin/content' },
              { label: 'Merchandise', href: '/admin/content/merchandise' },
            ]}
          />

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Merchandise Management</h1>
            <p className="text-gray-400">Manage print-on-demand products from Printful</p>
          </div>

          {/* Sync Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8"
          >
            <div className="flex items-center gap-4 mb-4">
              <Package className="text-purple-400" size={24} />
              <h2 className="text-2xl font-bold">Sync from Printful</h2>
            </div>

            <div className="space-y-4">
              {/* Logo Upload Section */}
              <div>
                <label className="block text-sm font-medium mb-2">Logo for Mockups</label>
                
                {/* Upload Area */}
                <div className="space-y-3">
                  {/* File Upload */}
                  <div 
                    className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      logoPreview || syncConfig.logoUrl
                        ? 'border-purple-500 bg-purple-900/20'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileSelect}
                      className="hidden"
                    />
                    
                    {logoPreview ? (
                      <div className="relative">
                        <img 
                          src={logoPreview} 
                          alt="Logo preview" 
                          className="max-h-32 mx-auto rounded-lg"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            clearLogoFile()
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                        >
                          <X size={14} />
                        </button>
                        <p className="mt-2 text-sm text-purple-400">{logoFile?.name}</p>
                      </div>
                    ) : syncConfig.logoUrl ? (
                      <div className="relative">
                        <img 
                          src={syncConfig.logoUrl} 
                          alt="Current logo" 
                          className="max-h-32 mx-auto rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <p className="mt-2 text-sm text-gray-400">Current logo from URL</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto text-gray-500 mb-2" size={32} />
                        <p className="text-gray-400">
                          Click to upload logo
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG, or SVG (max 5MB)
                        </p>
                      </>
                    )}
                  </div>
                  
                  {/* Or divider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-700" />
                    <span className="text-xs text-gray-500">OR</span>
                    <div className="flex-1 h-px bg-gray-700" />
                  </div>
                  
                  {/* URL Input */}
                  <input
                    type="url"
                    value={syncConfig.logoUrl}
                    onChange={(e) => {
                      setSyncConfig({ ...syncConfig, logoUrl: e.target.value })
                      clearLogoFile() // Clear file if URL is entered
                    }}
                    placeholder="https://your-logo-url.com/logo.png"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Upload your logo or provide a URL. This will be used to generate product mockups.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Default Markup (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={syncConfig.defaultMarkup}
                    onChange={(e) =>
                      setSyncConfig({ ...syncConfig, defaultMarkup: parseFloat(e.target.value) || 50 })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncConfig.generateMockups}
                      onChange={(e) =>
                        setSyncConfig({ ...syncConfig, generateMockups: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Generate mockups</span>
                  </label>
                </div>
              </div>

              <motion.button
                onClick={handleSync}
                disabled={syncing || uploadingLogo}
                whileHover={{ scale: syncing || uploadingLogo ? 1 : 1.02 }}
                whileTap={{ scale: syncing || uploadingLogo ? 1 : 0.98 }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingLogo ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    Uploading Logo...
                  </>
                ) : syncing ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={20} />
                    Sync Products from Printful
                  </>
                )}
              </motion.button>
              
              {!syncConfig.logoUrl && !logoFile && (
                <p className="text-xs text-yellow-500">
                  ⚠️ No logo provided. Mockup generation will be skipped unless you upload or provide a logo URL.
                </p>
              )}

              {syncStatus && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg ${
                    syncStatus.success
                      ? 'bg-green-900/30 border border-green-700'
                      : 'bg-red-900/30 border border-red-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {syncStatus.success ? (
                      <CheckCircle className="text-green-400" size={20} />
                    ) : (
                      <XCircle className="text-red-400" size={20} />
                    )}
                    <span className="font-semibold">{syncStatus.message}</span>
                  </div>
                  {syncStatus.results && syncStatus.results.errors.length > 0 && (
                    <div className="mt-2 text-sm text-gray-400">
                      <p className="font-medium mb-1">Errors:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {syncStatus.results.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Products List */}
          {loading ? (
            <div className="text-center py-12">
              <Loader className="animate-spin mx-auto mb-4" size={32} />
              <p className="text-gray-400">Loading merchandise...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-xl">
              <Package className="mx-auto mb-4 text-gray-600" size={48} />
              <p className="text-gray-400 mb-4">No merchandise products found.</p>
              <p className="text-sm text-gray-500">
                Sync products from Printful to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-colors"
                >
                  {/* Image */}
                  <div className="relative h-48 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="text-gray-600" size={48} />
                      </div>
                    )}
                    {product.category && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-gray-900/80 text-white text-xs rounded">
                        {CATEGORY_LABELS[product.category] || product.category}
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={() => handleToggleActive(product)}
                        className={`p-2 rounded-lg ${
                          product.is_active
                            ? 'bg-green-600/80 hover:bg-green-600'
                            : 'bg-gray-700/80 hover:bg-gray-700'
                        } transition-colors`}
                        title={product.is_active ? 'Hide product' : 'Show product'}
                      >
                        {product.is_active ? (
                          <Eye className="text-white" size={16} />
                        ) : (
                          <EyeOff className="text-white" size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                      {product.title}
                    </h3>
                    {product.description && (
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {/* Product Info */}
                    <div className="space-y-2 mb-4 text-sm">
                      {product.base_cost !== null && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Base Cost:</span>
                          <span className="text-white">{formatCurrency(product.base_cost)}</span>
                        </div>
                      )}
                      {product.markup_percentage !== null && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Markup:</span>
                          <span className="text-white">{product.markup_percentage}%</span>
                        </div>
                      )}
                      {product.base_cost !== null && product.markup_percentage !== null && (
                        <div className="flex justify-between font-semibold pt-2 border-t border-gray-800">
                          <span className="text-gray-400">Price:</span>
                          <span className="text-green-400">
                            {formatCurrency(
                              product.base_cost * (1 + product.markup_percentage / 100)
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const newMarkup = prompt(
                            'Enter new markup percentage:',
                            product.markup_percentage?.toString() || '50'
                          )
                          if (newMarkup) {
                            handleUpdateMarkup(product, parseFloat(newMarkup))
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Settings size={16} />
                        Update Markup
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
