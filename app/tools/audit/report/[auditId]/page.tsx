'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AUDIT_CATEGORIES,
  formatPayloadLine,
} from '@/lib/audit-questions'
import { getIndustryDisplayName } from '@/lib/constants/industry'

interface AuditReport {
  id: string
  status: string
  businessName?: string | null
  websiteUrl?: string | null
  contactEmail?: string | null
  industrySlug?: string | null
  businessChallenges?: Record<string, unknown>
  techStack?: Record<string, unknown>
  automationNeeds?: Record<string, unknown>
  aiReadiness?: Record<string, unknown>
  budgetTimeline?: Record<string, unknown>
  decisionMaking?: Record<string, unknown>
  diagnosticSummary?: string
  keyInsights?: string[]
  recommendedActions?: string[]
  urgencyScore?: number | null
  opportunityScore?: number | null
  enrichedTechStack?: {
    domain?: string
    technologies?: Array<{ name: string; tag?: string }>
    byTag?: Record<string, string[]>
  } | null
  reportTier?: string | null
}

function ScoreBand({ score, label }: { score: number; label: string }) {
  const band = score <= 3 ? 'low' : score <= 6 ? 'mid' : 'high'
  const colors = {
    low: 'bg-red-500/20 border-red-400/60 text-red-200',
    mid: 'bg-amber-500/20 border-amber-400/60 text-amber-200',
    high: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200',
  }
  return (
    <div className={`rounded-lg border p-4 ${colors[band]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-2xl font-bold">{score}/10</p>
    </div>
  )
}

export default function AuditReportPage() {
  const params = useParams()
  const auditId = params.auditId as string
  const [report, setReport] = useState<AuditReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auditId) return
    fetch(`/api/chat/diagnostic?auditId=${encodeURIComponent(auditId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.audit) {
          setReport(data.audit)
        } else {
          setError('Report not found')
        }
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false))
  }, [auditId])

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-2 border-radiant-gold border-t-transparent rounded-full mx-auto" />
          <p className="text-platinum-white/60 text-sm">Loading your report...</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-platinum-white/80">{error || 'Report not found'}</p>
          <Link href="/tools/audit" className="text-radiant-gold hover:underline">
            Start a new audit
          </Link>
        </div>
      </div>
    )
  }

  const tierLabel = report.reportTier === 'platinum' ? 'Strategy Package'
    : report.reportTier === 'gold' ? 'Full Analysis'
    : report.reportTier === 'silver' ? 'Smart Report'
    : 'Basic Report'

  const tierColor = report.reportTier === 'platinum' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
    : report.reportTier === 'gold' ? 'bg-yellow-500/20 border-yellow-400/40 text-yellow-200'
    : report.reportTier === 'silver' ? 'bg-slate-400/20 border-slate-300/40 text-slate-200'
    : 'bg-amber-700/20 border-amber-600/40 text-amber-300'

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white pt-12 pb-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-radiant-gold">
                {report.businessName ? `${report.businessName} — Audit Report` : 'Your Audit Report'}
              </h1>
              {report.industrySlug && (
                <p className="text-platinum-white/60 text-sm mt-1">
                  {getIndustryDisplayName(report.industrySlug)}
                </p>
              )}
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${tierColor}`}>
              {tierLabel}
            </span>
          </div>

          {/* Scores */}
          {(report.urgencyScore != null || report.opportunityScore != null) && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {report.urgencyScore != null && (
                <ScoreBand score={report.urgencyScore} label="Urgency" />
              )}
              {report.opportunityScore != null && (
                <ScoreBand score={report.opportunityScore} label="Opportunity" />
              )}
            </div>
          )}

          {/* Summary */}
          {report.diagnosticSummary && (
            <div className="rounded-lg border border-platinum-white/20 bg-black/20 p-4 mb-6">
              <h2 className="font-semibold text-platinum-white mb-2">Summary</h2>
              <p className="text-sm text-platinum-white/80">{report.diagnosticSummary}</p>
            </div>
          )}

          {/* Key Insights */}
          {report.keyInsights && report.keyInsights.length > 0 && (
            <div className="rounded-lg border border-platinum-white/20 bg-black/20 p-4 mb-6">
              <h2 className="font-semibold text-platinum-white mb-2">Key Insights</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-platinum-white/80">
                {report.keyInsights.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tech Stack Analysis (Gold tier) */}
          {report.enrichedTechStack?.technologies && report.enrichedTechStack.technologies.length > 0 && (
            <div className="rounded-lg border border-radiant-gold/30 bg-black/20 p-4 mb-6">
              <h2 className="font-semibold text-platinum-white mb-2">Tech Stack Analysis</h2>
              <p className="text-xs text-platinum-white/60 mb-3">
                Detected on {report.enrichedTechStack.domain || report.websiteUrl}
              </p>
              {report.enrichedTechStack.byTag && Object.keys(report.enrichedTechStack.byTag).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(report.enrichedTechStack.byTag).slice(0, 8).map(([tag, tools]) => (
                    <div key={tag} className="rounded-md bg-platinum-white/5 p-2">
                      <p className="text-xs font-medium text-radiant-gold/80">{tag}</p>
                      <p className="text-sm text-platinum-white/90">{(tools as string[]).join(', ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.enrichedTechStack.technologies.slice(0, 12).map((tech) => (
                    <span key={tech.name} className="inline-block rounded-full bg-platinum-white/10 px-3 py-1 text-xs text-platinum-white/80">
                      {tech.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Locked sections */}
          {!report.websiteUrl && (
            <div className="rounded-lg border border-dashed border-platinum-white/20 bg-black/10 p-4 mb-4">
              <p className="text-sm font-medium text-platinum-white/80">Tech Stack & Website Analysis</p>
              <p className="text-xs text-platinum-white/50 mt-0.5">
                Add your website URL to unlock tech stack detection and visual analysis.
              </p>
            </div>
          )}

          {(!report.contactEmail || !report.websiteUrl || !report.industrySlug) && (
            <div className="rounded-lg border border-dashed border-platinum-white/20 bg-black/10 p-4 mb-4">
              <p className="text-sm font-medium text-platinum-white/80">Personalized Strategy Deck</p>
              <p className="text-xs text-platinum-white/50 mt-0.5">
                Provide your email, website URL, and industry to unlock a downloadable strategy deck.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Link
              href="/tools/audit"
              className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90"
            >
              Start a new audit
            </Link>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 rounded-lg border border-radiant-gold/40 text-platinum-white hover:bg-radiant-gold/10"
            >
              Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
