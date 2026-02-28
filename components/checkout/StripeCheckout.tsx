'use client'

import { useState } from 'react'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Lock, Loader } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface StripeCheckoutProps {
  clientSecret: string
  orderId: number
  onSuccess: () => void
  onError: (error: string) => void
}

function CheckoutForm({ clientSecret, orderId, onSuccess, onError }: StripeCheckoutProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Do not mount PaymentElement until Stripe context is ready; otherwise "Could not retrieve elements store" occurs.
  if (!stripe || !elements) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-platinum-white/80">
        <Loader className="animate-spin mb-3 text-radiant-gold" size={32} />
        <span>Loading payment form...</span>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'Payment failed')
        setLoading(false)
        return
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/purchases?orderId=${orderId}`,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        onError(confirmError.message || 'Payment failed')
      } else {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed')
      onError(err.message || 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="min-h-[220px] w-full">
        <PaymentElement />
      </div>
      {error && (
        <div className="p-4 bg-red-600/20 border border-red-600/50 rounded-lg text-red-400">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full px-6 py-4 btn-gold text-imperial-navy font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          'Processing...'
        ) : (
          <>
            <Lock size={20} />
            Pay ${orderId ? 'Now' : ''}
          </>
        )}
      </button>
    </form>
  )
}

export default function StripeCheckout({ clientSecret, orderId, onSuccess, onError }: StripeCheckoutProps) {
  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#D4AF37',
        colorBackground: '#2C3E50',
        colorText: '#EAECEE',
        colorDanger: '#ef4444',
        fontFamily: 'var(--font-cormorant), system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
    },
  }

  return (
    <Elements options={options} stripe={stripePromise}>
      <CheckoutForm
        clientSecret={clientSecret}
        orderId={orderId}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  )
}
