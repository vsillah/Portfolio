'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ShoppingBag, Loader, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import DownloadManager from '@/components/DownloadManager'
import SocialShare from '@/components/SocialShare'
import ReferralProgram from '@/components/ReferralProgram'

interface Order {
  id: number
  total_amount: number
  discount_amount: number
  final_amount: number
  status: string
  created_at: string
  order_items: Array<{
    id: number
    product_id: number
    quantity: number
    products: {
      id: number
      title: string
      type: string
      file_path: string | null
    }
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

  useEffect(() => {
    if (orderIdParam) {
      fetchOrder(parseInt(orderIdParam))
    } else {
      fetchOrders()
    }
  }, [orderIdParam, user])

  const fetchOrders = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
        if (orderIdParam) {
          const order = data.orders?.find((o: Order) => o.id === parseInt(orderIdParam))
          if (order) setSelectedOrder(order)
        }
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrder = async (orderId: number) => {
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
  }

  if (!user && !orderIdParam) {
    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">My Purchases</h1>
          <p className="text-gray-400 mb-6">Please sign in to view your purchases</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Loading purchases...</div>
      </div>
    )
  }

  if (selectedOrder) {
    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => {
                setSelectedOrder(null)
                router.push('/purchases')
              }}
              className="text-gray-400 hover:text-white mb-6 transition-colors"
            >
              ← Back to All Purchases
            </button>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
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
              <p className="text-gray-400 mb-4">
                Placed on {new Date(selectedOrder.created_at).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-4 text-lg">
                <span className="text-gray-400">Total:</span>
                <span className="text-2xl font-bold text-white">
                  ${selectedOrder.final_amount.toFixed(2)}
                </span>
              </div>
            </div>

            {selectedOrder.status === 'completed' && (
              <div className="space-y-6">
                <DownloadManager
                  orderId={selectedOrder.id}
                  orderItems={selectedOrder.order_items}
                />
                
                <SocialShare
                  orderId={selectedOrder.id}
                  productTitle={selectedOrder.order_items[0]?.products?.title}
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
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold">My Purchases</h1>
            <Link href="/help" className="text-gray-400 hover:text-white transition-colors" aria-label="Help">
              <HelpCircle size={20} />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="mx-auto text-gray-600 mb-4" size={64} />
              <p className="text-gray-400 mb-6">You haven't made any purchases yet.</p>
              <button
                onClick={() => router.push('/store')}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg"
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
                  className="bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer hover:border-purple-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold mb-2">Order #{order.id}</h3>
                      <p className="text-gray-400 text-sm mb-2">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white mb-2">
                        ${order.final_amount.toFixed(2)}
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    }>
      <PurchasesContent />
    </Suspense>
  )
}
