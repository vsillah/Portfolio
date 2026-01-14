'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, Trash2, ShoppingCart as CartIcon } from 'lucide-react'
import { getCart, removeFromCart, updateCartItemQuantity, clearCart, type CartItem } from '@/lib/cart'

interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  image_url: string | null
}

interface ShoppingCartProps {
  isOpen: boolean
  onClose: () => void
  onCheckout: () => void
}

export default function ShoppingCart({ isOpen, onClose, onCheckout }: ShoppingCartProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Record<number, Product>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadCart()
    }
  }, [isOpen])

  const loadCart = async () => {
    const cart = getCart()
    setCartItems(cart)

    if (cart.length === 0) {
      setLoading(false)
      return
    }

    // Fetch product details
    try {
      const productIds = cart.map(item => item.productId)
      const response = await fetch(`/api/products?active=true`)
      if (response.ok) {
        const allProducts: Product[] = await response.json()
        const productMap: Record<number, Product> = {}
        allProducts.forEach(product => {
          if (productIds.includes(product.id)) {
            productMap[product.id] = product
          }
        })
        setProducts(productMap)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = (productId: number) => {
    const updated = removeFromCart(productId)
    setCartItems(updated)
    if (updated.length === 0) {
      setProducts({})
    }
  }

  const handleQuantityChange = (productId: number, delta: number) => {
    const item = cartItems.find(i => i.productId === productId)
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta)
      const updated = updateCartItemQuantity(productId, newQuantity)
      setCartItems(updated)
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      clearCart()
      setCartItems([])
      setProducts({})
    }
  }

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      const product = products[item.productId]
      if (product && product.price !== null) {
        return total + (product.price * item.quantity)
      }
      return total
    }, 0)
  }

  const hasPaidItems = cartItems.some(item => {
    const product = products[item.productId]
    return product && product.price !== null && product.price > 0
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Cart Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-800 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CartIcon size={24} />
                <h2 className="text-2xl font-bold">Shopping Cart</h2>
                {cartItems.length > 0 && (
                  <span className="px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded">
                    {cartItems.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="text-gray-400">Loading cart...</div>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <CartIcon className="mx-auto text-gray-600 mb-4" size={48} />
                  <p className="text-gray-400 mb-4">Your cart is empty</p>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500 transition-colors"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => {
                    const product = products[item.productId]
                    if (!product) return null

                    return (
                      <motion.div
                        key={item.productId}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex gap-4">
                          {/* Product Image */}
                          <div className="w-20 h-20 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-gray-600 text-xs text-center p-2">
                                {product.type}
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white mb-1 line-clamp-2">
                              {product.title}
                            </h3>
                            <p className="text-sm text-gray-400 mb-2">
                              {product.price !== null ? `$${product.price.toFixed(2)}` : 'Free'}
                            </p>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleQuantityChange(item.productId, -1)}
                                className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-sm text-white w-8 text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item.productId, 1)}
                                className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={() => handleRemove(item.productId)}
                                className="ml-auto p-1 text-red-400 hover:text-red-300"
                                title="Remove"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {/* Subtotal */}
                            <p className="text-sm text-gray-300 mt-2">
                              Subtotal: {product.price !== null
                                ? `$${(product.price * item.quantity).toFixed(2)}`
                                : 'Free'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="p-6 border-t border-gray-800 space-y-4">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-gray-400">Total:</span>
                  <span className="text-2xl font-bold text-white">
                    {hasPaidItems ? `$${calculateTotal().toFixed(2)}` : 'Free'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {cartItems.length > 0 && (
                    <button
                      onClick={handleClear}
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-red-500 transition-colors"
                    >
                      Clear Cart
                    </button>
                  )}
                  <button
                    onClick={onCheckout}
                    className="flex-1 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
