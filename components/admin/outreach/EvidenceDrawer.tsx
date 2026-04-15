'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import Link from 'next/link'
import { getCurrentSession } from '@/lib/auth'

interface EvidenceItem {
  id: string
  display_name: string | null
  source_excerpt: string
  confidence_score: number
  monetary_indicator?: number | null
}

interface ReportItem {
  id: string
  title: string | null
  total_annual_value: number | null
  created_at: string
}

export interface EvidenceDrawerData {
  evidence: EvidenceItem[]
  reports: ReportItem[]
  totalEvidenceCount: number
}

interface EvidenceDrawerProps {
  contactId: number | null
  data: EvidenceDrawerData | null
  loading: boolean
  onClose: () => void
  onDataChange: (data: EvidenceDrawerData | null) => void
  onRefreshExtract: (contactId: number) => Promise<void>
  fetchLeads: () => Promise<void>
}

function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = evidence.source_excerpt.length > 100
  return (
    <li className="p-3 rounded-lg bg-silicon-slate/50 border border-silicon-slate text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{evidence.display_name ?? 'Unknown'}</span>
        <span className="text-xs text-muted-foreground ml-2 shrink-0">
          {(evidence.confidence_score * 100).toFixed(0)}%
          {evidence.monetary_indicator != null && ` · $${Number(evidence.monetary_indicator).toLocaleString()}`}
        </span>
      </div>
      <p className={`text-muted-foreground mt-1 ${isLong && !expanded ? 'line-clamp-2' : ''}`}>
        {evidence.source_excerpt}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-purple-400 hover:text-purple-300 mt-1"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </li>
  )
}

export default function EvidenceDrawer({
  contactId,
  data,
  loading,
  onClose,
  onDataChange,
  onRefreshExtract,
  fetchLeads,
}: EvidenceDrawerProps) {
  return (
    <AnimatePresence>
      {contactId != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end bg-background/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-background border-l border-silicon-slate shadow-xl flex flex-col max-h-full"
          >
            <div className="p-4 border-b border-silicon-slate flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Value Evidence</h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : data ? (
                <>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Pain point evidence</h4>
                    {data.evidence.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No evidence yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.evidence.map((e) => (
                          <EvidenceCard key={e.id} evidence={e} />
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Value reports</h4>
                    {data.reports.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No reports yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.reports.map((r) => (
                          <li key={r.id}>
                            <Link
                              href={`/admin/value-evidence/reports/${r.id}`}
                              className="block p-2 rounded-lg bg-silicon-slate/50 border border-silicon-slate text-sm hover:bg-silicon-slate hover:border-white/20 transition-colors"
                              onClick={onClose}
                            >
                              <span className="text-white">{r.title ?? 'Report'}</span>
                              <span className="text-muted-foreground ml-2">
                                {r.total_annual_value != null ? `$${r.total_annual_value}` : ''} · {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {data.reports.length === 0 && contactId && (
                    <button
                      type="button"
                      onClick={async () => {
                        const session = await getCurrentSession()
                        if (!session || !contactId) return
                        const res = await fetch('/api/admin/value-evidence/reports/generate', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ contact_submission_id: contactId }),
                        })
                        if (res.ok) {
                          const r = await fetch(
                            `/api/admin/value-evidence/evidence?contact_id=${contactId}`,
                            { headers: { Authorization: `Bearer ${session.access_token}` } }
                          )
                          const d = await r.json()
                          if (r.ok) onDataChange(d)
                        }
                      }}
                      className="w-full px-4 py-2 btn-gold text-imperial-navy hover:opacity-90 rounded-lg font-medium text-sm"
                    >
                      Generate report
                    </button>
                  )}
                  {contactId && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onRefreshExtract(contactId)
                        const session = await getCurrentSession()
                        if (!session) return
                        const r = await fetch(
                          `/api/admin/value-evidence/evidence?contact_id=${contactId}`,
                          { headers: { Authorization: `Bearer ${session.access_token}` } }
                        )
                        const d = await r.json()
                        if (r.ok) onDataChange(d)
                      }}
                      className="w-full px-4 py-2 bg-silicon-slate/50 hover:bg-silicon-slate rounded-lg font-medium text-sm flex items-center justify-center gap-1"
                    >
                      <RefreshCw size={14} />
                      Refresh evidence
                    </button>
                  )}
                  {contactId && data && data.evidence.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Clear all evidence for this lead? This cannot be undone.')) return
                        const session = await getCurrentSession()
                        if (!session) return
                        const res = await fetch(
                          `/api/admin/value-evidence/evidence?contact_id=${contactId}`,
                          { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } }
                        )
                        if (res.ok) {
                          onDataChange({ evidence: [], reports: data.reports, totalEvidenceCount: 0 })
                          await fetchLeads()
                        }
                      }}
                      className="w-full px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-lg font-medium text-sm text-red-400 flex items-center justify-center gap-1"
                    >
                      <X size={14} />
                      Clear evidence
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Could not load evidence.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
