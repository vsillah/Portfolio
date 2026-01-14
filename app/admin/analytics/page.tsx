'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Users, MousePointerClick, Mail, Eye } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import AnalyticsActions from '@/components/admin/AnalyticsActions'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface AnalyticsData {
  totalEvents: number
  totalSessions: number
  totalPageViews: number
  totalClicks: number
  totalFormSubmits: number
  eventsByType: Record<string, number>
  eventsBySection: Record<string, number>
  recentEvents: any[]
  topProjects: Array<{ title: string; clicks: number }>
  topVideos: Array<{ title: string; plays: number }>
  socialClicks: Record<string, number>
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AnalyticsPageContent />
    </ProtectedRoute>
  )
}

function AnalyticsPageContent() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics/stats?days=${days}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.error) {
        throw new Error(result.error)
      }
      setData(result)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      setData({
        totalEvents: 0,
        totalSessions: 0,
        totalPageViews: 0,
        totalClicks: 0,
        totalFormSubmits: 0,
        eventsByType: {},
        eventsBySection: {},
        recentEvents: [],
        topProjects: [],
        topVideos: [],
        socialClicks: {},
      })
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading analytics...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-500">Failed to load analytics. Please check your Supabase connection.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Analytics' }
        ]} />
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-gray-400">Portfolio performance insights</p>
          </div>
        </div>

        {/* Admin Actions */}
        <AnalyticsActions days={days} onRefresh={fetchAnalytics} />

        {/* Time Range Selector */}
        <div className="mb-6 flex gap-2">
          {[1, 7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg ${
                days === d
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {d === 1 ? 'Today' : `${d} Days`}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Users />}
            label="Total Sessions"
            value={data.totalSessions.toLocaleString()}
            color="blue"
          />
          <StatCard
            icon={<Eye />}
            label="Page Views"
            value={data.totalPageViews.toLocaleString()}
            color="green"
          />
          <StatCard
            icon={<MousePointerClick />}
            label="Total Clicks"
            value={data.totalClicks.toLocaleString()}
            color="purple"
          />
          <StatCard
            icon={<Mail />}
            label="Form Submissions"
            value={data.totalFormSubmits.toLocaleString()}
            color="pink"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Events by Type */}
          <ChartCard title="Events by Type">
            <div className="space-y-3">
              {Object.entries(data.eventsByType).length > 0 ? (
                Object.entries(data.eventsByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-gray-300 capitalize">{type.replace('_', ' ')}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{
                            width: `${(count / data.totalEvents) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-white font-semibold w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No events yet</p>
              )}
            </div>
          </ChartCard>

          {/* Events by Section */}
          <ChartCard title="Events by Section">
            <div className="space-y-3">
              {Object.entries(data.eventsBySection).length > 0 ? (
                Object.entries(data.eventsBySection).map(([section, count]) => (
                  <div key={section} className="flex items-center justify-between">
                    <span className="text-gray-300 capitalize">{section}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / data.totalEvents) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-white font-semibold w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No section views yet</p>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Top Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Projects */}
          <ChartCard title="Most Clicked Projects">
            <div className="space-y-3">
              {data.topProjects.length > 0 ? (
                data.topProjects.map((project, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <span className="text-gray-300">{project.title}</span>
                    <span className="text-white font-semibold">{project.clicks} clicks</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No project clicks yet</p>
              )}
            </div>
          </ChartCard>

          {/* Top Videos */}
          <ChartCard title="Most Played Videos">
            <div className="space-y-3">
              {data.topVideos.length > 0 ? (
                data.topVideos.map((video, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <span className="text-gray-300">{video.title}</span>
                    <span className="text-white font-semibold">{video.plays} plays</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No video plays yet</p>
              )}
            </div>
          </ChartCard>
        </div>

        {/* Social Clicks */}
        <ChartCard title="Social Link Clicks">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(data.socialClicks).length > 0 ? (
              Object.entries(data.socialClicks).map(([platform, clicks]) => (
                <div key={platform} className="p-4 bg-gray-900 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-400">{clicks}</div>
                  <div className="text-sm text-gray-400 mt-1">{platform}</div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No social clicks yet</p>
            )}
          </div>
        </ChartCard>

        {/* Recent Events */}
        <ChartCard title="Recent Events" className="mt-6">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.recentEvents.length > 0 ? (
              data.recentEvents.map((event, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-900 rounded-lg flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-purple-400 capitalize">{event.event_type}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-300">{event.event_name}</span>
                    {event.section && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500 capitalize">{event.section}</span>
                      </>
                    )}
                  </div>
                  <span className="text-gray-500">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No events yet</p>
            )}
          </div>
        </ChartCard>
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

function ChartCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`p-6 bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      {children}
    </div>
  )
}
