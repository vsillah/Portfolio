'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Trash2, CheckCircle, RefreshCw } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface AnalyticsActionsProps {
  days: number
  onRefresh: () => void
}

export default function AnalyticsActions({ days, onRefresh }: AnalyticsActionsProps) {
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        alert('Not authenticated')
        return
      }

      const response = await fetch(`/api/analytics/export?days=${days}&format=${format}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      alert(error.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteOldEvents = async () => {
    if (!confirm(`Are you sure you want to delete events older than ${days} days? This cannot be undone.`)) {
      return
    }

    setDeleting(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        alert('Not authenticated')
        return
      }

      const response = await fetch(`/api/analytics/cleanup?days=${days}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Delete failed')
      }

      alert('Old events deleted successfully')
      onRefresh()
    } catch (error: any) {
      alert(error.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const handleMarkContactRead = async () => {
    setMarkingRead(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) {
        alert('Not authenticated')
        return
      }

      const response = await fetch('/api/contact/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ all: true }),
      })

      if (!response.ok) {
        throw new Error('Failed to mark as read')
      }

      alert('Contact submissions marked as read')
      onRefresh()
    } catch (error: any) {
      alert(error.message || 'Failed to mark as read')
    } finally {
      setMarkingRead(false)
    }
  }

  return (
    <div className="mb-6 p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Admin Actions</h3>
      <div className="flex flex-wrap gap-3">
        <motion.button
          onClick={() => handleExport('csv')}
          disabled={exporting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={18} />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </motion.button>

        <motion.button
          onClick={() => handleExport('json')}
          disabled={exporting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={18} />
          {exporting ? 'Exporting...' : 'Export JSON'}
        </motion.button>

        <motion.button
          onClick={handleDeleteOldEvents}
          disabled={deleting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={18} />
          {deleting ? 'Deleting...' : 'Delete Old Events'}
        </motion.button>

        <motion.button
          onClick={handleMarkContactRead}
          disabled={markingRead}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle size={18} />
          {markingRead ? 'Marking...' : 'Mark All Read'}
        </motion.button>

        <motion.button
          onClick={onRefresh}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg flex items-center gap-2 hover:bg-gray-700"
        >
          <RefreshCw size={18} />
          Refresh
        </motion.button>
      </div>
    </div>
  )
}
