'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Loader } from 'lucide-react'
import StripeCheckout from '@/components/checkout/StripeCheckout'
import { getCurrentSession } from '@/lib/auth'

function PaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  useEffect(() => {
    if (orderId) {
      createPaymentIntent()
    } else {
      setError('Order ID is required')
      setLoading(false)
    }
  }, [orderId])

  const createPaymentIntent = async () => {
    try {
      const session = await getCurrentSession()
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({ orderId: parseInt(orderId!) }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create payment intent')
      }

      const data = await response.json()
      setClientSecret(data.clientSecret)
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true)
    setTimeout(() => {
      router.push(`/purchases?orderId=${orderId}`)
    }, 2000)
  }

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <div className="text-gray-400">Initializing payment...</div>
        </div>
      </div>
    )
  }

  if (error && !clientSecret) {
    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-600/20 border border-red-600/50 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push('/checkout')}
              className="px-6 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500 transition-colors"
            >
              Back to Checkout
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <CheckCircle className="mx-auto mb-4 text-green-400" size={64} />
          <h2 className="text-3xl font-bold mb-2">Payment Successful!</h2>
          <p className="text-gray-400">Redirecting to your purchases...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push('/checkout')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Checkout
          </button>

          <h1 className="text-4xl font-bold mb-2">Complete Payment</h1>
          <p className="text-gray-400 mb-8">Enter your payment details to complete your purchase</p>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            {clientSecret && orderId && (
              <StripeCheckout
                clientSecret={clientSecret}
                orderId={parseInt(orderId)}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            )}
            {error && (
              <div className="mt-4 p-4 bg-red-600/20 border border-red-600/50 rounded-lg text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Your payment is secured by Stripe</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={48} />
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
