'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, CheckCircle, File, Loader } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface Product {
  id: number
  title: string
  type: string
  file_path: string | null
}

interface OrderItem {
  id: number
  product_id: number
  quantity: number
  products: Product
}

interface DownloadManagerProps {
  orderId: number
  orderItems: OrderItem[]
}

export default function DownloadManager({ orderId, orderItems }: DownloadManagerProps) {
  const [downloading, setDownloading] = useState<Record<number, boolean>>({})
  const [downloaded, setDownloaded] = useState<Record<number, boolean>>({})

  const handleDownload = async (productId: number) => {
    setDownloading({ ...downloading, [productId]: true })

    try {
      const session = await getCurrentSession()
      const response = await fetch(
        `/api/downloads/${productId}?orderId=${orderId}`,
        {
          headers: {
            ...(session && { Authorization: `Bearer ${session.access_token}` }),
          },
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to download')
      }

      const { downloadUrl, fileName } = await response.json()

      // Create download link
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setDownloaded({ ...downloaded, [productId]: true })
    } catch (error: any) {
      alert(error.message || 'Failed to download file')
    } finally {
      setDownloading({ ...downloading, [productId]: false })
    }
  }

  const handleDownloadAll = async () => {
    for (const item of orderItems) {
      if (item.products.file_path) {
        await handleDownload(item.products.id)
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  const hasDownloadableItems = orderItems.some(item => item.products.file_path)

  if (!hasDownloadableItems) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No downloadable files available for this order.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Downloads</h3>
        {orderItems.filter(item => item.products.file_path).length > 1 && (
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500 transition-colors text-sm"
          >
            Download All
          </button>
        )}
      </div>

      <div className="space-y-3">
        {orderItems.map((item) => {
          if (!item.products.file_path) return null

          const isDownloading = downloading[item.products.id]
          const isDownloaded = downloaded[item.products.id]

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <File className="text-blue-400 flex-shrink-0" size={24} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white truncate">
                    {item.products.title}
                  </h4>
                  <p className="text-sm text-gray-400 capitalize">
                    {item.products.type}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDownload(item.products.id)}
                disabled={isDownloading}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                  isDownloaded
                    ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isDownloading ? (
                  <>
                    <Loader className="animate-spin" size={18} />
                    Downloading...
                  </>
                ) : isDownloaded ? (
                  <>
                    <CheckCircle size={18} />
                    Downloaded
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download
                  </>
                )}
              </button>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
