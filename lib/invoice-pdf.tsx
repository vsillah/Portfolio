/**
 * Invoice PDF Generator
 * Uses @react-pdf/renderer to generate order invoice PDFs for My Purchases.
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'

// ATAS brand colors (from logo: gold and dark blue)
const ATAS_DARK_BLUE = '#1a2d4a'
const ATAS_GOLD = '#C9A227'
// Non-breaking space (\u00A0) keeps "Solutions" from breaking onto the next line
const COMPANY_FULL_NAME = 'Amadutown Advisory\u00A0Solutions'
const TAGLINE = 'We Rise Together'

// ============================================================================
// Types (minimal shape needed for PDF; matches purchases Order)
// ============================================================================

export interface InvoicePDFShippingAddress {
  address1?: string
  address2?: string
  city?: string
  state_code?: string
  zip?: string
  country_code?: string
  phone?: string
}

export interface InvoicePDFOrderItem {
  id: number
  quantity: number
  price_at_purchase: number
  products: { title: string } | null
  services: { title: string } | null
}

export interface InvoicePDFData {
  id: number
  created_at: string
  total_amount: number
  discount_amount?: number | null
  final_amount: number
  shipping_cost?: number | null
  tax?: number | null
  status: string
  fulfillment_status?: string | null
  shipping_address?: InvoicePDFShippingAddress | null
  order_items: InvoicePDFOrderItem[]
}

const VENDOR_NAME = 'Amadutown'

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingTop: 0,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  // ATAS page header bar (full-width dark blue, gold accent below)
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ATAS_DARK_BLUE,
    marginLeft: -40,
    marginRight: -40,
    marginBottom: 24,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: ATAS_GOLD,
  },
  headerBarLeft: {
    flex: 1,
  },
  headerBarCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBarRight: {
    flex: 1,
  },
  headerCompanyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    // Keep full company name on one line (no hyphenation of "Solutions")
    flexShrink: 0,
  },
  headerLogo: {
    width: 44,
    height: 44,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: ATAS_DARK_BLUE,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: ATAS_GOLD,
    paddingBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    width: 100,
    fontSize: 9,
    color: '#6b7280',
  },
  metaValue: {
    flex: 1,
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 9,
    color: ATAS_GOLD,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  shipTo: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.4,
    marginBottom: 20,
  },
  // ATAS table row header (dark blue, white text)
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: ATAS_DARK_BLUE,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: ATAS_GOLD,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colItem: { flex: 2, fontSize: 10 },
  colQty: { width: 50, fontSize: 10, textAlign: 'right' },
  colUnit: { width: 70, fontSize: 10, textAlign: 'right' },
  colTotal: { width: 70, fontSize: 10, textAlign: 'right', fontWeight: 'bold' },
  totals: {
    marginTop: 16,
    marginLeft: 'auto',
    width: 200,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 10,
  },
  totalRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: ATAS_GOLD,
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    gap: 24,
  },
  statusBlock: {
    fontSize: 9,
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 2,
  },
  // Thank-you and contact message above footer bar
  thankYouSection: {
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  thankYouText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: ATAS_GOLD,
    marginBottom: 4,
  },
  taglineText: {
    fontSize: 10,
    color: ATAS_DARK_BLUE,
    fontStyle: 'italic',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  contactMessage: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  // ATAS footer bar (dark blue, gold accent above and gold text)
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ATAS_DARK_BLUE,
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderTopWidth: 3,
    borderTopColor: ATAS_GOLD,
  },
  footerBarText: {
    fontSize: 9,
    color: ATAS_GOLD,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
})

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatShipTo(addr: InvoicePDFShippingAddress | null | undefined): string {
  if (!addr) return '—'
  const parts = [
    addr.address1,
    addr.address2,
    [addr.city, addr.state_code, addr.zip].filter(Boolean).join(', '),
    addr.country_code,
  ].filter(Boolean)
  return parts.length ? parts.join('\n') : '—'
}

// ============================================================================
// Document Component
// ============================================================================

export interface InvoicePDFOptions {
  /** Absolute URL for the logo image (e.g. origin + /logo.png). Omit to hide logo. */
  logoUrl?: string
}

