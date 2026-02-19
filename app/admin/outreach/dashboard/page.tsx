'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Search,
  Mail,
  Linkedin,
  MessageSquare,
  Calendar,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Target,
  Zap,
  Clock,
  Building2,
  Phone,
  Facebook,
  Flame,
  Snowflake,
  Layers,
  ChevronDown,
  ChevronUp,
  Play,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import Link from 'next/link'

interface FunnelData {
  total: number
  enriched: number
  contacted: number
  replied: number
  booked: number
  reply_rate: number
  booking_rate: number
}

interface ChannelStat {
  total: number
  sent: number
  replied: number
  reply_rate: number
}

interface StepStat {
  sent: number
  replied: number
}

interface LeadSource {
  id: string
  name: string
  platform: string
  total_leads_found: number
  total_leads_qualified: number
  total_leads_replied: number
  total_leads_booked: number
  last_run_at: string | null
  is_active: boolean
}

interface RecentActivity {
  id: string
  channel: string
  subject: string | null
  status: string
  sequence_step: number
  sent_at: string | null
  replied_at: string | null
  contact_submissions: {
    id: number
    name: string
    company: string
    lead_score: number
  }
}

interface SourceFunnel {
  total: number
  enriched: number
  contacted: number
  replied: number
  booked: number
  opted_out: number
  no_response: number
}

interface DashboardData {
  funnel: FunnelData
  coldFunnel: FunnelData
  warmFunnel: FunnelData
  funnelBySource: Record<string, SourceFunnel>
  funnelByTemperature: {
    cold: FunnelData
    warm: FunnelData
  }
  warmSourceBreakdown: Record<string, SourceFunnel>
  queueStats: Record<string, number>
  channelStats: {
    email: ChannelStat
    linkedin: ChannelStat
  }
  stepStats: Record<string, StepStat>
  recentActivity: RecentActivity[]
  leadSources: LeadSource[]
}

interface TriggerHistory {
  id: string
  source: string
  triggered_at: string
  status: string
  leads_found: number
  leads_inserted: number
  error_message: string | null
  completed_at: string | null
}

type TemperatureFilter = 'all' | 'warm' | 'cold'

export default function OutreachDashboardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <DashboardContent />
    </ProtectedRoute>
  )
}

/**
 * Format a lead_source key into a human-readable label
 */
