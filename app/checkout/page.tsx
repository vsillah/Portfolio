'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Lock, HelpCircle, LogIn } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getCart, clearCart, saveCart, updateCartItemQuantity, updateServiceQuantity, removeFromCart, removeServiceFromCart, isServiceItem, type CartItem } from '@/lib/cart'
import DiscountCodeForm from '@/components/checkout/DiscountCodeForm'
import CampaignEnrollmentBanner from '@/components/checkout/CampaignEnrollmentBanner'
import OrderSummary, { type ProductVariant } from '@/components/checkout/OrderSummary'
import { useCampaignEligibility } from '@/hooks/useCampaignEligibility'
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
  is_print_on_demand?: boolean
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

interface DiscountCode {
  id: number
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  applicable_product_ids: number[] | null
}

/** Shipping address for merchandise (physical) orders */
interface ShippingAddressForm {
  address1: string
  address2: string
  city: string
  state_code: string
  zip: string
  country_code: string
  phone?: string
}

const emptyShipping: ShippingAddressForm = {
  address1: '',
  address2: '',
  city: '',
  state_code: '',
  zip: '',
  country_code: 'US',
}

export default function CheckoutPage() {
  const { user, session: authSession, loading: authLoading } = useAuth()
  const router = useRouter()
  const { campaigns, loaded: campaignsLoaded } = useCampaignEligibility()
  const firstCampaign = campaignsLoaded && campaigns.length > 0 ? campaigns[0] : null
  const [step, setStep] = useState<'contact' | 'review' | 'payment' | 'complete'>('contact')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Record<number, Product>>({})
  const [services, setServices] = useState<Record<string, Service>>({})
  const [variants, setVariants] = useState<Record<number, ProductVariant[]>>({})
  const [loading, setLoading] = useState(true)
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<string | null>(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountCodeData, setDiscountCodeData] = useState<DiscountCode | null>(null)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>(emptyShipping)
  const [shippingCost, setShippingCost] = useState(0)
  const [shippingLoading, setShippingLoading] = useState(false)

  const loadCart = useCallback(async () => {
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
        const merchandiseProductIds: number[] = []
        const orphanedItems: CartItem[] = []
        
        cart.forEach(item => {
          if (item.itemType === 'product' && item.productId) {
            const product = allProducts.find(p => p.id === item.productId)
            if (product) {
              productMap[product.id] = product
              // Track merchandise products that need variant fetching
              if (product.is_print_on_demand) {
                merchandiseProductIds.push(product.id)
              }
            } else {
              orphanedItems.push(item)
            }
          }
        })
        
        // Clean orphaned items from cart
        if (orphanedItems.length > 0) {
          const cleanedCart = cart.filter(item => 
            item.itemType === 'service' || 
            (item.itemType === 'product' && item.productId && productMap[item.productId])
          )
          saveCart(cleanedCart)
          setCartItems(cleanedCart)
          
          // Redirect if cart is now empty
          if (cleanedCart.length === 0) {
            router.push('/store')
            return
          }
        }
        
        setProducts(productMap)

        // Fetch variants for merchandise products
        if (merchandiseProductIds.length > 0) {
          const variantMap: Record<number, ProductVariant[]> = {}
          await Promise.all(
            merchandiseProductIds.map(async (productId) => {
              try {
                const variantResponse = await fetch(`/api/products/${productId}`)
                if (variantResponse.ok) {
                  const data = await variantResponse.json()
                  if (data.variants && data.variants.length > 0) {
                    variantMap[productId] = data.variants
                  }
                }
              } catch (error) {
                console.error(`Failed to fetch variants for product ${productId}:`, error)
              }
            })
          )
          setVariants(variantMap)
        }
      }

      // Fetch services when cart has service items
      const serviceIds = cart.filter(isServiceItem).map(item => item.serviceId)
      if (serviceIds.length > 0) {
        const servicesResponse = await fetch('/api/services?active=true')
        if (servicesResponse.ok) {
          const allServices: Service[] = await servicesResponse.json()
          const serviceMap: Record<string, Service> = {}
          allServices.forEach(service => {
            if (serviceIds.includes(service.id)) {
              serviceMap[service.id] = service
            }
          })
          setServices(serviceMap)
        }
      }
    } catch (error) {
      console.error('Failed to fetch cart items:', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadCart()
  }, [loadCart])

  // Logged-in users start at review step
  useEffect(() => {
    if (user && step === 'contact') {
      setStep('review')
    }
  }, [user, step])

  const getItemPrice = (item: CartItem): number | null => {
    if (isServiceItem(item)) {
      const service = services[item.serviceId]
      if (!service || service.is_quote_based) return null
      return service.price
    }
    if (item.productId === undefined) return null
    const product = products[item.productId]
    if (!product) return null

    // For merchandise with variants, use variant price
    if (item.variantId && variants[item.productId]) {
      const variant = variants[item.productId].find(v => v.id === item.variantId)
      if (variant) return variant.price
    }

    return product.price
  }

  const hasQuoteBasedItems = cartItems.some(item => {
    if (isServiceItem(item)) {
      const service = services[item.serviceId]
      return service?.is_quote_based ?? false
    }
    return false
  })

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const price = getItemPrice(item)
      if (price !== null) {
        return total + (price * item.quantity)
      }
      return total
    }, 0)
  }

  const calculateFinalTotal = () => {
    const subtotal = calculateSubtotal()
    return Math.max(0, subtotal - discountAmount)
  }

  const hasMerchandise = cartItems.some(
    (item) => item.itemType === 'product' && item.variantId != null
  )
  const effectiveFinalTotal = calculateFinalTotal() + (hasMerchandise ? shippingCost : 0)

  const isShippingAddressComplete = () => {
    if (!hasMerchandise) return true
    const a = shippingAddress
    return Boolean(
      a.address1?.trim() &&
        a.city?.trim() &&
        a.state_code?.trim() &&
        a.zip?.trim() &&
        a.country_code?.trim()
    )
  }

  // Fetch shipping cost when address is complete (merchandise only)
  useEffect(() => {
    if (!hasMerchandise || !isShippingAddressComplete()) {
      setShippingCost(0)
      return
    }
    const timer = setTimeout(async () => {
      setShippingLoading(true)
      try {
        const items = cartItems
          .filter((item) => item.itemType === 'product' && item.variantId != null)
          .map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            printfulVariantId: item.printfulVariantId,
            quantity: item.quantity,
          }))
        const recipient = {
          address1: shippingAddress.address1.trim(),
          city: shippingAddress.city.trim(),
          state_code: shippingAddress.state_code.trim(),
          zip: shippingAddress.zip.trim(),
          country_code: shippingAddress.country_code.trim(),
        }
        const res = await fetch('/api/checkout/shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, recipient }),
        })
        if (res.ok) {
          const data = await res.json()
          setShippingCost(data.shipping_cost ?? 0)
        } else {
          setShippingCost(0)
        }
      } catch {
        setShippingCost(0)
      } finally {
        setShippingLoading(false)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [
    hasMerchandise,
    shippingAddress.address1,
    shippingAddress.city,
    shippingAddress.state_code,
    shippingAddress.zip,
    shippingAddress.country_code,
    cartItems,
  ])

  // Cart management handlers
  const handleQuantityChange = (productId: number, quantity: number, variantId?: number) => {
    const updated = updateCartItemQuantity(productId, quantity, variantId)
    setCartItems(updated)
    
    // Redirect to store if cart is empty
    if (updated.length === 0) {
      router.push('/store')
    }
  }

  const handleRemoveItem = (productId: number, variantId?: number) => {
    const updated = removeFromCart(productId, variantId)
    setCartItems(updated)
    
    // Redirect to store if cart is empty
    if (updated.length === 0) {
      router.push('/store')
    }
  }

  const handleServiceQuantityChange = (serviceId: string, quantity: number) => {
    const updated = updateServiceQuantity(serviceId, quantity)
    setCartItems(updated)
    if (updated.length === 0) router.push('/store')
  }

  const handleRemoveService = (serviceId: string) => {
    const updated = removeServiceFromCart(serviceId)
    setCartItems(updated)
    if (updated.length === 0) router.push('/store')
  }

  const handleVariantChange = (
    productId: number,
    oldVariantId: number | undefined,
    newVariantId: number,
    printfulVariantId: number
  ) => {
    const cart = getCart()
    const updatedCart = cart.map(item => {
      if (item.productId === productId && item.variantId === oldVariantId) {
        return {
          ...item,
          variantId: newVariantId,
          printfulVariantId: printfulVariantId,
        }
      }
      return item
    })
    saveCart(updatedCart)
    setCartItems(updatedCart)
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
      const session = authSession ?? (await getCurrentSession())
      if (!session?.access_token) {
        router.push('/auth/login?redirect=/checkout')
        return
      }
      if (hasMerchandise && !isShippingAddressComplete()) {
        alert('Please enter your full shipping address so we can deliver your order.')
        return
      }
      const subtotal = calculateSubtotal()
      const hasPaidItems = subtotal > 0 || hasQuoteBasedItems

      const orderData: Record<string, unknown> = {
        cartItems,
        discountCode: appliedDiscountCode,
        subtotal,
        discountAmount,
        finalTotal: effectiveFinalTotal,
        hasQuoteBasedItems,
      }
      if (hasMerchandise) {
        orderData.shippingAddress = {
          address1: shippingAddress.address1.trim(),
          address2: shippingAddress.address2?.trim() || undefined,
          city: shippingAddress.city.trim(),
          state_code: shippingAddress.state_code.trim(),
          zip: shippingAddress.zip.trim(),
          country_code: shippingAddress.country_code.trim(),
          phone: shippingAddress.phone?.trim() || undefined,
        }
        orderData.shippingCost = shippingCost
        orderData.tax = 0
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 401) {
          router.push('/auth/login?redirect=/checkout')
          router.refresh()
          return
        }
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

  // Wait for both cart and auth to be ready before showing sign-in gate or checkout
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-platinum-white/80">Loading checkout...</div>
      </div>
    )
  }

  // Require sign-in so we can deliver orders and follow up / upsell
  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/store')}
              className="flex items-center gap-2 text-platinum-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Store
            </button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-silicon-slate border border-silicon-slate rounded-xl p-8 max-w-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Lock className="text-radiant-gold flex-shrink-0" size={28} />
              <h2 className="text-2xl font-bold">Sign in to checkout</h2>
            </div>
            <p className="text-platinum-white/80 mb-6">
              We require an account so we can deliver your order and follow up with you. Sign in or create an account to continue.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/auth/login?redirect=/checkout"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r btn-gold transition-colors"
              >
                <LogIn size={20} />
                Sign in
              </Link>
              <Link
                href="/auth/signup?redirect=/checkout"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg btn-ghost transition-colors"
              >
                Create account
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  const subtotal = calculateSubtotal()
  const hasPaidItems = subtotal > 0 || hasQuoteBasedItems

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/store')}
              className="flex items-center gap-2 text-platinum-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Store
            </button>
            <Link href="/help" className="text-platinum-white/80 hover:text-white transition-colors" aria-label="Help">
              <HelpCircle size={20} />
            </Link>
          </div>
          <h1 className="text-4xl font-bold mb-2">Checkout</h1>
          <p className="text-platinum-white/80">Review your order and complete your purchase</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Review Step (user is always set here) */}
            {step === 'review' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Campaign Enrollment Banner (uses shared hook to avoid duplicate fetch with OrderSummary) */}
                <CampaignEnrollmentBanner
                  campaign={firstCampaign ? { name: firstCampaign.name, slug: firstCampaign.slug, campaign_type: firstCampaign.campaign_type, enrollment_deadline: firstCampaign.enrollment_deadline } : null}
                />

                {hasMerchandise && (
                  <div className="bg-silicon-slate border border-silicon-slate rounded-xl p-6">
                    <h2 className="text-xl font-bold mb-4">Shipping address</h2>
                    <p className="text-platinum-white/80 text-sm mb-4">
                      Required for physical products. We’ll deliver your order to this address.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-platinum-white/90 mb-1">Street address</label>
                        <input
                          type="text"
                          value={shippingAddress.address1}
                          onChange={(e) => setShippingAddress((a) => ({ ...a, address1: e.target.value }))}
                          placeholder="Address line 1"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground placeholder:text-platinum-white/50"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={shippingAddress.address2}
                          onChange={(e) => setShippingAddress((a) => ({ ...a, address2: e.target.value }))}
                          placeholder="Address line 2 (optional)"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground placeholder:text-platinum-white/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/90 mb-1">City</label>
                        <input
                          type="text"
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress((a) => ({ ...a, city: e.target.value }))}
                          placeholder="City"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground placeholder:text-platinum-white/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/90 mb-1">State / Province</label>
                        <input
                          type="text"
                          value={shippingAddress.state_code}
                          onChange={(e) => setShippingAddress((a) => ({ ...a, state_code: e.target.value }))}
                          placeholder="e.g. CA"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground placeholder:text-platinum-white/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/90 mb-1">ZIP / Postal code</label>
                        <input
                          type="text"
                          value={shippingAddress.zip}
                          onChange={(e) => setShippingAddress((a) => ({ ...a, zip: e.target.value }))}
                          placeholder="ZIP code"
                          className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground placeholder:text-platinum-white/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-platinum-white/90 mb-1">Country</label>
                        <select
                          value={shippingAddress.country_code}
                          onChange={(e) => setShippingAddress((a) => ({ ...a, country_code: e.target.value }))}
                          className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground"
                        >
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="GB">United Kingdom</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                    {shippingLoading && (
                      <p className="text-sm text-platinum-white/70 mt-2">Calculating shipping…</p>
                    )}
                    {!shippingLoading && hasMerchandise && isShippingAddressComplete() && shippingCost > 0 && (
                      <p className="text-sm text-platinum-white/80 mt-2">Shipping: ${shippingCost.toFixed(2)}</p>
                    )}
                  </div>
                )}

                {/* Discount Code */}
                <div className="bg-silicon-slate border border-silicon-slate rounded-xl p-6">
                  <h2 className="text-xl font-bold mb-4">Discount Code</h2>
                  <DiscountCodeForm
                    onApply={handleDiscountApply}
                    appliedCode={appliedDiscountCode}
                    discountAmount={discountAmount}
                    onRemove={handleDiscountRemove}
                  />
                </div>

                {/* Checkout Button */}
                <div className="bg-silicon-slate border border-silicon-slate rounded-xl p-6">
                  <button
                    onClick={handleCheckout}
                    className="w-full px-6 py-4 btn-gold text-imperial-navy font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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
              services={services}
              variants={variants}
              subtotal={subtotal}
              discountAmount={discountAmount}
              finalTotal={effectiveFinalTotal}
              shippingCost={hasMerchandise ? shippingCost : undefined}
              hasQuoteBasedItems={hasQuoteBasedItems}
              editable={true}
              onQuantityChange={handleQuantityChange}
              onServiceQuantityChange={handleServiceQuantityChange}
              onRemoveItem={handleRemoveItem}
              onRemoveService={handleRemoveService}
              onVariantChange={handleVariantChange}
              activeCampaign={firstCampaign ? { name: firstCampaign.name, slug: firstCampaign.slug } : null}
            />
          </div>
        </div>

        {/* Exit Intent Components — only one popup per session; none for free-only carts */}
        {step === 'review' && (
          <>
            <ExitIntentPopup
              discountAmount={20}
              appliedDiscountCode={appliedDiscountCode}
              showDiscountPopups={subtotal > 0}
              onApplyDiscount={() => {
                handleDiscountApply('EXIT20').catch(console.error)
              }}
            />
            <ScrollOffer
              scrollThreshold={60}
              discountAmount={15}
              appliedDiscountCode={appliedDiscountCode}
              showDiscountPopups={subtotal > 0}
              onApplyDiscount={() => {
                handleDiscountApply('SCROLL15').catch(console.error)
              }}
            />
            <TimeBasedPopup
              delay={30000}
              discountAmount={10}
              appliedDiscountCode={appliedDiscountCode}
              showDiscountPopups={subtotal > 0}
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
