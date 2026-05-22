'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, CreditCard, Loader, ShieldCheck } from 'lucide-react'
import StripeCheckout from '@/components/checkout/StripeCheckout'
import { getCurrentSession } from '@/lib/auth'
import SiteThemeCorner from '@/components/SiteThemeCorner'

function PaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [keyMode, setKeyMode] = useState<'test' | 'live' | 'unknown' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const createPaymentIntent = useCallback(async () => {
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
      setKeyMode(data.keyMode ?? null)
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    if (orderId) {
      createPaymentIntent()
    } else {
      setError('Order ID is required')
      setLoading(false)
    }
  }, [orderId, createPaymentIntent])

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
      <>
        <SiteThemeCorner />
        <div className="dark agent-ops-page flex min-h-screen items-center justify-center text-foreground">
          <div className="agent-ops-card rounded-lg border p-6 text-center">
            <Loader className="animate-spin mx-auto mb-4 text-radiant-gold" size={48} />
            <div className="text-muted-foreground">Initializing payment...</div>
          </div>
        </div>
      </>
    )
  }

  if (error && !clientSecret) {
    return (
      <>
        <SiteThemeCorner />
        <div className="dark agent-ops-page min-h-screen px-4 pb-12 pt-24 text-foreground">
          <div className="max-w-2xl mx-auto">
            <div className="agent-ops-card rounded-xl border border-red-400/35 bg-red-500/10 p-6 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => router.push('/checkout')}
                className="agent-ops-button-primary px-6 py-2"
              >
                Back to Checkout
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (paymentSuccess) {
    return (
      <>
        <SiteThemeCorner />
        <div className="dark agent-ops-page flex min-h-screen items-center justify-center text-foreground">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="agent-ops-command-card rounded-xl border p-8 text-center"
          >
            <CheckCircle className="mx-auto mb-4 text-radiant-gold" size={64} />
            <h2 className="text-3xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground">Redirecting to your purchases...</p>
          </motion.div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteThemeCorner />
    <div className="dark agent-ops-page min-h-screen px-4 pb-12 pt-24 text-foreground">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push('/checkout')}
            className="agent-ops-button-muted mb-6"
          >
            <ArrowLeft size={20} />
            Back to Checkout
          </button>

          <section className="agent-ops-surface-header mb-6 rounded-xl border p-5 sm:p-6">
            <p className="agent-ops-eyebrow"><CreditCard size={16} /> Secure payment</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Complete payment</h1>
            <p className="mt-2 text-muted-foreground">Enter your payment details to complete your purchase.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-silicon-slate/70 bg-silicon-slate/25 px-3 py-1">
                <ShieldCheck size={14} className="text-radiant-gold" />
                Secured by Stripe
              </span>
              {orderId && (
                <span className="rounded-full border border-silicon-slate/70 bg-silicon-slate/25 px-3 py-1">
                  Order #{orderId}
                </span>
              )}
            </div>
          </section>

          <div className="agent-ops-card rounded-xl border p-5 sm:p-6">
            {clientSecret && orderId && (() => {
              const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
              const pubMode = pubKey.startsWith('pk_live') ? 'live' : pubKey.startsWith('pk_test') ? 'test' : null
              if (keyMode && pubMode && keyMode !== pubMode) {
                return (
                  <div className="rounded-lg border border-amber-500/45 bg-amber-500/10 p-4 text-amber-200">
                    <p className="font-semibold">Payment form could not load</p>
                    <p className="mt-2 text-sm">
                      Your Stripe publishable key and secret key must use the same mode. You have a{' '}
                      <strong>{pubMode}</strong> publishable key but the server is using a <strong>{keyMode}</strong> secret key.
                      Use <strong>pk_test_...</strong> with a test secret key, or <strong>pk_live_...</strong> with a live secret key.
                    </p>
                  </div>
                )
              }
              return (
                <StripeCheckout
                  clientSecret={clientSecret}
                  orderId={parseInt(orderId)}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              )
            })()}
            {error && (
              <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Payment details are handled securely by Stripe.</p>
          </div>
        </motion.div>
      </div>
    </div>
    </>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <>
        <SiteThemeCorner />
      <div className="dark agent-ops-page flex min-h-screen items-center justify-center text-foreground">
        <div className="agent-ops-card rounded-lg border p-6 text-center">
          <Loader className="animate-spin mx-auto mb-4 text-radiant-gold" size={48} />
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
      </>
    }>
      <PaymentContent />
    </Suspense>
  )
}
