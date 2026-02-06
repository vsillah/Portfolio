'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Minus, Trash2, ShoppingCart as CartIcon, Clock, Users } from 'lucide-react'
import { 
  getCart, 
  removeFromCart, 
  removeServiceFromCart,
  updateCartItemQuantity, 
  updateServiceQuantity,
  clearCart, 
  isProductItem,
  isServiceItem,
  type CartItem 
} from '@/lib/cart'

interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  image_url: string | null
}

interface Service {
  id: string
  title: string
  description: string | null
  service_type: string
  delivery_method: string
  duration_description: string | null
  price: number | null
  is_quote_based: boolean
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
  const [services, setServices] = useState<Record<string, Service>>({})
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

    // Separate product and service IDs
    const productIds = cart
      .filter(item => isProductItem(item))
      .map(item => item.productId)
    const serviceIds = cart
      .filter(item => isServiceItem(item))
      .map(item => item.serviceId)

    try {
      // Fetch products and services in parallel
      const [productsResponse, servicesResponse] = await Promise.all([
        productIds.length > 0 ? fetch(`/api/products?active=true`) : Promise.resolve(null),
        serviceIds.length > 0 ? fetch(`/api/services?active=true`) : Promise.resolve(null),
      ])

      // Process products
      if (productsResponse && productsResponse.ok) {
        const allProducts: Product[] = await productsResponse.json()
        const productMap: Record<number, Product> = {}
        allProducts.forEach(product => {
          if (productIds.includes(product.id)) {
            productMap[product.id] = product
          }
        })
        setProducts(productMap)
      }

      // Process services
      if (servicesResponse && servicesResponse.ok) {
        const allServices: Service[] = await servicesResponse.json()
        const serviceMap: Record<string, Service> = {}
        allServices.forEach(service => {
          if (serviceIds.includes(service.id)) {
            serviceMap[service.id] = service
          }
        })
        setServices(serviceMap)
      }
    } catch (error) {
      console.error('Failed to fetch cart items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveProduct = (productId: number) => {
    const updated = removeFromCart(productId)
    setCartItems(updated)
    if (updated.length === 0) {
      setProducts({})
      setServices({})
    }
  }

  const handleRemoveService = (serviceId: string) => {
    const updated = removeServiceFromCart(serviceId)
    setCartItems(updated)
    if (updated.length === 0) {
      setProducts({})
      setServices({})
    }
  }

  const handleProductQuantityChange = (productId: number, delta: number) => {
    const item = cartItems.find(i => isProductItem(i) && i.productId === productId)
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta)
      const updated = updateCartItemQuantity(productId, newQuantity)
      setCartItems(updated)
    }
  }

  const handleServiceQuantityChange = (serviceId: string, delta: number) => {
    const item = cartItems.find(i => isServiceItem(i) && i.serviceId === serviceId)
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta)
      const updated = updateServiceQuantity(serviceId, newQuantity)
      setCartItems(updated)
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your cart?')) {
      clearCart()
      setCartItems([])
      setProducts({})
      setServices({})
    }
  }

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      if (isProductItem(item)) {
        const product = products[item.productId]
        if (product && product.price !== null) {
          return total + (product.price * item.quantity)
        }
      } else if (isServiceItem(item)) {
        const service = services[item.serviceId]
        if (service && service.price !== null && !service.is_quote_based) {
          return total + (service.price * item.quantity)
        }
      }
      return total
    }, 0)
  }

  const hasPaidItems = cartItems.some(item => {
    if (isProductItem(item)) {
      const product = products[item.productId]
      return product && product.price !== null && product.price > 0
    } else if (isServiceItem(item)) {
      const service = services[item.serviceId]
      return service && service.price !== null && service.price > 0 && !service.is_quote_based
    }
    return false
  })

  const hasQuoteBasedItems = cartItems.some(item => {
    if (isServiceItem(item)) {
      const service = services[item.serviceId]
      return service && service.is_quote_based
    }
    return false
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
                    // Render product item
                    if (isProductItem(item)) {
                      const product = products[item.productId]
                      if (!product) return null

                      return (
                        <motion.div
                          key={`product-${item.productId}`}
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
                                  onClick={() => handleProductQuantityChange(item.productId, -1)}
                                  className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="text-sm text-white w-8 text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleProductQuantityChange(item.productId, 1)}
                                  className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemoveProduct(item.productId)}
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
                    }

                    // Render service item
                    if (isServiceItem(item)) {
                      const service = services[item.serviceId]
                      if (!service) return null

                      return (
                        <motion.div
                          key={`service-${item.serviceId}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-gray-800 border border-gray-700 rounded-lg p-4"
                        >
                          <div className="flex gap-4">
                            {/* Service Image */}
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-900/20 to-green-900/20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {service.image_url ? (
                                <img
                                  src={service.image_url}
                                  alt={service.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-gray-600 text-xs text-center p-2">
                                  {service.service_type}
                                </div>
                              )}
                            </div>

                            {/* Service Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-white line-clamp-2">
                                  {service.title}
                                </h3>
                                <span className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded">
                                  Service
                                </span>
                              </div>
                              
                              {service.duration_description && (
                                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                  <Clock size={12} />
                                  {service.duration_description}
                                </p>
                              )}
                              
                              <p className="text-sm text-gray-400 mb-2">
                                {service.is_quote_based 
                                  ? 'Contact for Pricing'
                                  : service.price !== null 
                                    ? `$${service.price.toFixed(2)}` 
                                    : 'Free'}
                              </p>

                              {/* Quantity Controls */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleServiceQuantityChange(item.serviceId, -1)}
                                  className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="text-sm text-white w-8 text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleServiceQuantityChange(item.serviceId, 1)}
                                  className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  onClick={() => handleRemoveService(item.serviceId)}
                                  className="ml-auto p-1 text-red-400 hover:text-red-300"
                                  title="Remove"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>

                              {/* Subtotal */}
                              <p className="text-sm text-gray-300 mt-2">
                                Subtotal: {service.is_quote_based
                                  ? 'Quote Required'
                                  : service.price !== null
                                    ? `$${(service.price * item.quantity).toFixed(2)}`
                                    : 'Free'}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )
                    }

                    return null
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="p-6 border-t border-gray-800 space-y-4">
                {hasQuoteBasedItems && (
                  <div className="p-3 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      Some items require a custom quote. We will contact you to finalize pricing.
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg">
                  <span className="text-gray-400">Total:</span>
                  <span className="text-2xl font-bold text-white">
                    {hasQuoteBasedItems 
                      ? `$${calculateTotal().toFixed(2)}+`
                      : hasPaidItems 
                        ? `$${calculateTotal().toFixed(2)}` 
                        : 'Free'}
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
                    {hasQuoteBasedItems ? 'Request Quote' : 'Proceed to Checkout'}
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
