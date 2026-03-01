'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ShoppingBag, Loader, HelpCircle, Package, ExternalLink, FileText, Download } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { formatCurrency } from '@/lib/pricing-model'
import Navigation from '@/components/Navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import DownloadManager from '@/components/DownloadManager'
import SocialShare from '@/components/SocialShare'
import ReferralProgram from '@/components/ReferralProgram'
import { generateInvoicePDFBlob } from '@/lib/invoice-pdf'

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  fulfilled: 'Fulfilled',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const VENDOR_NAME = 'Amadutown'

/** Shipping address stored on order (e.g. for merchandise) */
interface ShippingAddress {
  address1?: string
  address2?: string
  city?: string
  state_code?: string
  zip?: string
  country_code?: string
  phone?: string
}

function formatShippingAddress(addr: ShippingAddress | null | undefined): string {
  if (!addr) return '—'
  const parts = [
    addr.address1,
    addr.address2,
    [addr.city, addr.state_code, addr.zip].filter(Boolean).join(', '),
    addr.country_code,
  ].filter(Boolean)
  return parts.length ? parts.join('\n') : '—'
}

interface Order {
  id: number
  total_amount: number
  discount_amount: number
  final_amount: number
  status: string
  created_at: string
  fulfillment_status?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
  shipping_address?: ShippingAddress | null
  shipping_cost?: number | null
  tax?: number | null
  guest_email?: string | null
  guest_name?: string | null
  order_items: Array<{
    id: number
    product_id: number | null
    service_id: string | null
    quantity: number
    price_at_purchase: number
    products: {
      id: number
      title: string
      type: string
      file_path: string | null
      asset_url?: string | null
      instructions_file_path?: string | null
    } | null
    services: {
      id: string
      title: string
    } | null
  }>
}

function PurchasesContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderIdParam = searchParams.get('orderId')

  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      const session = await getCurrentSession()
      if (!session) return
      const response = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
        if (orderIdParam) {
          const order = data.orders?.find((o: Order) => o.id === parseInt(orderIdParam!))
          if (order) setSelectedOrder(order)
        }
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }, [user, orderIdParam])

  const fetchOrder = useCallback(async (orderId: number) => {
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: {
          ...(session && { Authorization: `Bearer ${session.access_token}` }),
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedOrder(data.order)
      }
    } catch (error) {
      console.error('Failed to fetch order:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDownloadInvoicePDF = useCallback(async () => {
    if (!selectedOrder) return
    setPdfLoading(true)
    try {
      const blob = await generateInvoicePDFBlob(selectedOrder)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-order-${selectedOrder.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to generate invoice PDF:', err)
    } finally {
      setPdfLoading(false)
    }
  }, [selectedOrder])

  useEffect(() => {
    if (orderIdParam) {
      fetchOrder(parseInt(orderIdParam))
    } else {
      fetchOrders()
    }
  }, [orderIdParam, fetchOrders, fetchOrder])

  if (!user && !orderIdParam) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
        <Navigation />
        <div className="max-w-4xl mx-auto text-center">
          <Breadcrumbs items={[{ label: 'Store', href: '/store' }, { label: 'My Purchases' }]} />
          <h1 className="text-4xl font-bold mb-4">My Purchases</h1>
          <p className="text-platinum-white/80 mb-6">Please sign in to view your purchases</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="px-6 py-3 bg-gradient-to-r btn-gold font-semibold rounded-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center pt-24 pb-12 px-4">
        <Navigation />
        <div className="text-platinum-white/80">Loading purchases...</div>
      </div>
    )
  }

  if (selectedOrder) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
        <Navigation />
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={[{ label: 'Store', href: '/store' }, { label: 'My Purchases', href: '/purchases' }, { label: `Order #${selectedOrder.id}` }]} />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => {
                setSelectedOrder(null)
                router.push('/purchases')
              }}
              className="text-platinum-white/80 hover:text-foreground mb-6 transition-colors"
            >
              ← Back to All Purchases
            </button>

            <div className="bg-silicon-slate border border-silicon-slate/80 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Order #{selectedOrder.id}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  selectedOrder.status === 'completed'
                    ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                    : 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>
              <p className="text-platinum-white/80 mb-4">
                Placed on {new Date(selectedOrder.created_at).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-4 text-lg">
                <span className="text-platinum-white/80">Total:</span>
                <span className="text-2xl font-bold text-foreground">
                  {formatCurrency(selectedOrder.final_amount)}
                </span>
              </div>
              {(selectedOrder.fulfillment_status || selectedOrder.tracking_number || selectedOrder.tracking_url) && (
                <div className="mt-4 pt-4 border-t border-silicon-slate/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Package size={18} className="text-radiant-gold" />
                    <span className="text-sm font-heading uppercase tracking-wider text-platinum-white/80">Shipping</span>
                  </div>
                  <p className="text-sm text-platinum-white/90">
                    Status: {FULFILLMENT_LABELS[selectedOrder.fulfillment_status || ''] || selectedOrder.fulfillment_status || 'Pending'}
                  </p>
                  {(selectedOrder.tracking_url || selectedOrder.tracking_number) && (
                    <p className="mt-2">
                      {selectedOrder.tracking_url ? (
                        <a
                          href={selectedOrder.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-radiant-gold hover:text-amber-400 transition-colors"
                        >
                          Track package
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="text-sm text-platinum-white/80">
                          Tracking: {selectedOrder.tracking_number}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Invoice */}
            <div className="bg-silicon-slate border border-silicon-slate/80 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-radiant-gold" />
                  <h2 className="text-xl font-bold">Invoice</h2>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadInvoicePDF}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-radiant-gold/20 text-radiant-gold border border-radiant-gold/50 hover:bg-radiant-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfLoading ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>{pdfLoading ? 'Generating…' : 'Download PDF'}</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm text-platinum-white/70 uppercase tracking-wider mb-1">Invoice number</p>
                  <p className="font-semibold">Order #{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-sm text-platinum-white/70 uppercase tracking-wider mb-1">Date</p>
                  <p className="font-semibold">{new Date(selectedOrder.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                </div>
                <div>
                  <p className="text-sm text-platinum-white/70 uppercase tracking-wider mb-1">Vendor</p>
                  <p className="font-semibold">{VENDOR_NAME}</p>
                </div>
                <div>
                  <p className="text-sm text-platinum-white/70 uppercase tracking-wider mb-1">Ship to</p>
                  <pre className="font-sans text-sm text-platinum-white/90 whitespace-pre-wrap">{formatShippingAddress(selectedOrder.shipping_address)}</pre>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-silicon-slate/50">
                      <th className="py-2 pr-4 text-sm font-semibold text-platinum-white/80">Item</th>
                      <th className="py-2 px-4 text-sm font-semibold text-platinum-white/80 text-right">Qty</th>
                      <th className="py-2 px-4 text-sm font-semibold text-platinum-white/80 text-right">Unit price</th>
                      <th className="py-2 pl-4 text-sm font-semibold text-platinum-white/80 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.order_items.map((item) => {
                      const name = item.products?.title ?? item.services?.title ?? 'Item'
                      const lineTotal = (item.price_at_purchase ?? 0) * item.quantity
                      return (
                        <tr key={item.id} className="border-b border-silicon-slate/30">
                          <td className="py-3 pr-4">{name}</td>
                          <td className="py-3 px-4 text-right">{item.quantity}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(item.price_at_purchase ?? 0)}</td>
                          <td className="py-3 pl-4 text-right font-medium">{formatCurrency(lineTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 pt-4 border-t border-silicon-slate/50 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-platinum-white/80">Subtotal</span>
                  <span>{formatCurrency(selectedOrder.total_amount ?? 0)}</span>
                </div>
                {(selectedOrder.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-platinum-white/80">Discount</span>
                    <span>-{formatCurrency(selectedOrder.discount_amount ?? 0)}</span>
                  </div>
                )}
                {(selectedOrder.shipping_cost ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-platinum-white/80">Shipping</span>
                    <span>{formatCurrency(selectedOrder.shipping_cost ?? 0)}</span>
                  </div>
                )}
                {(selectedOrder.tax ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-platinum-white/80">Tax</span>
                    <span>{formatCurrency(selectedOrder.tax ?? 0)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.final_amount)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-silicon-slate/50 flex flex-wrap gap-4">
                <div>
                  <span className="text-sm text-platinum-white/70 mr-2">Order status:</span>
                  <span className={`px-2 py-0.5 rounded text-sm font-medium ${
                    selectedOrder.status === 'completed'
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-yellow-600/20 text-yellow-400'
                  }`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-platinum-white/70 mr-2">Fulfillment:</span>
                  <span className="text-sm font-medium">
                    {FULFILLMENT_LABELS[selectedOrder.fulfillment_status || ''] || selectedOrder.fulfillment_status || 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {selectedOrder.status === 'completed' && (
              <div className="space-y-6">
                {selectedOrder.order_items.some(
                  (i) =>
                    i.products?.file_path ||
                    (i.products?.type === 'template' && (i.products?.asset_url || i.products?.instructions_file_path))
                ) && (
                  <DownloadManager
                    orderId={selectedOrder.id}
                    orderItems={selectedOrder.order_items.filter((i) => i.products != null) as Array<{ id: number; product_id: number; quantity: number; products: NonNullable<Order['order_items'][0]['products']> }>}
                  />
                )}

                <SocialShare
                  orderId={selectedOrder.id}
                  productTitles={selectedOrder.order_items
                    .map((i) => i.products?.title ?? i.services?.title)
                    .filter((t): t is string => Boolean(t))}
                />
                
                {user && (
                  <ReferralProgram userId={user.id} />
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
      <Navigation />
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs items={[{ label: 'Store', href: '/store' }, { label: 'My Purchases' }]} />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold">My Purchases</h1>
            <Link href="/help" className="text-platinum-white/80 hover:text-foreground transition-colors" aria-label="Help">
              <HelpCircle size={20} />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="mx-auto text-platinum-white/70 mb-4" size={64} />
              <p className="text-platinum-white/80 mb-6">You haven&apos;t made any purchases yet.</p>
              <button
                onClick={() => router.push('/store')}
                className="px-6 py-3 bg-gradient-to-r btn-gold font-semibold rounded-lg"
              >
                Browse Store
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setSelectedOrder(order)
                    router.push(`/purchases?orderId=${order.id}`)
                  }}
                  className="bg-silicon-slate border border-silicon-slate/80 rounded-xl p-6 cursor-pointer hover:border-radiant-gold/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold mb-2">Order #{order.id}</h3>
                      <p className="text-platinum-white/80 text-sm mb-2">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-platinum-white/80 text-sm">
                        {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white mb-2">
                        {formatCurrency(order.final_amount)}
                      </p>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'completed'
                          ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                          : 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center pt-24 pb-12">
        <Navigation />
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <div className="text-platinum-white/80">Loading...</div>
        </div>
      </div>
    }>
      <PurchasesContent />
    </Suspense>
  )
}
