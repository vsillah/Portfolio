'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, X, ExternalLink, Presentation } from 'lucide-react'

interface ReportActionToastProps {
  contactName: string
  company?: string
  totalAnnualValue: number
  reportId: string
  contactId: number
  onDismiss: () => void
}

export default function ReportActionToast({
  contactName,
  company,
  totalAnnualValue,
  reportId,
  contactId,
  onDismiss,
}: ReportActionToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 30000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  if (!visible) return null

  const gammaDeepLink = `/admin/reports/gamma?type=value_quantification&contactId=${contactId}&valueReportId=${reportId}`
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(totalAnnualValue)

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 border-t border-emerald-500/30 backdrop-blur-sm px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              Value report generated for {contactName}
              {company ? ` (${company})` : ''}
            </p>
            <p className="text-xs text-gray-400">
              Annual cost of inaction: {formatted}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/admin/value-evidence/reports/${reportId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-silicon-slate/80 border border-silicon-slate rounded-lg text-sm text-platinum-white hover:bg-silicon-slate transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Report
          </Link>
          <Link
            href={gammaDeepLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
          >
            <Presentation className="w-3.5 h-3.5" />
            Generate Gamma Deck
          </Link>
          <button
            onClick={() => {
              setVisible(false)
              onDismiss()
            }}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
