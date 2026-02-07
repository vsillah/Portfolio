/**
 * Onboarding Plan PDF Generator
 * Uses @react-pdf/renderer to generate branded onboarding plan documents.
 * Follows the same pattern as lib/proposal-pdf.tsx.
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
import type {
  SetupRequirement,
  Milestone,
  CommunicationPlan,
  MeetingSchedule,
  WinCondition,
  WarrantyTerms,
  ArtifactHandoff,
} from './onboarding-templates'

// ============================================================================
// Types
// ============================================================================

export interface OnboardingPlanPDFData {
  id: string
  client_name: string
  client_email: string
  client_company?: string
  project_name: string
  template_name: string
  created_at: string
  project_start_date?: string
  estimated_end_date?: string
  setup_requirements: SetupRequirement[]
  milestones: Milestone[]
  communication_plan: CommunicationPlan
  win_conditions: WinCondition[]
  warranty: WarrantyTerms
  artifacts_handoff: ArtifactHandoff[]
  company_name?: string
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  // Header
  header: {
    marginBottom: 24,
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 6,
  },
  documentSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  planId: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 4,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  thickDivider: {
    height: 2,
    backgroundColor: '#2563eb',
    marginVertical: 16,
  },
  // Client info
  clientInfoBox: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 4,
    marginBottom: 20,
  },
  clientName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  clientDetail: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
  // Sections
  section: {
    marginBottom: 18,
  },
  sectionNumber: {
    fontSize: 9,
    color: '#2563eb',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 10,
    lineHeight: 1.4,
  },
  // Checklist items (setup requirements)
  checklistItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 4,
  },
  checkboxIcon: {
    width: 14,
    fontSize: 10,
    color: '#9ca3af',
    marginRight: 8,
    marginTop: 1,
  },
  checklistContent: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  checklistDescription: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.3,
  },
  checklistBadge: {
    fontSize: 8,
    color: '#2563eb',
    marginTop: 2,
  },
  // Milestone timeline
  milestoneRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  milestoneWeek: {
    width: 60,
    paddingRight: 10,
  },
  milestoneWeekText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  milestoneDateText: {
    fontSize: 8,
    color: '#9ca3af',
    marginTop: 2,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  milestoneDescription: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.3,
    marginBottom: 3,
  },
  milestoneDeliverables: {
    fontSize: 8,
    color: '#4b5563',
    marginLeft: 8,
    marginTop: 1,
  },
  // Communication plan
  meetingRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  meetingType: {
    width: 140,
    fontSize: 10,
    fontWeight: 'bold',
  },
  meetingFrequency: {
    width: 80,
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
  },
  meetingDuration: {
    width: 60,
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
  },
  meetingDescription: {
    flex: 1,
    fontSize: 8,
    color: '#6b7280',
  },
  commDetail: {
    fontSize: 9,
    color: '#4b5563',
    marginTop: 4,
    lineHeight: 1.4,
  },
  // Table header
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  // Win conditions
  winConditionRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  winMetric: {
    width: 120,
    fontSize: 10,
    fontWeight: 'bold',
  },
  winTarget: {
    flex: 1,
    fontSize: 9,
    color: '#4b5563',
  },
  winTimeframe: {
    width: 100,
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'right',
  },
  // Warranty
  warrantyBox: {
    backgroundColor: '#f0f9ff',
    padding: 14,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  warrantyTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 6,
  },
  warrantyText: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
    marginBottom: 4,
  },
  warrantyExclusion: {
    fontSize: 8,
    color: '#6b7280',
    marginLeft: 12,
    marginBottom: 2,
  },
  // Artifacts
  artifactRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  artifactName: {
    width: 160,
    fontSize: 10,
    fontWeight: 'bold',
  },
  artifactFormat: {
    width: 80,
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
  },
  artifactDescription: {
    flex: 1,
    fontSize: 8,
    color: '#6b7280',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
  // Label
  label: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 2,
  },
})

// ============================================================================
// Helper functions
// ============================================================================

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatShortDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// PDF Document Component
// ============================================================================

export const OnboardingPlanDocument: React.FC<{ data: OnboardingPlanPDFData }> = ({ data }) => {
  const hasWarranty = data.warranty && data.warranty.duration_months > 0

  return (
    <Document>
      {/* Page 1: Header + Client Info + Setup Requirements */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.company_name || 'ATAS'}</Text>
          <Text style={styles.documentTitle}>Client Onboarding Plan</Text>
          <Text style={styles.documentSubtitle}>{data.project_name}</Text>
          <Text style={styles.planId}>
            Plan #{data.id.slice(0, 8).toUpperCase()} | Created: {formatDate(data.created_at)}
          </Text>
        </View>

        <View style={styles.thickDivider} />

        {/* Client Information */}
        <View style={styles.clientInfoBox}>
          <Text style={styles.clientName}>{data.client_name}</Text>
          {data.client_company && (
            <Text style={styles.clientDetail}>{data.client_company}</Text>
          )}
          <Text style={styles.clientDetail}>{data.client_email}</Text>
          {data.project_start_date && (
            <Text style={styles.clientDetail}>
              Estimated Start: {formatDate(data.project_start_date)}
            </Text>
          )}
          {data.estimated_end_date && (
            <Text style={styles.clientDetail}>
              Estimated Completion: {formatDate(data.estimated_end_date)}
            </Text>
          )}
        </View>

        {/* Section 1: Setup & Access Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionNumber}>SECTION 1</Text>
          <Text style={styles.sectionTitle}>Initial Setup & Access Requirements</Text>
          <Text style={styles.sectionDescription}>
            The following items need to be completed before the project can begin.
            Items marked as &quot;Client Action&quot; require your input.
          </Text>

          {data.setup_requirements.map((req, index) => (
            <View key={index} style={styles.checklistItem}>
              <Text style={styles.checkboxIcon}>{'\u2610'}</Text>
              <View style={styles.checklistContent}>
                <Text style={styles.checklistTitle}>{req.title}</Text>
                <Text style={styles.checklistDescription}>{req.description}</Text>
                {req.is_client_action && (
                  <Text style={styles.checklistBadge}>Client Action Required</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Confidential | {data.company_name || 'ATAS'} | Client Onboarding Plan
        </Text>
      </Page>

      {/* Page 2: Milestones */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionNumber}>SECTION 2</Text>
          <Text style={styles.sectionTitle}>Expected Milestones</Text>
          <Text style={styles.sectionDescription}>
            Below is the project timeline with key milestones and deliverables for each phase.
          </Text>

          {data.milestones.map((milestone, index) => (
            <View key={index} style={styles.milestoneRow}>
              <View style={styles.milestoneWeek}>
                <Text style={styles.milestoneWeekText}>
                  {typeof milestone.week === 'number' ? `Week ${milestone.week}` : `Wk ${milestone.week}`}
                </Text>
                {milestone.target_date && (
                  <Text style={styles.milestoneDateText}>
                    {formatShortDate(milestone.target_date)}
                  </Text>
                )}
              </View>
              <View style={styles.milestoneContent}>
                <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                {milestone.deliverables && milestone.deliverables.length > 0 && (
                  <>
                    {milestone.deliverables.map((d, di) => (
                      <Text key={di} style={styles.milestoneDeliverables}>
                        {'\u2022'} {d}
                      </Text>
                    ))}
                  </>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Confidential | {data.company_name || 'ATAS'} | Client Onboarding Plan
        </Text>
      </Page>

      {/* Page 3: Communication Plan + Win Conditions */}
      <Page size="A4" style={styles.page}>
        {/* Section 3: Communication Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionNumber}>SECTION 3</Text>
          <Text style={styles.sectionTitle}>Communication Plan</Text>

          <Text style={styles.label}>Meeting Schedule</Text>

          {/* Meeting table header */}
          <View style={styles.tableHeader}>
            <View style={{ width: 140 }}>
              <Text style={styles.tableHeaderText}>Meeting Type</Text>
            </View>
            <View style={{ width: 80 }}>
              <Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Frequency</Text>
            </View>
            <View style={{ width: 60 }}>
              <Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Duration</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
          </View>

          {data.communication_plan.meetings && data.communication_plan.meetings.map((meeting: MeetingSchedule, index: number) => (
            <View key={index} style={styles.meetingRow}>
              <Text style={styles.meetingType}>{meeting.type}</Text>
              <Text style={styles.meetingFrequency}>{meeting.frequency}</Text>
              <Text style={styles.meetingDuration}>{meeting.duration_minutes}min</Text>
              <Text style={styles.meetingDescription}>{meeting.description}</Text>
            </View>
          ))}

          <Text style={styles.commDetail}>
            Channels: {data.communication_plan.channels?.join(', ') || 'Email'}
          </Text>
          <Text style={styles.commDetail}>
            Escalation: {data.communication_plan.escalation_path || 'Contact your project lead'}
          </Text>
          {data.communication_plan.ad_hoc && (
            <Text style={styles.commDetail}>
              Ad-hoc: {data.communication_plan.ad_hoc}
            </Text>
          )}
        </View>

        <View style={styles.divider} />

        {/* Section 4: Win Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionNumber}>SECTION 4</Text>
          <Text style={styles.sectionTitle}>Win Conditions</Text>
          <Text style={styles.sectionDescription}>
            Success metrics that define a successful engagement outcome.
          </Text>

          {/* Win conditions table header */}
          <View style={styles.tableHeader}>
            <View style={{ width: 120 }}>
              <Text style={styles.tableHeaderText}>Metric</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tableHeaderText}>Target</Text>
            </View>
            <View style={{ width: 100 }}>
              <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>Timeframe</Text>
            </View>
          </View>

          {data.win_conditions.map((wc, index) => (
            <View key={index} style={styles.winConditionRow}>
              <Text style={styles.winMetric}>{wc.metric}</Text>
              <Text style={styles.winTarget}>{wc.target}</Text>
              <Text style={styles.winTimeframe}>{wc.timeframe}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Confidential | {data.company_name || 'ATAS'} | Client Onboarding Plan
        </Text>
      </Page>

      {/* Page 4: Warranty + Artifacts Handoff */}
      <Page size="A4" style={styles.page}>
        {/* Section 5: Warranty Period */}
        {hasWarranty && (
          <View style={styles.section}>
            <Text style={styles.sectionNumber}>SECTION 5</Text>
            <Text style={styles.sectionTitle}>Warranty Period</Text>

            <View style={styles.warrantyBox}>
              <Text style={styles.warrantyTitle}>
                {data.warranty.duration_months}-Month Warranty
              </Text>
              <Text style={styles.warrantyText}>
                {data.warranty.coverage_description}
              </Text>

              {data.warranty.exclusions && data.warranty.exclusions.length > 0 && (
                <>
                  <Text style={[styles.warrantyText, { fontWeight: 'bold', marginTop: 6 }]}>
                    Exclusions:
                  </Text>
                  {data.warranty.exclusions.map((exc, index) => (
                    <Text key={index} style={styles.warrantyExclusion}>
                      {'\u2022'} {exc}
                    </Text>
                  ))}
                </>
              )}

              {data.warranty.extended_support_available && (
                <Text style={[styles.warrantyText, { marginTop: 6 }]}>
                  Extended Support: {data.warranty.extended_support_description}
                </Text>
              )}
            </View>
          </View>
        )}

        {!hasWarranty && (
          <View style={styles.section}>
            <Text style={styles.sectionNumber}>SECTION 5</Text>
            <Text style={styles.sectionTitle}>Support</Text>
            <Text style={styles.sectionDescription}>
              {data.warranty.coverage_description || 'Support is included as part of this engagement.'}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Section 6: Artifacts Handoff */}
        <View style={styles.section}>
          <Text style={styles.sectionNumber}>SECTION 6</Text>
          <Text style={styles.sectionTitle}>Artifacts Handoff</Text>
          <Text style={styles.sectionDescription}>
            The following deliverables will be handed off during and after the engagement.
          </Text>

          {/* Artifacts table header */}
          <View style={styles.tableHeader}>
            <View style={{ width: 160 }}>
              <Text style={styles.tableHeaderText}>Artifact</Text>
            </View>
            <View style={{ width: 80 }}>
              <Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>Format</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tableHeaderText}>Description</Text>
            </View>
          </View>

          {data.artifacts_handoff.map((artifact, index) => (
            <View key={index} style={styles.artifactRow}>
              <Text style={styles.artifactName}>{artifact.artifact}</Text>
              <Text style={styles.artifactFormat}>{artifact.format}</Text>
              <Text style={styles.artifactDescription}>{artifact.description}</Text>
            </View>
          ))}
        </View>

        {/* Closing note */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <View style={styles.divider} />
          <Text style={[styles.sectionDescription, { textAlign: 'center', marginTop: 10 }]}>
            This onboarding plan outlines a clear roadmap from initial setup to project delivery,
            ensuring both parties have a clear understanding of each phase and expected outcomes.
            Questions? Contact us at your convenience.
          </Text>
        </View>

        <Text style={styles.footer}>
          Confidential | {data.company_name || 'ATAS'} | Client Onboarding Plan
        </Text>
      </Page>
    </Document>
  )
}

// ============================================================================
// PDF Generation Functions
// ============================================================================

/**
 * Generate onboarding plan PDF as a Buffer (server-side).
 */
export async function generateOnboardingPlanPDF(
  data: OnboardingPlanPDFData
): Promise<Buffer> {
  const pdfDoc = <OnboardingPlanDocument data={data} />
  const pdfBuffer = await pdf(pdfDoc).toBuffer()

  // Handle both Buffer and ReadableStream return types
  if (Buffer.isBuffer(pdfBuffer)) {
    return pdfBuffer
  }

  // Convert ReadableStream to Buffer
  const chunks: Uint8Array[] = []
  const reader = (pdfBuffer as unknown as ReadableStream<Uint8Array>).getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/**
 * Generate onboarding plan PDF as a Blob (client-side).
 */
export async function generateOnboardingPlanPDFBlob(
  data: OnboardingPlanPDFData
): Promise<Blob> {
  const pdfDoc = <OnboardingPlanDocument data={data} />
  const blob = await pdf(pdfDoc).toBlob()
  return blob
}
