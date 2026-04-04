/**
 * Printable AI & Automation Audit PDF (email attachment + future download).
 * Uses @react-pdf/renderer — keep in sync with invoice-pdf branding where sensible.
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { DiagnosticAuditRecord } from '@/lib/diagnostic'
import { getIndustryDisplayName } from '@/lib/constants/industry'

const ATAS_DARK_BLUE = '#1a2d4a'
const ATAS_GOLD = '#C9A227'
const COMPANY_FULL_NAME = 'Amadutown Advisory Solutions'

export interface AuditReportPDFData {
  id: string
  completedAt: string | null
  businessName: string | null
  reportTierLabel: string
  industryLabel: string | null
  websiteUrl: string | null
  urgencyScore: number | null
  opportunityScore: number | null
  diagnosticSummary: string | null
  keyInsights: string[]
  /** Short bullet lines for detected tech (optional) */
  techLines: string[]
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 28,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ATAS_DARK_BLUE,
    marginLeft: -40,
    marginRight: -40,
    marginTop: -28,
    paddingHorizontal: 40,
    paddingVertical: 14,
    marginBottom: 20,
  },
  headerTitle: {
    color: ATAS_GOLD,
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  headerSub: {
    color: '#e8e8e8',
    fontSize: 9,
  },
  h2: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: ATAS_DARK_BLUE,
    marginBottom: 6,
    marginTop: 12,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.45,
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: '#444',
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 24,
    marginVertical: 8,
  },
  scoreBox: {
    borderWidth: 1,
    borderColor: ATAS_GOLD,
    borderRadius: 4,
    padding: 10,
    minWidth: 120,
  },
  scoreLabel: { fontSize: 8, color: '#555' },
  scoreVal: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ATAS_DARK_BLUE },
  bullet: { marginLeft: 10, marginBottom: 3 },
  footer: {
    marginTop: 24,
    fontSize: 8,
    color: '#666',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingTop: 8,
  },
})

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' })
  } catch {
    return iso
  }
}

function AuditReportDocument({ data }: { data: AuditReportPDFData }) {
  const title = data.businessName
    ? `${data.businessName} — AI & Automation Audit`
    : 'AI & Automation Audit'

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSub}>{COMPANY_FULL_NAME}</Text>
          </View>
          <Text style={styles.headerSub}>{data.reportTierLabel}</Text>
        </View>

        <Text style={styles.meta}>Report ID: {data.id}</Text>
        <Text style={styles.meta}>Completed: {formatWhen(data.completedAt)}</Text>
        {data.industryLabel ? (
          <Text style={styles.meta}>Industry: {data.industryLabel}</Text>
        ) : null}
        {data.websiteUrl ? <Text style={styles.meta}>Website: {data.websiteUrl}</Text> : null}

        {(data.urgencyScore != null || data.opportunityScore != null) && (
          <View style={styles.scoreRow}>
            {data.urgencyScore != null && (
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>Urgency</Text>
                <Text style={styles.scoreVal}>{data.urgencyScore}/10</Text>
              </View>
            )}
            {data.opportunityScore != null && (
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>Opportunity</Text>
                <Text style={styles.scoreVal}>{data.opportunityScore}/10</Text>
              </View>
            )}
          </View>
        )}

        {data.diagnosticSummary ? (
          <>
            <Text style={styles.h2}>Summary</Text>
            <Text style={styles.body}>{data.diagnosticSummary}</Text>
          </>
        ) : null}

        {data.keyInsights.length > 0 && (
          <>
            <Text style={styles.h2}>Key insights</Text>
            {data.keyInsights.map((line, i) => (
              <Text key={i} style={[styles.body, styles.bullet]}>
                • {line}
              </Text>
            ))}
          </>
        )}

        {data.techLines.length > 0 && (
          <>
            <Text style={styles.h2}>Tech stack highlights</Text>
            {data.techLines.map((line, i) => (
              <Text key={i} style={[styles.body, styles.bullet]}>
                • {line}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          This report summarizes your self-reported assessment and, when applicable, detected technologies.
          For questions, reply to the email that delivered this PDF or visit amadutown.com.
        </Text>
        <Text style={[styles.footer, { marginTop: 8 }]}>
          {COMPANY_FULL_NAME} · Confidential · {formatWhen(data.completedAt)}
        </Text>
      </Page>
    </Document>
  )
}

function tierLabel(tier: string | null | undefined): string {
  if (tier === 'platinum') return 'Strategy Package'
  if (tier === 'gold') return 'Full Analysis'
  if (tier === 'silver') return 'Smart Report'
  return 'Basic Report'
}

function buildTechLines(audit: DiagnosticAuditRecord): string[] {
  const lines: string[] = []
  const en = audit.enriched_tech_stack as Record<string, unknown> | null | undefined
  if (!en || typeof en !== 'object') return lines

  const byTag = en.byTag as Record<string, string[]> | undefined
  if (byTag && typeof byTag === 'object') {
    for (const [tag, tools] of Object.entries(byTag).slice(0, 10)) {
      if (Array.isArray(tools) && tools.length) {
        lines.push(`${tag}: ${tools.slice(0, 8).join(', ')}`)
      }
    }
  }

  if (lines.length === 0) {
    const techs = en.technologies as Array<{ name?: string }> | undefined
    if (Array.isArray(techs)) {
      for (const t of techs.slice(0, 20)) {
        if (t?.name) lines.push(t.name)
      }
    }
  }

  return lines.slice(0, 30)
}

/**
 * Map DB audit row to PDF payload (server-side).
 */
export function auditRecordToPdfData(audit: DiagnosticAuditRecord): AuditReportPDFData {
  const industryLabel = audit.industry_slug
    ? getIndustryDisplayName(audit.industry_slug)
    : null

  const insights = Array.isArray(audit.key_insights)
    ? audit.key_insights.filter((s): s is string => typeof s === 'string')
    : []

  return {
    id: String(audit.id),
    completedAt: audit.completed_at ?? null,
    businessName: audit.business_name ?? null,
    reportTierLabel: tierLabel(audit.report_tier),
    industryLabel,
    websiteUrl: audit.website_url ?? null,
    urgencyScore: audit.urgency_score ?? null,
    opportunityScore: audit.opportunity_score ?? null,
    diagnosticSummary: audit.diagnostic_summary ?? null,
    keyInsights: insights,
    techLines: buildTechLines(audit),
  }
}

export async function generateAuditReportPDFBuffer(data: AuditReportPDFData): Promise<Buffer> {
  const doc = <AuditReportDocument data={data} />
  const stream = await pdf(doc).toBuffer()
  const chunks: Uint8Array[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
