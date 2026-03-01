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
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'

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
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
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
    color: '#6b7280',
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
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
  footer: {
    position: 'absolute',
    bottom: 24,
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

const InvoiceDocument: React.FC<{ data: InvoicePDFData }> = ({ data }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
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

        <Text style={styles.footer}>
          {VENDOR_NAME} · Invoice for Order #{data.id} · {formatDate(data.created_at)}
        </Text>
      </Page>
    </Document>
  )
}

// ============================================================================
// Blob generation (client-side)
// ============================================================================

/**
 * Generate invoice PDF as a Blob for download (client-side).
 */
export async function generateInvoicePDFBlob(data: InvoicePDFData): Promise<Blob> {
  const doc = <InvoiceDocument data={data} />
  const blob = await pdf(doc).toBlob()
  return blob
}
