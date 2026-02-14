'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Settings, Users, Eye, MousePointerClick, Mail, ArrowRight, MessageCircle, FileText, TrendingUp, FlaskConical, FolderKanban, Send, DollarSign, RefreshCw, ClipboardCheck } from 'lucide-react'
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

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/chat-eval">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center">
                  <MessageCircle size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Chat Eval</h3>
                  <p className="text-gray-400 text-sm">Evaluate chat conversations with LLM grading</p>
                </div>
              </div>
            </motion.div>
          </Link>

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
                  <h3 className="text-xl font-bold mb-1">Analytics Dashboard</h3>
                  <p className="text-gray-400 text-sm">View detailed analytics and insights</p>
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
                  <h3 className="text-xl font-bold mb-1">Content Hub</h3>
                  <p className="text-gray-400 text-sm">Manage all portfolio content</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/users">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-green-600 to-teal-600 flex items-center justify-center">
                  <Users size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">User Management</h3>
                  <p className="text-gray-400 text-sm">Manage users and roles</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/prompts">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center">
                  <FileText size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">System Prompts</h3>
                  <p className="text-gray-400 text-sm">Configure chatbot and evaluation criteria</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/sales">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center justify-center">
                  <TrendingUp size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Sales Dashboard</h3>
                  <p className="text-gray-400 text-sm">Track diagnostic audits and sales conversations</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/client-projects">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center">
                  <FolderKanban size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Client Projects</h3>
                  <p className="text-gray-400 text-sm">Track milestones and send progress updates</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/outreach">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-sky-600/20 to-blue-600/20 border border-sky-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 flex items-center justify-center">
                  <Send size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Lead Pipeline</h3>
                  <p className="text-gray-400 text-sm">Manage all leads, outreach messages, and pipeline metrics</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/value-evidence">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center">
                  <DollarSign size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Value Evidence</h3>
                  <p className="text-gray-400 text-sm">Pain points, monetary calculations, and value reports</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/continuity-plans">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center">
                  <RefreshCw size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Continuity Plans</h3>
                  <p className="text-gray-400 text-sm">Manage recurring subscription plans for ongoing support</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/meeting-tasks">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center">
                  <ClipboardCheck size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Meeting Tasks</h3>
                  <p className="text-gray-400 text-sm">Track action items between meetings and send client updates</p>
                </div>
              </div>
            </motion.div>
          </Link>

          <Link href="/admin/testing">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-gradient-to-r from-rose-600/20 to-red-600/20 border border-rose-500/50 rounded-xl cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 flex items-center justify-center">
                  <FlaskConical size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">E2E Testing</h3>
                  <p className="text-gray-400 text-sm">Run automated client simulations</p>
                </div>
              </div>
            </motion.div>
          </Link>
          </div>
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
