// Proposal PDF Generator
// Uses @react-pdf/renderer to generate professional proposal documents
// 
// NOTE: Install the package: npm install @react-pdf/renderer

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer';

// Register default font (optional: can add custom fonts)
// Font.register({
//   family: 'Inter',
//   src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
// });

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 30,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  proposalTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  proposalNumber: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientInfo: {
    backgroundColor: '#f9fafb',
    padding: 15,
    borderRadius: 4,
  },
  clientName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  clientDetail: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  bundleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bundleDescription: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 15,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableColItem: {
    flex: 3,
  },
  tableColRole: {
    flex: 1,
    textAlign: 'center',
  },
  tableColValue: {
    flex: 1,
    textAlign: 'right',
  },
  tableColPrice: {
    flex: 1,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 9,
    color: '#6b7280',
  },
  itemRole: {
    fontSize: 9,
    color: '#6b7280',
  },
  itemValue: {
    fontSize: 9,
    color: '#9ca3af',
    textDecoration: 'line-through',
  },
  itemPrice: {
    fontSize: 11,
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  totalLabel: {
    width: 120,
    textAlign: 'right',
    paddingRight: 15,
    color: '#6b7280',
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  savings: {
    fontSize: 10,
    color: '#10b981',
  },
  termsSection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  termsText: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  validityNote: {
    marginTop: 20,
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#9ca3af',
  },
  acceptSection: {
    marginTop: 40,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
  },
  acceptTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  signatureLine: {
    marginTop: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    width: 200,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 5,
  },
  // Value Assessment styles
  vaPage: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  vaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  vaBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: '#ecfdf5',
    padding: '4 8',
    borderRadius: 3,
  },
  vaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 6,
  },
  vaSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 1.6,
  },
  vaStatRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  vaStatCard: {
    flex: 1,
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  vaStatLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vaStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
  },
  vaStatNote: {
    fontSize: 8,
    color: '#059669',
    marginTop: 2,
  },
  vaPainPointHeader: {
    flexDirection: 'row',
    backgroundColor: '#065f46',
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  vaPainPointHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  vaPainPointRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  vaPainPointRowAlt: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  vaPpColName: {
    flex: 3,
  },
  vaPpColMethod: {
    flex: 2,
    textAlign: 'center',
  },
  vaPpColValue: {
    flex: 1.5,
    textAlign: 'right',
  },
  vaPpColConfidence: {
    flex: 1,
    textAlign: 'center',
  },
  vaPpName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  vaPpFormula: {
    fontSize: 8,
    color: '#6b7280',
    marginTop: 2,
  },
  vaPpMethod: {
    fontSize: 9,
    color: '#6b7280',
  },
  vaPpValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#065f46',
  },
  vaPpConfHigh: {
    fontSize: 8,
    color: '#059669',
    backgroundColor: '#ecfdf5',
    padding: '2 6',
    borderRadius: 3,
    textAlign: 'center',
  },
  vaPpConfMedium: {
    fontSize: 8,
    color: '#d97706',
    backgroundColor: '#fffbeb',
    padding: '2 6',
    borderRadius: 3,
    textAlign: 'center',
  },
  vaPpConfLow: {
    fontSize: 8,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '2 6',
    borderRadius: 3,
    textAlign: 'center',
  },
  vaTotalRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#065f46',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  vaTotalLabel: {
    flex: 5,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  vaTotalValue: {
    flex: 2.5,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'right',
  },
  vaBridge: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
  },
  vaBridgeText: {
    fontSize: 11,
    color: '#065f46',
    lineHeight: 1.6,
  },
  vaBridgeBold: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#065f46',
  },
  vaDisclaimer: {
    marginTop: 16,
    fontSize: 8,
    color: '#9ca3af',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
  vaFooter: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#9ca3af',
  },
});

