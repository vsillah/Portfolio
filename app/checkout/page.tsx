'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Lock } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getCart, clearCart, type CartItem } from '@/lib/cart'
import ContactForm from '@/components/checkout/ContactForm'
import DiscountCodeForm from '@/components/checkout/DiscountCodeForm'
import OrderSummary from '@/components/checkout/OrderSummary'
import ExitIntentPopup from '@/components/ExitIntentPopup'
import ScrollOffer from '@/components/ScrollOffer'
import TimeBasedPopup from '@/components/TimeBasedPopup'
import { getCurrentSession } from '@/lib/auth'

interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  image_url: string | null
}

interface DiscountCode {
  id: number
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  applicable_product_ids: number[] | null
}

export default function CheckoutPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<'contact' | 'review' | 'payment' | 'complete'>('contact')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Record<number, Product>>({})
  const [loading, setLoading] = useState(true)
  const [contactInfo, setContactInfo] = useState<{ name: string; email: string } | null>(null)
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountCodeData, setDiscountCodeData] = useState<DiscountCode | null>(null)

  useEffect(() => {
    loadCart()
  }, [])

  // Auto-advance to review step for logged-in users
  useEffect(() => {
    if (user && step === 'contact') {
      setStep('review')
    }
  }, [user, step])

  const loadCart = async () => {
    const cart = getCart()
    if (cart.length === 0) {
      router.push('/store')
      return
    }

    setCartItems(cart)

    // Fetch product details
    try {
      const response = await fetch('/api/products?active=true')
      if (response.ok) {
        const allProducts: Product[] = await response.json()
        const productMap: Record<number, Product> = {}
        cart.forEach(item => {
          const product = allProducts.find(p => p.id === item.productId)
          if (product) {
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

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const product = products[item.productId]
      if (product && product.price !== null) {
        return total + (product.price * item.quantity)
      }
      return total
    }, 0)
  }

  const calculateFinalTotal = () => {
    const subtotal = calculateSubtotal()
    return Math.max(0, subtotal - discountAmount)
  }

  const handleContactSubmit = (data: { name: string; email: string }) => {
    setContactInfo(data)
    setStep('review')
  }

  const handleDiscountApply = async (code: string) => {
    try {
      const session = await getCurrentSession()
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          code,
          productIds: cartItems.map(item => item.productId),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.error || 'Invalid discount code' }
      }

      const data = await response.json()
      setAppliedDiscountCode(code)
      setDiscountCodeData(data.discountCode)

      // Calculate discount amount
      const subtotal = calculateSubtotal()
      let discount = 0

      if (data.discountCode.discount_type === 'percentage') {
        discount = subtotal * (data.discountCode.discount_value / 100)
      } else {
        discount = Math.min(data.discountCode.discount_value, subtotal)
      }

      setDiscountAmount(discount)
      return { success: true, discount }
    } catch (error) {
      return { success: false, error: 'Failed to validate discount code' }
    }
  }

  const handleDiscountRemove = () => {
    setAppliedDiscountCode(null)
    setDiscountAmount(0)
    setDiscountCodeData(null)
  }

  const handleCheckout = async () => {
    try {
      const session = await getCurrentSession()
      const subtotal = calculateSubtotal()
      const finalTotal = calculateFinalTotal()
      const hasPaidItems = subtotal > 0

      // Create order
      const orderData = {
        cartItems,
        contactInfo: user ? null : contactInfo,
        discountCode: appliedDiscountCode,
        subtotal,
        discountAmount,
        finalTotal,
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to process checkout')
        return
      }

      const { order } = await response.json()

      // Clear cart
      clearCart()

      // Redirect to purchase page or payment if needed
      if (hasPaidItems) {
        // For paid items, we'll handle Stripe payment in the next step
        router.push(`/checkout/payment?orderId=${order.id}`)
      } else {
        // For free items, redirect to downloads
        router.push(`/purchases?orderId=${order.id}`)
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to process checkout')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-gray-400">Loading checkout...</div>
      </div>
    )
  }

  const subtotal = calculateSubtotal()
  const finalTotal = calculateFinalTotal()
  const hasPaidItems = subtotal > 0

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.push('/store')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Store
          </button>
          <h1 className="text-4xl font-bold mb-2">Checkout</h1>
          <p className="text-gray-400">Review your order and complete your purchase</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Info Step (for guests) */}
            {!user && step === 'contact' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6"
              >
                <h2 className="text-2xl font-bold mb-4">Contact Information</h2>
                <p className="text-gray-400 mb-6">
                  Please provide your contact information to continue
                </p>
                <ContactForm onSubmit={handleContactSubmit} />
              </motion.div>
            )}

            {/* Review Step */}
            {(user || contactInfo) && step === 'review' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Contact Info Display */}
                {contactInfo && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold mb-4">Contact Information</h2>
                    <div className="space-y-2 text-gray-400">
                      <p><span className="text-white">Name:</span> {contactInfo.name}</p>
                      <p><span className="text-white">Email:</span> {contactInfo.email}</p>
                    </div>
                    <button
                      onClick={() => setStep('contact')}
                      className="mt-4 text-purple-400 hover:text-purple-300 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                )}

                {/* Discount Code */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold mb-4">Discount Code</h2>
                  <DiscountCodeForm
                    onApply={handleDiscountApply}
                    appliedCode={appliedDiscountCode}
                    discountAmount={discountAmount}
                    onRemove={handleDiscountRemove}
                  />
                </div>

                {/* Checkout Button */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <button
                    onClick={handleCheckout}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {hasPaidItems ? (
                      <>
                        <Lock size={20} />
                        Proceed to Payment
                      </>
                    ) : (
                      'Complete Free Order'
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <OrderSummary
              cartItems={cartItems}
              products={products}
              subtotal={subtotal}
              discountAmount={discountAmount}
              finalTotal={finalTotal}
            />
          </div>
        </div>

        {/* Exit Intent Components */}
        {step === 'review' && (
          <>
            <ExitIntentPopup
              discountAmount={20}
              onApplyDiscount={() => {
                // Could auto-apply a discount code here
                handleDiscountApply('EXIT20').catch(console.error)
              }}
            />
            <ScrollOffer
              scrollThreshold={60}
              discountAmount={15}
              onApplyDiscount={() => {
                handleDiscountApply('SCROLL15').catch(console.error)
              }}
            />
            <TimeBasedPopup
              delay={30000}
              discountAmount={10}
              onApplyDiscount={() => {
                handleDiscountApply('TIME10').catch(console.error)
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
