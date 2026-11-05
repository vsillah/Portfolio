'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { addRecommendedToCart } from '@/lib/cart'

export type ReviewedRecommendation = {
  id: string
  title: string
  rationale: string
  offer_kind: 'product' | 'service'
  offer_id: string
  reviewed_at: string | null
  approved_price?: number | null
  approved_is_quote_based?: boolean | null
  approved_is_print_on_demand?: boolean | null
  approved_variant_prices?: Array<{ id: number; price: number; size?: string | null; color?: string | null }>
}

export default function RecommendationAction({ item, preview = false }: { item: ReviewedRecommendation; preview?: boolean }) {
  const router = useRouter()
  const [variantId, setVariantId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const quote = item.approved_is_quote_based === true
  const ready = item.reviewed_at && item.approved_is_quote_based !== null && item.approved_is_quote_based !== undefined
  const needsVariant = item.approved_is_print_on_demand === true
  const variants = item.approved_variant_prices ?? []
  const price = needsVariant ? variants.find((variant) => variant.id === variantId)?.price : item.approved_price

  async function select() {
    if (!ready) return
    if (needsVariant && !variantId) { setMessage('Choose a size and color first.'); return }
    if (preview) { setMessage(quote ? 'Preview: the quote request opens from here.' : 'Preview: this offer is added to your cart before checkout.'); return }
    setBusy(true)
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login?redirect=%2Fmember%2Fdashboard'); return }
      const response = await fetch(`/api/accelerated/member/recommendations/${item.id}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reviewedAt: item.reviewed_at, variantId }),
      })
      const result = await response.json()
      if (!response.ok) { setMessage(result.error || 'This offer changed. Ask for a new review.'); return }
      if (result.quoteBased) {
        if (!result.quoteOrderId) { setMessage('Quote order was not recorded. Try again from this dashboard.'); return }
        router.push(`/member/quote?orderId=${encodeURIComponent(result.quoteOrderId)}`)
        return
      }
      addRecommendedToCart({
        itemType: result.kind,
        offerId: result.offerId,
        recommendationId: result.recommendationId,
        reviewedAt: result.reviewedAt,
        reviewedPrice: Number(result.price),
        ...(result.variantId ? { variantId: result.variantId } : {}),
      })
      router.push('/checkout')
    } catch {
      setMessage('Selection is unavailable. Try again from this dashboard.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mt-3 space-y-2">
    {ready ? <>
      {!quote && <p className="text-sm text-platinum-white/75">{price == null ? 'Choose an option for the price' : `$${Number(price).toFixed(2)}`}</p>}
      {needsVariant && <label className="block max-w-sm text-sm text-platinum-white/80">
        Size and color
        <select value={variantId ?? ''} onChange={(event) => setVariantId(Number(event.target.value) || null)}
          className="mt-1 block w-full rounded border border-radiant-gold/40 bg-imperial-navy px-3 py-2 text-platinum-white">
          <option value="">Choose an option</option>
          {variants.map((variant) => <option key={variant.id} value={variant.id}>
            {[variant.size, variant.color].filter(Boolean).join(' · ') || `Variant ${variant.id}`} · ${Number(variant.price).toFixed(2)}
          </option>)}
        </select>
      </label>}
      <button type="button" onClick={() => void select()} disabled={busy || (needsVariant && !variantId)}
        className="inline-flex min-h-11 items-center rounded-md bg-radiant-gold px-4 py-2 font-semibold text-imperial-navy disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-radiant-gold">
        {busy ? 'Checking offer…' : quote ? 'Request a quote' : 'Select and buy'}
      </button>
    </> : <p className="text-sm text-amber-200">This offer needs a current price review before selection.</p>}
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
  </div>
}
