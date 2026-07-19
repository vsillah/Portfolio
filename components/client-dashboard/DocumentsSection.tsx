'use client'

import { FileText, Download, ClipboardList, ExternalLink } from 'lucide-react'
import type { DashboardDocument } from '@/lib/client-dashboard'

interface DocumentsSectionProps {
  documents: DashboardDocument[]
}

const typeConfig: Record<
  DashboardDocument['type'],
  { icon: typeof FileText; label: string; accent: string; bg: string }
> = {
  proposal: {
    icon: FileText,
    label: 'Proposal',
    accent: 'text-radiant-gold',
    bg: 'bg-radiant-gold/10 border-radiant-gold/20',
  },
  contract: {
    icon: FileText,
    label: 'Contract',
    accent: 'text-gold-light',
    bg: 'bg-bronze/15 border-bronze/30',
  },
  onboarding_plan: {
    icon: ClipboardList,
    label: 'Onboarding Plan',
    accent: 'text-gold-light',
    bg: 'bg-silicon-slate/60 border-radiant-gold/15',
  },
  strategy_report: {
    icon: FileText,
    label: 'Strategy Report',
    accent: 'text-radiant-gold',
    bg: 'bg-silicon-slate/60 border-radiant-gold/15',
  },
  opportunity_quantification: {
    icon: FileText,
    label: 'Opportunity Quantification',
    accent: 'text-gold-light',
    bg: 'bg-bronze/15 border-bronze/30',
  },
  proposal_package: {
    icon: FileText,
    label: 'Proposal Package',
    accent: 'text-radiant-gold',
    bg: 'bg-radiant-gold/10 border-radiant-gold/20',
  },
  onboarding_preview: {
    icon: ClipboardList,
    label: 'Onboarding Preview',
    accent: 'text-gold-light',
    bg: 'bg-silicon-slate/60 border-radiant-gold/15',
  },
  other: {
    icon: FileText,
    label: 'Document',
    accent: 'text-platinum-white/70',
    bg: 'bg-silicon-slate/50 border-platinum-white/10',
  },
}

export default function DocumentsSection({ documents }: DocumentsSectionProps) {
  if (!documents || documents.length === 0) return null

  return (
    <div id="documents" className="rounded-lg border border-radiant-gold/20 bg-silicon-slate/35 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
      <h3 className="text-sm font-medium text-radiant-gold uppercase tracking-wider mb-4">
        Documents &amp; Proposals
      </h3>
      <div className="space-y-3">
        {documents.map((doc) => {
          const config = typeConfig[doc.type] ?? typeConfig.proposal
          const Icon = config.icon
          const downloadUrl = doc.signed_url || doc.pdf_url

          return (
            <div
              key={`${doc.type}-${doc.id}`}
              className="flex items-center justify-between p-3 rounded-lg bg-imperial-navy/55 border border-radiant-gold/10"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg border ${config.bg}`}>
                  <Icon className={`w-4 h-4 ${config.accent}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-platinum-white truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-platinum-white/50">
                    {config.label} &middot;{' '}
                    {new Date(doc.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-imperial-navy bg-radiant-gold hover:bg-gold-light rounded-lg transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </a>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-platinum-white/45 shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Pending
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
