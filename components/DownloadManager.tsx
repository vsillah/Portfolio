'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, CheckCircle, File, Loader, ExternalLink, BookOpen } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface Product {
  id: number
  title: string
  type: string
  file_path: string | null
  asset_url?: string | null
  instructions_file_path?: string | null
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
  const [instructionsLoading, setInstructionsLoading] = useState<Record<number, boolean>>({})

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

  const handleInstructionsDownload = async (productId: number) => {
    setInstructionsLoading(prev => ({ ...prev, [productId]: true }))
    try {
      const session = await getCurrentSession()
      const response = await fetch(
        `/api/products/${productId}/instructions?orderId=${orderId}`,
        { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} }
      )
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to get instructions')
      }
      const { downloadUrl, fileName } = await response.json()
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName || 'instructions'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to download instructions')
    } finally {
      setInstructionsLoading(prev => ({ ...prev, [productId]: false }))
    }
  }

  const hasFileDownloads = orderItems.some(item => item.products.file_path)
  const templateItems = orderItems.filter(
    item => item.products.type === 'template' && (item.products.asset_url || item.products.instructions_file_path)
  )
  const hasTemplateDeliverables = templateItems.length > 0

  if (!hasFileDownloads && !hasTemplateDeliverables) {
    return (
      <div className="text-center py-8 text-platinum-white/80">
        <p>No downloadable files or template access for this order.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {hasFileDownloads && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Downloads</h3>
            {orderItems.filter(item => item.products.file_path).length > 1 && (
              <button
                onClick={handleDownloadAll}
                className="px-4 py-2 btn-ghost transition-colors text-sm"
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
                  key={`file-${item.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-silicon-slate border border-silicon-slate rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="text-radiant-gold flex-shrink-0" size={24} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate">{item.products.title}</h4>
                      <p className="text-sm text-platinum-white/80 capitalize">{item.products.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(item.products.id)}
                    disabled={isDownloading}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                      isDownloaded
                        ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                        : 'btn-gold'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isDownloading ? (
                      <><Loader className="animate-spin" size={18} /> Downloading...</>
                    ) : isDownloaded ? (
                      <><CheckCircle size={18} /> Downloaded</>
                    ) : (
                      <><Download size={18} /> Download</>
                    )}
                  </button>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {hasTemplateDeliverables && (
        <>
          <h3 className="text-xl font-bold">Template access</h3>
          <div className="space-y-3">
            {templateItems.map((item) => (
              <motion.div
                key={`template-${item.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-silicon-slate border border-silicon-slate rounded-lg p-4 space-y-3"
              >
                <h4 className="font-semibold text-foreground">{item.products.title}</h4>
                <div className="flex flex-wrap gap-2">
                  {item.products.asset_url && (
                    <a
                      href={item.products.asset_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-radiant-gold/20 border border-radiant-gold/50 text-radiant-gold hover:bg-radiant-gold/30 text-sm font-medium"
                    >
                      <ExternalLink size={16} />
                      Repo / asset link
                    </a>
                  )}
                  {item.products.instructions_file_path && (
                    <button
                      onClick={() => handleInstructionsDownload(item.products.id)}
                      disabled={instructionsLoading[item.products.id]}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-light/20 border border-radiant-gold/50 text-gold-light hover:bg-gold-light/30 text-sm font-medium disabled:opacity-50"
                    >
                      {instructionsLoading[item.products.id] ? (
                        <Loader className="animate-spin" size={16} />
                      ) : (
                        <BookOpen size={16} />
                      )}
                      Install instructions
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
