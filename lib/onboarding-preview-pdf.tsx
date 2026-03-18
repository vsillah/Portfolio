/**
 * Onboarding Preview PDF — "What Happens After You Sign"
 *
 * A 1-2 page summary generated from AI-produced onboarding content,
 * using shared AmaduTown brand styles.
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import { PDF_BRAND, COMPANY_DISPLAY_NAME } from '@/lib/pdf-brand-styles'
import type { AIOnboardingContent } from '@/lib/ai-onboarding-generator'

export interface OnboardingPreviewPDFData {
  client_name: string
  client_company?: string | null
  bundle_name?: string
  content: AIOnboardingContent
}

const styles = StyleSheet.create({
  page: {
    padding: PDF_BRAND.page.padding,
    fontSize: PDF_BRAND.page.fontSize,
    fontFamily: PDF_BRAND.page.fontFamily,
  },
  header: {
    marginBottom: PDF_BRAND.header.marginBottom,
  },
  companyName: PDF_BRAND.companyName,
  documentTitle: PDF_BRAND.documentTitle,
  documentSubtitle: PDF_BRAND.documentSubtitle,
  thickDivider: PDF_BRAND.thickDivider,
  divider: PDF_BRAND.divider,
  sectionTitle: PDF_BRAND.sectionTitle,
  bodyText: PDF_BRAND.bodyText,
  bodyTextMuted: PDF_BRAND.bodyTextMuted,
  bulletItem: {
    flexDirection: 'row' as const,
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 12,
    fontSize: 10,
    color: PDF_BRAND.colors.radiantGold,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: '#121E31',
    lineHeight: 1.4,
  },
  clientActionBadge: {
    fontSize: 7,
    color: PDF_BRAND.colors.radiantGold,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    marginLeft: 4,
  },
  milestoneRow: {
    flexDirection: 'row' as const,
    marginBottom: 6,
    paddingLeft: 4,
  },
  milestoneWeek: {
    width: 50,
    fontSize: 9,
    fontWeight: 'bold' as const,
    color: PDF_BRAND.colors.radiantGold,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 10,
    fontWeight: 'bold' as const,
    color: '#121E31',
    marginBottom: 1,
  },
  milestoneDesc: {
    fontSize: 9,
    color: PDF_BRAND.colors.siliconSlate,
    lineHeight: 1.3,
  },
  tagRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 4,
  },
  tag: {
    fontSize: 8,
    color: PDF_BRAND.colors.siliconSlate,
    backgroundColor: '#EAECEE',
    padding: '2 6',
    borderRadius: 3,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center' as const,
    fontSize: 8,
    color: PDF_BRAND.colors.siliconSlate,
    fontStyle: 'italic' as const,
  },
  section: {
    marginBottom: 14,
  },
})

const OnboardingPreviewDocument: React.FC<{ data: OnboardingPreviewPDFData }> = ({ data }) => {
  const clientLabel = data.client_company
    ? `${data.client_name}, ${data.client_company}`
    : data.client_name
  const { content } = data

  return (
    <Document title={`Onboarding Preview — ${clientLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{COMPANY_DISPLAY_NAME}</Text>
          <Text style={styles.documentTitle}>What Happens After You Sign</Text>
          <Text style={styles.documentSubtitle}>
            Onboarding Preview for {clientLabel}
            {data.bundle_name ? ` — ${data.bundle_name}` : ''}
          </Text>
        </View>
        <View style={styles.thickDivider} />

        {/* Setup & Access Requirements */}
        {content.setup_requirements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup &amp; Access Requirements</Text>
            {content.setup_requirements.map((req, i) => (
              <View key={i} style={styles.bulletItem}>
                <Text style={styles.bulletDot}>{req.is_client_action ? '▸' : '•'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bulletText}>
                    <Text style={{ fontWeight: 'bold' }}>{req.title}</Text>
                    {req.is_client_action && (
                      <Text style={styles.clientActionBadge}> (CLIENT ACTION)</Text>
                    )}
                  </Text>
                  <Text style={styles.bodyTextMuted}>{req.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Project Timeline */}
        {content.milestones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Timeline</Text>
            {content.milestones.map((ms, i) => (
              <View key={i} style={styles.milestoneRow}>
                <Text style={styles.milestoneWeek}>
                  {typeof ms.week === 'number' ? `Wk ${ms.week}` : `Wk ${ms.week}`}
                </Text>
                <View style={styles.milestoneContent}>
                  <Text style={styles.milestoneTitle}>{ms.title}</Text>
                  <Text style={styles.milestoneDesc}>{ms.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tools & Platforms */}
        {content.tools_and_platforms.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tools &amp; Platforms</Text>
            <View style={styles.tagRow}>
              {content.tools_and_platforms.map((tool, i) => (
                <Text key={i} style={styles.tag}>{tool}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Client Actions */}
        {content.client_actions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What We Need From You</Text>
            {content.client_actions.map((action, i) => (
              <View key={i} style={styles.bulletItem}>
                <Text style={styles.bulletDot}>▸</Text>
                <Text style={styles.bulletText}>{action}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text style={styles.bodyTextMuted}>
          A comprehensive Client Onboarding Plan with detailed milestones, communication cadence,
          win conditions, warranty terms, and artifact handoff will be provided after contract signing.
        </Text>

        <Text style={styles.footer}>
          Onboarding Preview — Confidential — {COMPANY_DISPLAY_NAME}
        </Text>
      </Page>
    </Document>
  )
}

export async function generateOnboardingPreviewPDF(
  data: OnboardingPreviewPDFData
): Promise<Buffer> {
  const doc = <OnboardingPreviewDocument data={data} />
  const result = await pdf(doc).toBuffer()
  if (Buffer.isBuffer(result)) return result
  const chunks: Uint8Array[] = []
  const reader = (result as unknown as ReadableStream<Uint8Array>).getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}
