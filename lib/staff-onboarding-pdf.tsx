import React from 'react'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { PDF_BRAND, COMPANY_DISPLAY_NAME } from './pdf-brand-styles'
import { onboardingIntro, onboardingDefinition, onboardingReviewed, onboardingRoute, sections, evolution, systemFlow, stackMap } from './staff-onboarding'

const styles = StyleSheet.create({
  page: { ...PDF_BRAND.page, paddingBottom: 55, color: PDF_BRAND.colors.imperialNavy },
  company: { ...PDF_BRAND.companyName, fontSize: 13, color: PDF_BRAND.colors.bronze },
  title: { ...PDF_BRAND.documentTitle, fontSize: 22, marginBottom: 12 },
  section: { ...PDF_BRAND.sectionTitle, marginTop: 18 },
  heading: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  body: { ...PDF_BRAND.bodyText, marginBottom: 10 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: PDF_BRAND.colors.siliconSlate },
  block: { marginBottom: 8 },
})

export function StaffOnboardingDocument() {
  return <Document title="AmaduTown staff onboarding" author={COMPANY_DISPLAY_NAME}>
    <Page size="A4" style={styles.page}>
      <Text style={styles.company}>{COMPANY_DISPLAY_NAME}</Text>
      <Text style={styles.title}>Welcome to your workspace</Text>
      <Text style={styles.body}>{onboardingIntro}</Text>
      <Text style={styles.body}>{onboardingDefinition}</Text>
      <Text style={styles.body}>Start with your onboarding owner: confirm your account, assigned workspace, and who approves your work. This guide grants no new permissions.</Text>
      <Text style={styles.body}>Open Portfolio at {onboardingRoute}. Reviewed {onboardingReviewed}. Tool roles reflect repository evidence, not live account or provider readiness.</Text>
      <Text style={styles.section}>The work, in three layers</Text>
      {evolution.map((item, index) => <View key={item.title} style={styles.block} wrap={false}><Text style={styles.heading}>{index + 1}. {item.title}</Text><Text style={styles.body}>{item.text}</Text></View>)}
      <Text style={styles.section}>Follow one request</Text>
      {systemFlow.map(item => <View key={item.title} style={styles.block} wrap={false}><Text style={styles.heading}>{item.title}</Text><Text style={styles.body}>{item.text}</Text></View>)}
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `AmaduTown · Staff onboarding · ${pageNumber} / ${totalPages}`} />
    </Page>
    {sections.map(section => <Page key={section.id} size="A4" style={styles.page}>
      <Text style={styles.company}>{COMPANY_DISPLAY_NAME}</Text>
      <Text style={styles.title}>{section.title}</Text>
      <Text style={styles.body}>{section.summary}</Text>
      {section.id === 'workspace' && stackMap.map(item => <View key={item.title} style={styles.block} wrap={false}><Text style={styles.heading}>{item.title}</Text><Text style={styles.body}>{item.text.replaceAll('→', '>').replaceAll('↔', '<>')}</Text></View>)}
      {section.blocks.map(item => <View key={item.title} style={styles.block} wrap={false}><Text style={styles.heading}>{section.id === 'week' ? '[  ] ' : ''}{item.title}</Text><Text style={styles.body}>{item.text}</Text></View>)}
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `AmaduTown · Staff onboarding · ${pageNumber} / ${totalPages}`} />
    </Page>)}
  </Document>
}

export async function generateStaffOnboardingPDFBlob(): Promise<Blob> {
  return pdf(<StaffOnboardingDocument />).toBlob()
}
