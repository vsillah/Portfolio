'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Settings, Users, Eye, MousePointerClick, Mail, FolderOpen, Video, BookOpen, Music, Download, Sparkles, ArrowRight } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface AnalyticsSummary {
  totalSessions: number
  totalPageViews: number
  totalClicks: number
  totalFormSubmits: number
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminDashboardContent />
    </ProtectedRoute>
  )
}

function AdminDashboardContent() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/analytics/stats?days=7')
        if (response.ok) {
          const data = await response.json()
          setAnalytics({
            totalSessions: data.totalSessions || 0,
            totalPageViews: data.totalPageViews || 0,
            totalClicks: data.totalClicks || 0,
            totalFormSubmits: data.totalFormSubmits || 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch analytics summary:', error)
        setAnalytics({
          totalSessions: 0,
          totalPageViews: 0,
          totalClicks: 0,
          totalFormSubmits: 0,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
  }, [])

  const contentTypes = [
    {
      name: 'Projects',
      href: '/admin/content/projects',
      icon: <FolderOpen size={24} />,
      description: 'Manage portfolio projects',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Videos',
      href: '/admin/content/videos',
      icon: <Video size={24} />,
      description: 'Manage video content',
      color: 'from-red-500 to-pink-500',
    },
    {
      name: 'Publications',
      href: '/admin/content/publications',
      icon: <BookOpen size={24} />,
      description: 'Manage publications',
      color: 'from-green-500 to-emerald-500',
    },
    {
      name: 'Music',
      href: '/admin/content/music',
      icon: <Music size={24} />,
      description: 'Manage music projects',
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Lead Magnets',
      href: '/admin/content/lead-magnets',
      icon: <Download size={24} />,
      description: 'Manage downloadable resources',
      color: 'from-orange-500 to-yellow-500',
    },
    {
      name: 'Prototypes',
      href: '/admin/content/prototypes',
      icon: <Sparkles size={24} />,
      description: 'Manage app prototype demos',
      color: 'from-purple-500 to-pink-500',
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[{ label: 'Admin Dashboard' }]} />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Manage your portfolio and view analytics</p>
        </div>

        {/* Quick Stats - Analytics Summary */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Analytics Overview</h2>
            <Link href="/admin/analytics">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white hover:border-purple-500/50 transition-colors flex items-center gap-2 text-sm"
              >
                View Full Analytics
                <ArrowRight size={16} />
              </motion.button>
            </Link>
          </div>
          {loading ? (
            <div className="text-gray-400">Loading analytics...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                icon={<Users />}
                label="Sessions (7d)"
                value={analytics?.totalSessions.toLocaleString() || '0'}
                color="blue"
              />
              <StatCard
                icon={<Eye />}
                label="Page Views (7d)"
                value={analytics?.totalPageViews.toLocaleString() || '0'}
                color="green"
              />
              <StatCard
                icon={<MousePointerClick />}
                label="Clicks (7d)"
                value={analytics?.totalClicks.toLocaleString() || '0'}
                color="purple"
              />
              <StatCard
                icon={<Mail />}
                label="Form Submissions (7d)"
                value={analytics?.totalFormSubmits.toLocaleString() || '0'}
                color="pink"
              />
            </div>
          )}
        </div>

        {/* Content Management */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Content Management</h2>
            <Link href="/admin/content">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white hover:border-purple-500/50 transition-colors flex items-center gap-2 text-sm"
              >
                View All Content
                <ArrowRight size={16} />
              </motion.button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contentTypes.map((type, index) => (
              <Link key={type.name} href={type.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-all cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${type.color} flex items-center justify-center text-white mb-3`}>
                    {type.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{type.name}</h3>
                  <p className="text-gray-400 text-sm">{type.description}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/admin/analytics">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                  <BarChart3 size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Full Analytics Dashboard</h3>
                  <p className="text-gray-400 text-sm">View detailed analytics, charts, and insights</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/content">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center">
                  <Settings size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Content Management Hub</h3>
                  <p className="text-gray-400 text-sm">Manage all your portfolio content in one place</p>
                </div>
              </div>
            </motion.div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'blue' | 'green' | 'purple' | 'pink'
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 border-blue-500/50',
    green: 'bg-green-500/20 border-green-500/50',
    purple: 'bg-purple-500/20 border-purple-500/50',
    pink: 'bg-pink-500/20 border-pink-500/50',
  }

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}
