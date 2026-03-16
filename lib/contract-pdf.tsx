// Software Agreement PDF — AmaduTown Advisory Solutions
// Uses @react-pdf/renderer; brand styles from lib/pdf-brand-styles

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { PDF_BRAND, COMPANY_DISPLAY_NAME } from '@/lib/pdf-brand-styles';

export interface ContractPDFData {
  client_name: string;
  client_company?: string | null;
  total_amount: number;
  bundle_name?: string;
  valid_until?: string;
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
  divider: PDF_BRAND.divider,
  thickDivider: PDF_BRAND.thickDivider,
  sectionTitle: PDF_BRAND.sectionTitle,
  bodyText: PDF_BRAND.bodyText,
  bodyTextMuted: PDF_BRAND.bodyTextMuted,
  paragraph: {
    marginBottom: 10,
  },
  signatureBlock: {
    marginTop: 24,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.colors.siliconSlate,
    marginTop: 32,
    width: 240,
  },
  signatureLabel: {
    fontSize: 9,
    color: PDF_BRAND.colors.siliconSlate,
    marginTop: 4,
  },
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

const ContractDocument: React.FC<{ data: ContractPDFData }> = ({ data }) => {
  const clientLabel = data.client_company
    ? `${data.client_name}, on behalf of ${data.client_company}`
    : data.client_name;
  const servicesDesc = data.bundle_name
    ? `Software advisory and implementation services as described in the accompanying proposal (${data.bundle_name}), including any deliverables, access, and support specified therein.`
    : 'Software advisory and implementation services as described in the accompanying proposal, including any deliverables, access, and support specified therein.';

  return (
    <Document title={`Software Agreement — ${clientLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{COMPANY_DISPLAY_NAME}</Text>
          <Text style={styles.documentTitle}>Software Agreement</Text>
          <Text style={styles.documentSubtitle}>
            Client: {clientLabel}
          </Text>
        </View>
        <View style={styles.thickDivider} />

        <Text style={styles.sectionTitle}>I. Parties</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          This Software Agreement (“Agreement”) is entered into between {COMPANY_DISPLAY_NAME} (“Provider”) and the client identified above (“Client”). Provider and Client are each a “Party” and together the “Parties.”
        </Text>

        <Text style={styles.sectionTitle}>II. Services</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          {servicesDesc}
        </Text>

        <Text style={styles.sectionTitle}>III. Term</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          The term begins upon acceptance of the accompanying proposal and payment of the agreed amount. Specific milestones and warranty periods are set forth in the proposal and any onboarding plan provided to Client.
        </Text>

        <Text style={styles.sectionTitle}>IV. Compensation</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          Client agrees to pay Provider the total amount of {formatCurrency(data.total_amount)} as set forth in the proposal. This amount is due upon acceptance unless otherwise specified in the proposal.
        </Text>

        <Text style={styles.sectionTitle}>V. Payment</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          Payment shall be made via the method specified in the proposal (e.g., Stripe). Late payments may incur interest at the rate of 1.5% per month or the maximum rate permitted by law, whichever is less.
        </Text>

        <Text style={styles.sectionTitle}>VI. Expenses</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          Unless otherwise agreed in writing, each Party shall bear its own expenses. Any pre-approved reimbursable expenses will be documented and submitted in accordance with Provider’s policies.
        </Text>

        <Text style={styles.sectionTitle}>VII. Disputes</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          The Parties will attempt in good faith to resolve any dispute arising out of this Agreement through negotiation. If unresolved, the dispute shall be governed by the provisions of Section XI (Governing Law) and may be submitted to a court of competent jurisdiction.
        </Text>

        <Text style={styles.sectionTitle}>VIII. Legal Notice</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          Any notice required under this Agreement shall be in writing and sent to the contact information provided at signing. Notices are effective upon receipt.
        </Text>

        <Text style={styles.sectionTitle}>IX. Confidentiality</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          Each Party agrees to keep confidential any proprietary or non-public information disclosed by the other in connection with this Agreement and to use such information only for performing under this Agreement.
        </Text>

        <Text style={styles.sectionTitle}>X. Assignment</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          Neither Party may assign this Agreement without the prior written consent of the other, except that Provider may assign to an affiliate or in connection with a merger or sale of substantially all of its assets.
        </Text>

        <Text style={styles.sectionTitle}>XI. Governing Law</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles.
        </Text>

        <Text style={styles.sectionTitle}>XII. Severability</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.
        </Text>

        <Text style={styles.sectionTitle}>XIII. Entire Agreement</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          This Agreement, together with the accepted proposal and any referenced onboarding plan, constitutes the entire agreement between the Parties and supersedes all prior discussions and agreements relating to the subject matter hereof.
        </Text>

        <View style={styles.thickDivider} />

        <Text style={styles.sectionTitle}>Signatures</Text>
        <Text style={[styles.bodyText, styles.paragraph]}>
          By signing below (or by electronic acceptance where offered), Client agrees to the terms of this Agreement and the accompanying proposal.
        </Text>

        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Client signature</Text>
        </View>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Printed name</Text>
        </View>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Date</Text>
        </View>
      </Page>
    </Document>
  );
};

export async function generateContractPDF(data: ContractPDFData): Promise<Buffer> {
  const doc = <ContractDocument data={data} />;
  const result = await pdf(doc).toBuffer();
  if (Buffer.isBuffer(result)) return result;
  const chunks: Uint8Array[] = [];
  const reader = (result as unknown as ReadableStream<Uint8Array>).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}
