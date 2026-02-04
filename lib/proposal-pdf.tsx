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
});

// Types
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

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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

// Proposal Document Component
export const ProposalDocument: React.FC<{ data: ProposalData }> = ({ data }) => {
  const totalPerceivedValue = data.line_items.reduce(
    (sum, item) => sum + (item.perceived_value || item.price),
    0
  );
  const savings = totalPerceivedValue - data.total_amount;

  return (
    <Document>
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
