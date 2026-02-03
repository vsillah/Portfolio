'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { useAuth } from '@/components/AuthProvider'
import { 
  Bot, 
  User, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'

interface AlignmentData {
  overall: {
    totalCompared: number
    alignedCount: number
    alignmentRate: number
    breakdown: {
      humanGoodLlmGood: number
      humanGoodLlmBad: number
      humanBadLlmGood: number
      humanBadLlmBad: number
    }
  }
  by_model: Record<string, { total: number; aligned: number; rate: number }>
  disagreements: Array<{
    session_id: string
    llm_rating: string
    human_rating: string
    confidence: number
    model: string
    evaluated_at: string
  }>
  confidence_analysis: {
    avg_aligned_confidence: number | null
    avg_misaligned_confidence: number | null
  }
}

export default function AlignmentDashboardPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AlignmentDashboardContent />
    </ProtectedRoute>
  )
}

function AlignmentDashboardContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = useState<AlignmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchAlignment = useCallback(async () => {
    setLoading(true)
    try {
      const token = await user?.getIdToken?.() || localStorage.getItem('supabase.auth.token')
      
      const response = await fetch(`/api/admin/llm-judge/alignment?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching alignment:', error)
    } finally {
      setLoading(false)
    }
  }, [user, days])

  useEffect(() => {
    fetchAlignment()
  }, [fetchAlignment])

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-radiant-gold" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval', href: '/admin/chat-eval' },
          { label: 'LLM Alignment' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bot size={32} className="text-radiant-gold" />
            <h1 className="text-4xl font-heading tracking-wider">Human-LLM Alignment</h1>
          </div>
          <p className="text-platinum-white/60">
            Compare LLM judge evaluations with human annotations
          </p>
        </div>

        {/* Time range selector */}
        <div className="mb-6 flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-sm ${
                days === d
                  ? 'bg-radiant-gold text-imperial-navy'
                  : 'bg-silicon-slate/30 text-platinum-white/70 hover:bg-silicon-slate/50'
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>

        {data ? (
          <>
            {/* Overview stats */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              <StatCard
                icon={<TrendingUp />}
                label="Alignment Rate"
                value={`${data.overall.alignmentRate}%`}
                color="gold"
              />
              <StatCard
                icon={<CheckCircle />}
                label="Aligned Evaluations"
                value={data.overall.alignedCount.toString()}
                color="emerald"
              />
              <StatCard
                icon={<XCircle />}
                label="Disagreements"
                value={(data.overall.totalCompared - data.overall.alignedCount).toString()}
                color="red"
              />
              <StatCard
                icon={<Bot />}
                label="Total Compared"
                value={data.overall.totalCompared.toString()}
                color="blue"
              />
            </div>

            {/* Confusion Matrix */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="p-6 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
                <h3 className="font-heading text-lg mb-4 flex items-center gap-2">
                  <User size={18} className="text-blue-400" />
                  vs
                  <Bot size={18} className="text-purple-400" />
                  Confusion Matrix
                </h3>
                
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {/* Header row */}
                  <div className="p-2"></div>
                  <div className="p-2 text-center font-heading text-emerald-400 text-xs uppercase">
                    LLM: Good
                  </div>
                  <div className="p-2 text-center font-heading text-red-400 text-xs uppercase">
                    LLM: Bad
                  </div>
                  
                  {/* Human Good row */}
                  <div className="p-2 font-heading text-emerald-400 text-xs uppercase">
                    Human: Good
                  </div>
                  <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-center">
                    <span className="text-2xl font-bold text-emerald-400">
                      {data.overall.breakdown.humanGoodLlmGood}
                    </span>
                    <div className="text-xs text-emerald-400/60 mt-1">Aligned</div>
                  </div>
                  <div className="p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg text-center">
                    <span className="text-2xl font-bold text-orange-400">
                      {data.overall.breakdown.humanGoodLlmBad}
                    </span>
                    <div className="text-xs text-orange-400/60 mt-1">LLM Strict</div>
                  </div>
                  
                  {/* Human Bad row */}
                  <div className="p-2 font-heading text-red-400 text-xs uppercase">
                    Human: Bad
                  </div>
                  <div className="p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg text-center">
                    <span className="text-2xl font-bold text-orange-400">
                      {data.overall.breakdown.humanBadLlmGood}
                    </span>
                    <div className="text-xs text-orange-400/60 mt-1">LLM Lenient</div>
                  </div>
                  <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-center">
                    <span className="text-2xl font-bold text-emerald-400">
                      {data.overall.breakdown.humanBadLlmBad}
                    </span>
                    <div className="text-xs text-emerald-400/60 mt-1">Aligned</div>
                  </div>
                </div>
              </div>

              {/* Model Performance */}
              <div className="p-6 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
                <h3 className="font-heading text-lg mb-4">Alignment by Model</h3>
                
                {Object.entries(data.by_model).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(data.by_model).map(([model, stats]) => (
                      <div key={model} className="flex items-center justify-between p-3 bg-silicon-slate/30 rounded-lg">
                        <span className="text-sm font-mono">{model}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-platinum-white/50">
                            {stats.aligned}/{stats.total}
                          </span>
                          <span className={`
                            px-2 py-1 rounded text-xs font-bold
                            ${stats.rate >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 
                              stats.rate >= 60 ? 'bg-yellow-500/20 text-yellow-400' : 
                              'bg-red-500/20 text-red-400'}
                          `}>
                            {stats.rate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-platinum-white/50 text-sm">No model data available</p>
                )}
              </div>
            </div>

            {/* Confidence Analysis */}
            {(data.confidence_analysis.avg_aligned_confidence || data.confidence_analysis.avg_misaligned_confidence) && (
              <div className="p-6 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl mb-8">
                <h3 className="font-heading text-lg mb-4">Confidence Analysis</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="text-sm text-emerald-400/70 mb-1">Avg Confidence (Aligned)</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {data.confidence_analysis.avg_aligned_confidence 
                        ? `${Math.round(data.confidence_analysis.avg_aligned_confidence * 100)}%`
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="text-sm text-red-400/70 mb-1">Avg Confidence (Misaligned)</div>
                    <div className="text-2xl font-bold text-red-400">
                      {data.confidence_analysis.avg_misaligned_confidence 
                        ? `${Math.round(data.confidence_analysis.avg_misaligned_confidence * 100)}%`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Disagreements */}
            <div className="p-6 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
              <h3 className="font-heading text-lg mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-orange-400" />
                Recent Disagreements
              </h3>
              
              {data.disagreements.length > 0 ? (
                <div className="space-y-2">
                  {data.disagreements.map((d, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => router.push(`/admin/chat-eval/${d.session_id}`)}
                      className="p-3 bg-silicon-slate/30 rounded-lg cursor-pointer hover:bg-silicon-slate/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-platinum-white/70">
                          {d.session_id.substring(0, 20)}...
                        </span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={d.human_rating === 'good' ? 'text-emerald-400' : 'text-red-400'}>
                            Human: {d.human_rating}
                          </span>
                          <span className={d.llm_rating === 'good' ? 'text-emerald-400' : 'text-red-400'}>
                            LLM: {d.llm_rating}
                          </span>
                          <span className="text-platinum-white/50">
                            {Math.round(d.confidence * 100)}% conf
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-platinum-white/50 text-sm">No disagreements found</p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-platinum-white/50">
            No alignment data available. Run LLM judge evaluations and add human annotations to see comparisons.
          </div>
        )}
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
  color: 'gold' | 'emerald' | 'red' | 'blue'
}) {
  const colorClasses = {
    gold: 'bg-radiant-gold/20 border-radiant-gold/30 text-radiant-gold',
    emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    red: 'bg-red-500/20 border-red-500/30 text-red-400',
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  }

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-platinum-white/60">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}