function formatSourceLabel(source: string): string {
  return source
    .replace('cold_', '')
    .replace('warm_', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Get the icon and color for a platform/source
 */
function getSourceIcon(source: string) {
  if (source.includes('facebook')) return { Icon: Facebook, color: 'text-blue-500' }
  if (source.includes('linkedin')) return { Icon: Linkedin, color: 'text-sky-400' }
  if (source.includes('google_contacts')) return { Icon: Phone, color: 'text-green-400' }
  if (source.includes('apollo')) return { Icon: Search, color: 'text-purple-400' }
  if (source.includes('google_maps')) return { Icon: Building2, color: 'text-yellow-400' }
  if (source.includes('referral')) return { Icon: Users, color: 'text-pink-400' }
  return { Icon: Search, color: 'text-gray-400' }
}

function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tempFilter, setTempFilter] = useState<TemperatureFilter>('all')
  const [showTriggerSection, setShowTriggerSection] = useState(false)
  const [triggeringSource, setTriggeringSource] = useState<string | null>(null)
  const [triggerMessage, setTriggerMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [triggerHistory, setTriggerHistory] = useState<TriggerHistory[]>([])
  const [maxLeads, setMaxLeads] = useState<Record<string, number>>({
    facebook: 100,
    google_contacts: 500,
    linkedin: 200
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/admin/outreach/dashboard', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        setData(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTriggerHistory = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/admin/outreach/trigger?limit=5', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setTriggerHistory(data.history || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 403 || response.status === 401) {
          setTriggerMessage({ type: 'error', text: errorData.error || 'Admin access required' })
        }
      }
    } catch (error) {
      console.error('Failed to fetch trigger history:', error)
    }
  }, [])

  const triggerScraping = async (source: 'facebook' | 'google_contacts' | 'linkedin' | 'all') => {
    setTriggeringSource(source)
    setTriggerMessage(null)

    try {
      const session = await getCurrentSession()
      if (!session) {
        setTriggerMessage({ type: 'error', text: 'Not authenticated' })
        setTriggeringSource(null)
        return
      }

      const response = await fetch('/api/admin/outreach/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          source,
          options: {
            max_leads: maxLeads[source]
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        setTriggerMessage({ type: 'error', text: `API error: ${errorData.error || response.statusText}` })
        return
      }

      const data = await response.json()

      if (data.success) {
        setTriggerMessage({ type: 'success', text: data.message })
        // Refresh dashboard after a delay to show new leads
        setTimeout(() => {
          fetchData()
          fetchTriggerHistory()
        }, 2000)
      } else {
        setTriggerMessage({ type: 'error', text: data.error || data.message || 'Trigger returned unsuccessful' })
      }
    } catch (error) {
      console.error('Failed to trigger scraping:', error)
      const errMsg = error instanceof Error ? error.message : String(error)
      setTriggerMessage({ type: 'error', text: `Failed to trigger scraping: ${errMsg}` })
    } finally {
      setTriggeringSource(null)
    }
  }

  useEffect(() => {
    fetchData()
    fetchTriggerHistory()
  }, [fetchData, fetchTriggerHistory])

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <RefreshCw size={32} className="animate-spin text-platinum-white/60" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-7xl mx-auto text-center py-20">
          <p className="text-gray-400">Failed to load dashboard data</p>
        </div>
      </div>
    )
  }

  // Select the active funnel based on temperature filter
  const activeFunnel =
    tempFilter === 'warm' ? data.warmFunnel
    : tempFilter === 'cold' ? data.coldFunnel
    : data.funnel

  // Filter sources based on temperature
  const filteredSources = Object.entries(data.funnelBySource).filter(([source]) => {
    if (tempFilter === 'warm') return source.startsWith('warm_')
    if (tempFilter === 'cold') return source.startsWith('cold_')
    return true
  })

  const funnelSteps = [
    { label: 'Sourced', value: activeFunnel.total, icon: Search, color: 'text-blue-400' },
    { label: 'Enriched', value: activeFunnel.enriched, icon: Zap, color: 'text-purple-400' },
    { label: 'Contacted', value: activeFunnel.contacted, icon: Mail, color: 'text-yellow-400' },
    { label: 'Replied', value: activeFunnel.replied, icon: MessageSquare, color: 'text-green-400' },
    { label: 'Booked', value: activeFunnel.booked, icon: Calendar, color: 'text-emerald-400' },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Outreach', href: '/admin/outreach' },
            { label: 'Dashboard' },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-green-400 to-blue-400 bg-clip-text text-transparent">
              Lead Pipeline
            </h1>
            <p className="text-gray-400 mt-1">
              Performance metrics for your warm and cold outreach pipeline
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-silicon-slate/50 border border-silicon-slate rounded-lg hover:bg-silicon-slate transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Temperature Filter Toggle */}
        <div className="flex items-center gap-2 mb-8">
          {([
            { key: 'all' as const, label: 'All Leads', icon: Layers, gradient: 'from-gray-600 to-gray-500' },
            { key: 'warm' as const, label: 'Warm Leads', icon: Flame, gradient: 'from-orange-600 to-amber-500' },
            { key: 'cold' as const, label: 'Cold Leads', icon: Snowflake, gradient: 'from-blue-600 to-cyan-500' },
          ]).map(({ key, label, icon: FilterIcon, gradient }) => (
            <button
              key={key}
              onClick={() => setTempFilter(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                tempFilter === key
                  ? `bg-gradient-to-r ${gradient} border-radiant-gold/50 text-white shadow-lg`
                  : 'bg-silicon-slate/50 border-silicon-slate text-gray-400 hover:bg-silicon-slate'
              }`}
            >
              <FilterIcon size={16} />
              {label}
              <span className="text-xs opacity-70">
                ({key === 'warm' ? data.warmFunnel.total
                  : key === 'cold' ? data.coldFunnel.total
                  : data.funnel.total})
              </span>
            </button>
          ))}
        </div>

        {/* Trigger Warm Lead Scraping Section */}
        <div className="mb-8 bg-silicon-slate/50 border border-silicon-slate rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTriggerSection(!showTriggerSection)}
            className="w-full p-4 flex items-center justify-between hover:bg-silicon-slate/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Zap size={20} className="text-yellow-400" />
              <h2 className="text-xl font-semibold">Trigger Warm Lead Scraping</h2>
            </div>
            {showTriggerSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showTriggerSection && (
            <div className="p-6 border-t border-silicon-slate space-y-6">
              {/* Trigger Message */}
              {triggerMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border flex items-center gap-3 ${
                    triggerMessage.type === 'success'
                      ? 'bg-green-900/20 border-green-700 text-green-300'
                      : 'bg-red-900/20 border-red-700 text-red-300'
                  }`}
                >
                  {triggerMessage.type === 'success' ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                  <span>{triggerMessage.text}</span>
                </motion.div>
              )}

              {/* Trigger Sources */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Facebook */}
                <div className="p-4 bg-silicon-slate/50 border border-radiant-gold/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Facebook size={20} className="text-blue-400" />
                    <h3 className="font-semibold">Facebook</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Friends, group members, post engagement
                  </p>
                  <div className="mb-3">
                    <label className="text-xs text-platinum-white/60">Max Leads</label>
                    <input
                      type="number"
                      value={maxLeads.facebook}
                      onChange={(e) => setMaxLeads({ ...maxLeads, facebook: parseInt(e.target.value) || 100 })}
                      className="w-full mt-1 px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded text-sm"
                      min={10}
                      max={500}
                    />
                  </div>
                  {triggerHistory.filter(h => h.source === 'facebook')[0] && (
                    <div className="text-xs text-platinum-white/60 mb-3">
                      Last run: {new Date(triggerHistory.filter(h => h.source === 'facebook')[0].triggered_at).toLocaleString()}
                    </div>
                  )}
                  <button
                    onClick={() => triggerScraping('facebook')}
                    disabled={triggeringSource !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    {triggeringSource === 'facebook' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    {triggeringSource === 'facebook' ? 'Triggering...' : 'Trigger'}
                  </button>
                </div>

                {/* Google Contacts */}
                <div className="p-4 bg-silicon-slate/50 border border-radiant-gold/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone size={20} className="text-green-400" />
                    <h3 className="font-semibold">Google Contacts</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Contacts with business information
                  </p>
                  <div className="mb-3">
                    <label className="text-xs text-platinum-white/60">Max Contacts</label>
                    <input
                      type="number"
                      value={maxLeads.google_contacts}
                      onChange={(e) => setMaxLeads({ ...maxLeads, google_contacts: parseInt(e.target.value) || 500 })}
                      className="w-full mt-1 px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded text-sm"
                      min={10}
                      max={1000}
                    />
                  </div>
                  {triggerHistory.filter(h => h.source === 'google_contacts')[0] && (
                    <div className="text-xs text-platinum-white/60 mb-3">
                      Last run: {new Date(triggerHistory.filter(h => h.source === 'google_contacts')[0].triggered_at).toLocaleString()}
                    </div>
                  )}
                  <button
                    onClick={() => triggerScraping('google_contacts')}
                    disabled={triggeringSource !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    {triggeringSource === 'google_contacts' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    {triggeringSource === 'google_contacts' ? 'Triggering...' : 'Trigger'}
                  </button>
                </div>

                {/* LinkedIn */}
                <div className="p-4 bg-silicon-slate/50 border border-radiant-gold/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Linkedin size={20} className="text-sky-400" />
                    <h3 className="font-semibold">LinkedIn</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Connections and post engagement
                  </p>
                  <div className="mb-3">
                    <label className="text-xs text-platinum-white/60">Max Leads</label>
                    <input
                      type="number"
                      value={maxLeads.linkedin}
                      onChange={(e) => setMaxLeads({ ...maxLeads, linkedin: parseInt(e.target.value) || 200 })}
                      className="w-full mt-1 px-3 py-2 bg-silicon-slate/50 border border-silicon-slate rounded text-sm"
                      min={10}
                      max={1000}
                    />
                  </div>
                  {triggerHistory.filter(h => h.source === 'linkedin')[0] && (
                    <div className="text-xs text-platinum-white/60 mb-3">
                      Last run: {new Date(triggerHistory.filter(h => h.source === 'linkedin')[0].triggered_at).toLocaleString()}
                    </div>
                  )}
                  <button
                    onClick={() => triggerScraping('linkedin')}
                    disabled={triggeringSource !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    {triggeringSource === 'linkedin' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    {triggeringSource === 'linkedin' ? 'Triggering...' : 'Trigger'}
                  </button>
                </div>
              </div>

              {/* Trigger All Warm Sources Button */}
              <button
                onClick={() => triggerScraping('all')}
                disabled={triggeringSource !== null}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-purple-600 hover:from-orange-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {triggeringSource === 'all' ? (
                  <RefreshCw size={20} className="animate-spin" />
                ) : (
                  <Flame size={20} />
                )}
                {triggeringSource === 'all' ? 'Triggering All Warm Sources...' : 'Trigger All Warm Sources'}
              </button>
            </div>
          )}
        </div>

        {/* Lead Temperature Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link href="/admin/outreach?tab=leads&filter=warm">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br bg-silicon-slate/50 border border-radiant-gold/30 rounded-xl p-5 cursor-pointer hover:border-radiant-gold/50 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame size={20} className="text-orange-400" />
                  <span className="font-semibold text-orange-300">Warm Leads</span>
                </div>
                <span className="text-2xl font-bold">{data.warmFunnel.total}</span>
              </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-platinum-white/60">Enriched</div>
                <div className="font-medium text-orange-200">{data.warmFunnel.enriched}</div>
              </div>
              <div>
                <div className="text-platinum-white/60">Contacted</div>
                <div className="font-medium text-orange-200">{data.warmFunnel.contacted}</div>
              </div>
              <div>
                <div className="text-platinum-white/60">Reply Rate</div>
                <div className="font-medium text-green-400">{data.warmFunnel.reply_rate}%</div>
              </div>
              <div>
                <div className="text-platinum-white/60">Booked</div>
                <div className="font-medium text-emerald-400">{data.warmFunnel.booked}</div>
              </div>
            </div>
            </motion.div>
          </Link>

          <Link href="/admin/outreach?tab=leads&filter=cold">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br bg-silicon-slate/50 border border-radiant-gold/30 rounded-xl p-5 cursor-pointer hover:border-radiant-gold/50 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Snowflake size={20} className="text-blue-400" />
                  <span className="font-semibold text-blue-300">Cold Leads</span>
                </div>
                <span className="text-2xl font-bold">{data.coldFunnel.total}</span>
              </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-platinum-white/60">Enriched</div>
                <div className="font-medium text-blue-200">{data.coldFunnel.enriched}</div>
              </div>
              <div>
                <div className="text-platinum-white/60">Contacted</div>
                <div className="font-medium text-blue-200">{data.coldFunnel.contacted}</div>
              </div>
              <div>
                <div className="text-platinum-white/60">Reply Rate</div>
                <div className="font-medium text-green-400">{data.coldFunnel.reply_rate}%</div>
              </div>
              <div>
                <div className="text-platinum-white/60">Booked</div>
                <div className="font-medium text-emerald-400">{data.coldFunnel.booked}</div>
              </div>
            </div>
            </motion.div>
          </Link>
        </div>

        {/* Funnel Visualization */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Pipeline Funnel
            {tempFilter !== 'all' && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                tempFilter === 'warm'
                  ? 'bg-orange-900/50 text-orange-400'
                  : 'bg-blue-900/50 text-blue-400'
              }`}>
                {tempFilter === 'warm' ? 'Warm Only' : 'Cold Only'}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {funnelSteps.map((step, index) => {
              const statusMap: Record<string, string> = {
                'Sourced': 'all',
                'Enriched': 'all', // enriched is determined by lead_score not null
                'Contacted': 'sequence_active',
                'Replied': 'replied',
                'Booked': 'booked'
              }
              const statusFilter = statusMap[step.label] || 'all'
              const filterParam = tempFilter !== 'all' ? `&filter=${tempFilter}` : ''
              
              return (
                <div key={step.label} className="flex items-center flex-1">
                  <Link href={`/admin/outreach?tab=leads${filterParam}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`} className="flex-1">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex-1 bg-silicon-slate/50 border border-silicon-slate rounded-xl p-4 text-center cursor-pointer hover:bg-silicon-slate hover:border-radiant-gold/50 transition-all"
                    >
                      <step.icon size={24} className={`mx-auto mb-2 ${step.color}`} />
                      <div className="text-2xl font-bold">{step.value}</div>
                      <div className="text-xs text-gray-400 mt-1">{step.label}</div>
                      {index > 0 && step.value > 0 && funnelSteps[index - 1].value > 0 && (
                        <div className="text-xs text-platinum-white/60 mt-1">
                          {Math.round((step.value / funnelSteps[index - 1].value) * 100)}%
                        </div>
                      )}
                    </motion.div>
                  </Link>
                  {index < funnelSteps.length - 1 && (
                    <ArrowRight size={16} className="text-platinum-white/60 mx-1 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br bg-silicon-slate/50 border border-radiant-gold/30 rounded-xl p-4">
            <div className="text-sm text-blue-400">Reply Rate</div>
            <div className="text-3xl font-bold mt-1">{activeFunnel.reply_rate}%</div>
          </div>
          <div className="bg-gradient-to-br bg-silicon-slate/50 border border-radiant-gold/30 rounded-xl p-4">
            <div className="text-sm text-green-400">Booking Rate</div>
            <div className="text-3xl font-bold mt-1">{activeFunnel.booking_rate}%</div>
          </div>
          <div className="bg-gradient-to-br bg-silicon-slate/50 border border-radiant-gold/30 rounded-xl p-4">
            <div className="text-sm text-yellow-400">Drafts Pending</div>
            <div className="text-3xl font-bold mt-1">{data.queueStats.draft || 0}</div>
          </div>
          <div className="bg-gradient-to-br bg-silicon-slate/50 border border-radiant-gold/30 rounded-xl p-4">
            <div className="text-sm text-purple-400">Active Sequences</div>
            <div className="text-3xl font-bold mt-1">
              {activeFunnel.contacted}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Channel Performance */}
          <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-purple-400" />
              Channel Performance
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-silicon-slate/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail size={20} className="text-blue-400" />
                  <div>
                    <div className="font-medium">Email</div>
                    <div className="text-xs text-gray-400">
                      {data.channelStats.email.sent} sent, {data.channelStats.email.replied} replied
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{data.channelStats.email.reply_rate}%</div>
                  <div className="text-xs text-gray-400">reply rate</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-silicon-slate/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Linkedin size={20} className="text-sky-400" />
                  <div>
                    <div className="font-medium">LinkedIn</div>
                    <div className="text-xs text-gray-400">
                      {data.channelStats.linkedin.sent} sent, {data.channelStats.linkedin.replied} replied
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{data.channelStats.linkedin.reply_rate}%</div>
                  <div className="text-xs text-gray-400">reply rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sequence Step Performance */}
          <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target size={20} className="text-green-400" />
              Sequence Step Performance
            </h3>
            <div className="space-y-3">
              {Object.entries(data.stepStats).map(([step, stat]) => {
                const replyRate = stat.sent > 0
                  ? Math.round((stat.replied / stat.sent) * 100)
                  : 0
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div className="w-16 text-sm text-gray-400">Step {step}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400">{stat.sent} sent</span>
                        <span className="text-green-400">{stat.replied} replied ({replyRate}%)</span>
                      </div>
                      <div className="w-full bg-silicon-slate rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-600 to-green-400 h-2 rounded-full transition-all"
                          style={{ width: `${replyRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              {Object.keys(data.stepStats).length === 0 && (
                <p className="text-platinum-white/60 text-sm">No sequence data yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Source Breakdown */}
          <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 size={20} className="text-yellow-400" />
              Source Breakdown
            </h3>
            {filteredSources.length > 0 ? (
              <div className="space-y-4">
                {filteredSources.map(([source, stats]) => {
                  const { Icon: SourceIcon, color: iconColor } = getSourceIcon(source)
                  const isWarm = source.startsWith('warm_')
                  return (
                    <Link key={source} href={`/admin/outreach?tab=leads&source=${source}`}>
                      <div className="p-3 bg-silicon-slate/50 rounded-lg hover:bg-silicon-slate/70 cursor-pointer transition-all hover:border hover:border-radiant-gold/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <SourceIcon size={14} className={iconColor} />
                            <span className="font-medium text-sm">{formatSourceLabel(source)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              isWarm
                                ? 'bg-radiant-gold/30 text-radiant-gold border border-radiant-gold/50'
                                : 'bg-silicon-slate text-radiant-gold border border-radiant-gold/50'
                            }`}>
                              {isWarm ? 'WARM' : 'COLD'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{stats.total} leads</span>
                        </div>
                      <div className="grid grid-cols-5 gap-2 text-xs">
                        <div>
                          <div className="text-platinum-white/60">Enriched</div>
                          <div className="font-medium">{stats.enriched}</div>
                        </div>
                        <div>
                          <div className="text-platinum-white/60">Contacted</div>
                          <div className="font-medium">{stats.contacted}</div>
                        </div>
                        <div>
                          <div className="text-platinum-white/60">Replied</div>
                          <div className="font-medium text-green-400">{stats.replied}</div>
                        </div>
                        <div>
                          <div className="text-platinum-white/60">Booked</div>
                          <div className="font-medium text-emerald-400">{stats.booked}</div>
                        </div>
                        <div>
                          <div className="text-platinum-white/60">Opted Out</div>
                          <div className="font-medium text-red-400">{stats.opted_out}</div>
                        </div>
                      </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-platinum-white/60 text-sm">
                {tempFilter === 'warm'
                  ? 'No warm leads sourced yet'
                  : tempFilter === 'cold'
                  ? 'No cold leads sourced yet'
                  : 'No leads sourced yet'}
              </p>
            )}
          </div>

          {/* Lead Sources */}
          <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Search size={20} className="text-blue-400" />
              Lead Sources
            </h3>
            {data.leadSources.length > 0 ? (
              <div className="space-y-3">
                {data.leadSources.map((source) => {
                  const isWarmPlatform = ['facebook', 'google_contacts'].includes(source.platform)
                  return (
                    <div key={source.id} className="p-3 bg-silicon-slate/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{source.name}</span>
                          {isWarmPlatform && (
                            <Flame size={12} className="text-orange-400" />
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          source.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : 'bg-silicon-slate text-gray-400'
                        }`}>
                          {source.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className={`px-1.5 py-0.5 rounded ${
                          isWarmPlatform
                            ? 'bg-orange-900/30 text-orange-400'
                            : 'bg-blue-900/30 text-blue-400'
                        }`}>
                          {source.platform}
                        </span>
                        <span>{source.total_leads_found} found</span>
                        <span>{source.total_leads_qualified} qualified</span>
                        {source.last_run_at && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(source.last_run_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-platinum-white/60 text-sm">No lead sources configured yet</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-silicon-slate/50 border border-silicon-slate rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-gray-400" />
            Recent Activity
          </h3>
          {data.recentActivity.length > 0 ? (
            <div className="space-y-2">
              {data.recentActivity.map((activity) => (
                <Link key={activity.id} href={`/admin/outreach?tab=leads&id=${activity.contact_submissions?.id || ''}`}>
                  <div className="flex items-center justify-between p-3 bg-silicon-slate/50 rounded-lg hover:bg-silicon-slate/70 cursor-pointer transition-all hover:border hover:border-radiant-gold/50">
                    <div className="flex items-center gap-3">
                      {activity.channel === 'email' ? (
                        <Mail size={16} className="text-blue-400" />
                      ) : (
                        <Linkedin size={16} className="text-sky-400" />
                      )}
                      <div>
                        <span className="font-medium text-sm">
                          {activity.contact_submissions?.name || 'Unknown'}
                        </span>
                        <span className="text-platinum-white/60 text-sm mx-2">
                          {activity.contact_submissions?.company || ''}
                        </span>
                      </div>
                    </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded ${
                      activity.status === 'replied'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-purple-900/50 text-purple-400'
                    }`}>
                      {activity.status}
                    </span>
                    <span className="text-platinum-white/60">
                      Step {activity.sequence_step}
                    </span>
                    <span className="text-platinum-white/60">
                      {activity.sent_at
                        ? new Date(activity.sent_at).toLocaleDateString()
                        : ''}
                    </span>
                  </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-platinum-white/60 text-sm">No outreach activity yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
