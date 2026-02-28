'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Download, FileText, Video, File, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface LeadMagnet {
  id: number
  title: string
  description: string | null
  file_type: string
  file_size: number | null
  download_count: number
  created_at: string
  file_path?: string | null
  type?: string | null
  video_url?: string | null
  video_thumbnail_url?: string | null
}

interface LeadMagnetCardProps {
  leadMagnet: LeadMagnet
  onDownload: (id: number) => Promise<void>
}

export default function LeadMagnetCard({ leadMagnet, onDownload }: LeadMagnetCardProps) {
  const [downloading, setDownloading] = useState(false)
  const isToolLink =
    leadMagnet.file_path != null &&
    leadMagnet.file_path !== '' &&
    leadMagnet.file_path.startsWith('/')
  const isInteractive =
    leadMagnet.type === 'interactive' ||
    leadMagnet.type === 'link' ||
    (isToolLink && (leadMagnet.type === 'document' || leadMagnet.type === 'ebook'))

  const getFileIcon = () => {
    if (isInteractive) return <ExternalLink className="text-amber-400" size={24} />
    switch (leadMagnet.file_type?.toLowerCase()) {
      case 'pdf':
        return <FileText className="text-red-400" size={24} />
      case 'video':
        return <Video className="text-blue-400" size={24} />
      default:
        return <File className="text-gray-400" size={24} />
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await onDownload(leadMagnet.id)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {getFileIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white mb-2">{leadMagnet.title}</h3>
          {leadMagnet.description && (
            <p className="text-gray-400 text-sm mb-4">{leadMagnet.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            {!isInteractive && (
              <>
                <span>{formatFileSize(leadMagnet.file_size)}</span>
                <span>•</span>
              </>
            )}
            <span>{leadMagnet.download_count} downloads</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {leadMagnet.video_url && (
              <a
                href={leadMagnet.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <Video size={18} />
                Watch video
              </a>
            )}
            {isInteractive ? (
              <Link
                href={leadMagnet.file_path!.startsWith('/') ? leadMagnet.file_path! : `/${leadMagnet.file_path!}`}
                className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-semibold rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <ExternalLink size={18} />
                Open tool
              </Link>
            ) : leadMagnet.file_path ? (
              <motion.button
                onClick={handleDownload}
                disabled={downloading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={18} />
                {downloading ? 'Downloading...' : 'Download'}
              </motion.button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