const InvoiceDocument: React.FC<{
  data: InvoicePDFData
  logoUrl?: string
}> = ({ data, logoUrl }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ATAS header bar: company name, logo, and right spacer */}
        <View style={styles.headerBar}>
          <View style={styles.headerBarLeft}>
            <Text style={styles.headerCompanyName} wrap={false}>{COMPANY_FULL_NAME}</Text>
          </View>
          <View style={styles.headerBarCenter}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop
              <Image style={styles.headerLogo} src={logoUrl} />
            ) : null}
          </View>
          <View style={styles.headerBarRight} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Invoice</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Invoice number</Text>
            <Text style={styles.metaValue}>Order #{data.id}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formatDate(data.created_at)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Vendor</Text>
            <Text style={styles.metaValue}>{VENDOR_NAME}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Ship to</Text>
        <Text style={styles.shipTo}>{formatShipTo(data.shipping_address)}</Text>

        <Text style={styles.sectionLabel}>Items</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
          <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.colUnit]}>Unit price</Text>
          <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
        </View>
        {data.order_items.map((item) => {
          const name = item.products?.title ?? item.services?.title ?? 'Item'
          const lineTotal = (item.price_at_purchase ?? 0) * item.quantity
          return (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colItem}>{name}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{formatCurrency(item.price_at_purchase ?? 0)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(lineTotal)}</Text>
            </View>
          )
        })}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatCurrency(data.total_amount ?? 0)}</Text>
          </View>
          {(data.discount_amount ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text>Discount</Text>
              <Text>-{formatCurrency(data.discount_amount ?? 0)}</Text>
            </View>
          )}
          {(data.shipping_cost ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text>Shipping</Text>
              <Text>{formatCurrency(data.shipping_cost ?? 0)}</Text>
            </View>
          )}
          {(data.tax ?? 0) > 0 && (
            <View style={styles.totalRow}>
              <Text>Tax</Text>
              <Text>{formatCurrency(data.tax ?? 0)}</Text>
            </View>
          )}
          <View style={styles.totalRowBold}>
            <Text>Total</Text>
            <Text>{formatCurrency(data.final_amount)}</Text>
          </View>
        </View>

        <View style={styles.statusSection}>
          <View style={styles.statusBlock}>
            <Text>Order status</Text>
            <Text style={styles.statusValue}>{data.status}</Text>
          </View>
          <View style={styles.statusBlock}>
            <Text>Fulfillment</Text>
            <Text style={styles.statusValue}>
              {data.fulfillment_status || 'Pending'}
            </Text>
          </View>
        </View>

        {/* Thank you and contact message */}
        <View style={styles.thankYouSection}>
          <Text style={styles.thankYouText}>Thank you for your business.</Text>
          <Text style={styles.taglineText}>{TAGLINE}</Text>
          <Text style={styles.contactMessage}>
            Please feel free to contact us if you have any questions about this invoice.
          </Text>
        </View>

        <Text style={styles.footer}>
          {VENDOR_NAME} · Invoice for Order #{data.id} · {formatDate(data.created_at)}
        </Text>

        {/* ATAS footer bar */}
        <View style={styles.footerBar}>
          <Text style={styles.footerBarText}>{TAGLINE}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ============================================================================
// Blob generation (client-side)
// ============================================================================

/**
 * Generate invoice PDF as a Blob for download (client-side).
 * Pass options.logoUrl (e.g. origin + '/logo.png') to include the AT logo in the header.
 */
export async function generateInvoicePDFBlob(
  data: InvoicePDFData,
  options?: InvoicePDFOptions
): Promise<Blob> {
  const doc = (
    <InvoiceDocument data={data} logoUrl={options?.logoUrl} />
  )
  const blob = await pdf(doc).toBlob()
  return blob
}

// ============================================================================
// Buffer generation (server-side — for email attachments)
// ============================================================================

/**
 * Generate invoice PDF as a Node Buffer (server-side).
 * Suitable for attaching to emails via Nodemailer.
 */
export async function generateInvoicePDFBuffer(
  data: InvoicePDFData,
  options?: InvoicePDFOptions
): Promise<Buffer> {
  const doc = (
    <InvoiceDocument data={data} logoUrl={options?.logoUrl} />
  )
  const stream = await pdf(doc).toBuffer()
  const chunks: Uint8Array[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}
