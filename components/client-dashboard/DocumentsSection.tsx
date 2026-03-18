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
    accent: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  contract: {
    icon: FileText,
    label: 'Contract',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  onboarding_plan: {
    icon: ClipboardList,
    label: 'Onboarding Plan',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  strategy_report: {
    icon: FileText,
    label: 'Strategy Report',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  opportunity_quantification: {
    icon: FileText,
    label: 'Opportunity Quantification',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  proposal_package: {
    icon: FileText,
    label: 'Proposal Package',
    accent: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
  onboarding_preview: {
    icon: ClipboardList,
    label: 'Onboarding Preview',
    accent: 'text-teal-400',
    bg: 'bg-teal-500/10',
  },
  other: {
    icon: FileText,
    label: 'Document',
    accent: 'text-gray-400',
    bg: 'bg-gray-500/10',
  },
}

export default function DocumentsSection({ documents }: DocumentsSectionProps) {
  if (!documents || documents.length === 0) return null

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
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
              className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg ${config.bg}`}>
                  <Icon className={`w-4 h-4 ${config.accent}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-gray-500">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </a>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 shrink-0">
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
