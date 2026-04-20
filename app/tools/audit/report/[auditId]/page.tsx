'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuth } from '@/components/AuthProvider'
import { AuditEmailPdfButton, AuditEmailPdfSignInCta } from '@/components/audit/AuditEmailPdfButton'
import SiteThemeCorner from '@/components/SiteThemeCorner'
import AuditReportView from '@/components/audits/AuditReportView'
import type { AuditReportViewModel } from '@/lib/audit-report-view'

export default function AuditReportPage() {
  const params = useParams()
  const auditId = params.auditId as string
  const { user } = useAuth()
  const [report, setReport] = useState<AuditReportViewModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auditId) return
    fetch(`/api/chat/diagnostic?auditId=${encodeURIComponent(auditId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.audit) {
          setReport(data.audit as AuditReportViewModel)
        } else {
          setError('Report not found')
        }
      })
      .catch(() => setError('Failed to load report'))
      .finally(() => setLoading(false))
  }, [auditId])

  if (loading) {
    return (
      <>
        <SiteThemeCorner />
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-2 border-radiant-gold border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground text-sm">Loading your report...</p>
          </div>
        </div>
      </>
    )
  }

  if (error || !report) {
    return (
      <>
        <SiteThemeCorner />
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">{error || 'Report not found'}</p>
            <Link href="/tools/audit" className="text-radiant-gold hover:underline">
              Start a new audit
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteThemeCorner />
      <div className="min-h-screen bg-background text-foreground pt-12 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <AuditReportView
              report={report}
              headerVariant="permalink"
              footerSlot={
                <div className="space-y-6">
                  <div className="rounded-lg border border-border bg-black/15 p-4">
                    <p className="text-sm font-medium text-foreground/90 mb-3">Printable PDF</p>
                    {user ? (
                      <AuditEmailPdfButton auditId={String(report.id)} tone="dark" />
                    ) : (
                      <AuditEmailPdfSignInCta auditId={auditId} />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/tools/audit"
                      className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90"
                    >
                      Start a new audit
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex items-center px-6 py-3 rounded-lg border border-radiant-gold/40 text-foreground hover:bg-radiant-gold/10"
                    >
                      Back to home
                    </Link>
                  </div>
                </div>
              }
            />
          </motion.div>
        </div>
      </div>
    </>
  )
}
