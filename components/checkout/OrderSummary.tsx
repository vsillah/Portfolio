'use client'

import { motion } from 'framer-motion'
import { DollarSign } from 'lucide-react'

interface Product {
  id: number
  title: string
  price: number | null
  image_url: string | null
}

interface CartItem {
  productId: number
  quantity: number
}

interface OrderSummaryProps {
  cartItems: CartItem[]
  products: Record<number, Product>
  subtotal: number
  discountAmount: number
  finalTotal: number
}

export default function OrderSummary({
  cartItems,
  products,
  subtotal,
  discountAmount,
  finalTotal,
}: OrderSummaryProps) {
  const hasPaidItems = subtotal > 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Order Summary</h2>

      {/* Items */}
      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
        {cartItems.map((item) => {
          const product = products[item.productId]
          if (!product) return null

          return (
            <div key={item.productId} className="flex items-center gap-3 text-sm">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <DollarSign className="text-gray-600" size={20} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium line-clamp-1">{product.title}</p>
                <p className="text-gray-400">
                  Qty: {item.quantity} × {product.price !== null ? `$${product.price.toFixed(2)}` : 'Free'}
                </p>
              </div>
              <div className="text-white font-semibold">
                {product.price !== null
                  ? `$${(product.price * item.quantity).toFixed(2)}`
                  : 'Free'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-800 pt-4 space-y-2">
        <div className="flex justify-between text-gray-400">
          <span>Subtotal</span>
          <span>{hasPaidItems ? `$${subtotal.toFixed(2)}` : 'Free'}</span>
        </div>
        {discountAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-between text-green-400"
          >
            <span>Discount</span>
            <span>-${discountAmount.toFixed(2)}</span>
          </motion.div>
        )}
        <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-gray-800">
          <span>Total</span>
          <span>{hasPaidItems ? `$${finalTotal.toFixed(2)}` : 'Free'}</span>
        </div>
      </div>
    </div>
  )
}