// Types
export interface ProposalValueStatement {
  painPoint: string;
  painPointId?: string;
  annualValue: number;
  calculationMethod: string;
  formulaReadable: string;
  evidenceSummary: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ProposalValueAssessment {
  totalAnnualValue: number;
  industry: string;
  companySizeRange: string;
  valueStatements: ProposalValueStatement[];
  roi?: number;
  roiStatement?: string;
}

export interface ProposalLineItem {
  content_type: string;
  content_id: string;
  title: string;
  description?: string;
  offer_role?: string;
  price: number;
  perceived_value?: number;
}

export interface ProposalData {
  id: string;
  proposalNumber?: string;
  client_name: string;
  client_email: string;
  client_company?: string;
  bundle_name: string;
  bundle_description?: string;
  line_items: ProposalLineItem[];
  subtotal: number;
  discount_amount?: number;
  discount_description?: string;
  total_amount: number;
  terms_text?: string;
  valid_until?: string;
  created_at: string;
  company_name?: string;
  value_assessment?: ProposalValueAssessment;
}

// Role display labels
const ROLE_LABELS: Record<string, string> = {
  core_offer: 'Core',
  bonus: 'Bonus',
  upsell: 'Add-on',
  downsell: 'Alt',
  anchor: 'Reference',
  decoy: 'Compare',
  lead_magnet: 'Free',
  continuity: 'Ongoing',
};

// Calculation method display labels
const CALC_METHOD_LABELS: Record<string, string> = {
  time_saved: 'Time Savings',
  error_reduction: 'Error Reduction',
  revenue_acceleration: 'Revenue Acceleration',
  opportunity_cost: 'Opportunity Cost',
  replacement_cost: 'Replacement Cost',
};

const CONFIDENCE_DISPLAY: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Format currency short (no decimals)
const formatCurrencyShort = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ============================================================================
// Value Assessment PDF Page
// ============================================================================

const ValueAssessmentPage: React.FC<{
  assessment: ProposalValueAssessment;
  totalAmount: number;
  clientCompany?: string;
}> = ({ assessment, totalAmount, clientCompany }) => {
  const companyRef = clientCompany || 'your business';
  const roi = assessment.roi ?? (
    totalAmount > 0 ? Math.round((assessment.totalAnnualValue / totalAmount) * 10) / 10 : 0
  );
  const roiStatement = assessment.roiStatement ?? (
    `For every $1 invested, ${companyRef} stands to recover $${roi.toFixed(1)} in annual value.`
  );
  const monthlyCost = assessment.totalAnnualValue / 12;

  return (
    <Page size="A4" style={styles.vaPage}>
      {/* Badge */}
      <View style={styles.vaBadge}>
        <Text style={styles.vaBadgeText}>Value Assessment</Text>
      </View>

      {/* Title */}
      <Text style={styles.vaTitle}>Why This Matters</Text>
      <Text style={styles.vaSubtitle}>
        Based on our analysis of businesses in {assessment.industry || 'your industry'} with{' '}
        {assessment.companySizeRange || '11-50'} employees, we have identified{' '}
        {assessment.valueStatements.length} area{assessment.valueStatements.length !== 1 ? 's' : ''}{' '}
        where {companyRef} may be losing an estimated{' '}
        {formatCurrencyShort(assessment.totalAnnualValue)} per year to operational inefficiencies
        and missed opportunities.
      </Text>

      {/* Stat Cards */}
      <View style={styles.vaStatRow}>
        <View style={styles.vaStatCard}>
          <Text style={styles.vaStatLabel}>Annual Cost of Inaction</Text>
          <Text style={styles.vaStatValue}>{formatCurrencyShort(assessment.totalAnnualValue)}</Text>
          <Text style={styles.vaStatNote}>{formatCurrencyShort(monthlyCost)}/month</Text>
        </View>
        <View style={styles.vaStatCard}>
          <Text style={styles.vaStatLabel}>Your Investment</Text>
          <Text style={styles.vaStatValue}>{formatCurrencyShort(totalAmount)}</Text>
          <Text style={styles.vaStatNote}>One-time</Text>
        </View>
        <View style={styles.vaStatCard}>
          <Text style={styles.vaStatLabel}>Return on Investment</Text>
          <Text style={styles.vaStatValue}>{roi.toFixed(1)}x</Text>
          <Text style={styles.vaStatNote}>{roiStatement}</Text>
        </View>
      </View>

      {/* Pain Points Table */}
      <View>
        <View style={styles.vaPainPointHeader}>
          <View style={styles.vaPpColName}>
            <Text style={styles.vaPainPointHeaderText}>Pain Point</Text>
          </View>
          <View style={styles.vaPpColMethod}>
            <Text style={styles.vaPainPointHeaderText}>Method</Text>
          </View>
          <View style={styles.vaPpColConfidence}>
            <Text style={styles.vaPainPointHeaderText}>Confidence</Text>
          </View>
          <View style={styles.vaPpColValue}>
            <Text style={styles.vaPainPointHeaderText}>Annual Impact</Text>
          </View>
        </View>

        {assessment.valueStatements.map((stmt, index) => (
          <View
            key={index}
            style={index % 2 === 0 ? styles.vaPainPointRow : styles.vaPainPointRowAlt}
          >
            <View style={styles.vaPpColName}>
              <Text style={styles.vaPpName}>{stmt.painPoint}</Text>
              <Text style={styles.vaPpFormula}>{stmt.evidenceSummary}</Text>
            </View>
            <View style={styles.vaPpColMethod}>
              <Text style={styles.vaPpMethod}>
                {CALC_METHOD_LABELS[stmt.calculationMethod] || stmt.calculationMethod}
              </Text>
            </View>
            <View style={styles.vaPpColConfidence}>
              <Text
                style={
                  stmt.confidence === 'high'
                    ? styles.vaPpConfHigh
                    : stmt.confidence === 'medium'
                    ? styles.vaPpConfMedium
                    : styles.vaPpConfLow
                }
              >
                {CONFIDENCE_DISPLAY[stmt.confidence] || stmt.confidence}
              </Text>
            </View>
            <View style={styles.vaPpColValue}>
              <Text style={styles.vaPpValue}>{formatCurrencyShort(stmt.annualValue)}/yr</Text>
            </View>
          </View>
        ))}

        {/* Total Row */}
        <View style={styles.vaTotalRow}>
          <Text style={styles.vaTotalLabel}>
            Total Estimated Annual Impact
          </Text>
          <Text style={styles.vaTotalValue}>
            {formatCurrencyShort(assessment.totalAnnualValue)}/yr
          </Text>
        </View>
      </View>

      {/* Bridge to Solution */}
      <View style={styles.vaBridge}>
        <Text style={styles.vaBridgeText}>
          The proposed solution on the following page directly addresses these pain points.{' '}
        </Text>
        <Text style={styles.vaBridgeBold}>
          At {formatCurrencyShort(totalAmount)}, your investment pays for itself in as little as{' '}
          {Math.max(1, Math.ceil(totalAmount / (assessment.totalAnnualValue / 12)))} month
          {Math.ceil(totalAmount / (assessment.totalAnnualValue / 12)) !== 1 ? 's' : ''}.
        </Text>
      </View>

      {/* Disclaimer */}
      <Text style={styles.vaDisclaimer}>
        Values calculated using industry benchmarks, proprietary analysis, and market intelligence.
        Actual results may vary based on implementation and business-specific factors.
        Full methodology available upon request.
      </Text>

      {/* Footer */}
      <Text style={styles.vaFooter}>
        Value Assessment - Confidential
      </Text>
    </Page>
  );
};

// ============================================================================
// Proposal Document Component
// ============================================================================

export const ProposalDocument: React.FC<{ data: ProposalData }> = ({ data }) => {
  const totalPerceivedValue = data.line_items.reduce(
    (sum, item) => sum + (item.perceived_value || item.price),
    0
  );
  const savings = totalPerceivedValue - data.total_amount;

  return (
    <Document>
      {/* Value Assessment Page (inserted before the main proposal if data exists) */}
      {data.value_assessment && data.value_assessment.valueStatements.length > 0 && (
        <ValueAssessmentPage
          assessment={data.value_assessment}
          totalAmount={data.total_amount}
          clientCompany={data.client_company}
        />
      )}

      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.company_name || 'Your Company'}</Text>
          <Text style={styles.proposalTitle}>Service Proposal</Text>
          <Text style={styles.proposalNumber}>
            {data.proposalNumber || `#${data.id.slice(0, 8).toUpperCase()}`}
          </Text>
          <Text style={styles.proposalNumber}>
            Created: {formatDate(data.created_at)}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Client Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prepared For</Text>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{data.client_name}</Text>
            {data.client_company && (
              <Text style={styles.clientDetail}>{data.client_company}</Text>
            )}
            <Text style={styles.clientDetail}>{data.client_email}</Text>
          </View>
        </View>

        {/* Bundle / Package */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proposed Solution</Text>
          <Text style={styles.bundleTitle}>{data.bundle_name}</Text>
          {data.bundle_description && (
            <Text style={styles.bundleDescription}>{data.bundle_description}</Text>
          )}

          {/* Line Items Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={styles.tableColItem}>
                <Text style={styles.tableHeaderText}>Item</Text>
              </View>
              <View style={styles.tableColRole}>
                <Text style={styles.tableHeaderText}>Type</Text>
              </View>
              <View style={styles.tableColValue}>
                <Text style={styles.tableHeaderText}>Value</Text>
              </View>
              <View style={styles.tableColPrice}>
                <Text style={styles.tableHeaderText}>Price</Text>
              </View>
            </View>

            {data.line_items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={styles.tableColItem}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description && (
                    <Text style={styles.itemDescription}>
                      {item.description.length > 60
                        ? item.description.substring(0, 60) + '...'
                        : item.description}
                    </Text>
                  )}
                </View>
                <View style={styles.tableColRole}>
                  <Text style={styles.itemRole}>
                    {item.offer_role ? ROLE_LABELS[item.offer_role] || item.offer_role : '-'}
                  </Text>
                </View>
                <View style={styles.tableColValue}>
                  <Text style={styles.itemValue}>
                    {item.perceived_value ? formatCurrency(item.perceived_value) : '-'}
                  </Text>
                </View>
                <View style={styles.tableColPrice}>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.subtotal)}</Text>
          </View>
          {data.discount_amount && data.discount_amount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Discount{data.discount_description ? ` (${data.discount_description})` : ''}:
              </Text>
              <Text style={[styles.totalValue, { color: '#10b981' }]}>
                -{formatCurrency(data.discount_amount)}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.grandTotal]}>Total:</Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>
              {formatCurrency(data.total_amount)}
            </Text>
          </View>
          {savings > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}></Text>
              <Text style={styles.savings}>
                Save {formatCurrency(savings)} ({Math.round((savings / totalPerceivedValue) * 100)}% off)
              </Text>
            </View>
          )}
        </View>

        {/* Terms */}
        {data.terms_text && (
          <View style={styles.termsSection}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.termsText}>{data.terms_text}</Text>
          </View>
        )}

        {/* Validity */}
        {data.valid_until && (
          <Text style={styles.validityNote}>
            This proposal is valid until {formatDate(data.valid_until)}.
          </Text>
        )}

        {/* Acceptance Section */}
        <View style={styles.acceptSection}>
          <Text style={styles.acceptTitle}>Acceptance</Text>
          <Text style={styles.termsText}>
            By accepting this proposal, you agree to the terms and pricing outlined above.
            Please accept online using the link provided or sign below.
          </Text>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Signature & Date</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Questions? Contact us at your convenience.
        </Text>
      </Page>
    </Document>
  );
};

// Generate PDF Buffer
export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const pdfDoc = <ProposalDocument data={data} />;
  const pdfBuffer = await pdf(pdfDoc).toBuffer();
  // Handle both Buffer and ReadableStream return types
  if (Buffer.isBuffer(pdfBuffer)) {
    return pdfBuffer;
  }
  // Convert ReadableStream to Buffer
  const chunks: Uint8Array[] = [];
  const reader = (pdfBuffer as unknown as ReadableStream<Uint8Array>).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// Generate PDF Blob (for client-side)
export async function generateProposalPDFBlob(data: ProposalData): Promise<Blob> {
  const pdfDoc = <ProposalDocument data={data} />;
  const blob = await pdf(pdfDoc).toBlob();
  return blob;
}
