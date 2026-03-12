import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { printful } from '@/lib/printful'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/printful/test-connection
 * Verifies Printful API key and connectivity without creating any order.
 * Uses getProducts() and, if we have a linked variant, estimateOrder() to confirm the API works.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!process.env.PRINTFUL_API_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'PRINTFUL_API_KEY is not set' },
      { status: 200 }
    )
  }

  try {
    // 1. List store products (proves API key and connectivity)
    const products = await printful.getProducts()
    if (!products || products.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'Printful connection OK. No sync products in store yet — sync from Admin → Content → Merchandise to add products.',
      })
    }

    // 2. Optionally run a cost estimate with a real variant (proves order API path without creating an order)
    const { data: variantRow } = await supabaseAdmin
      .from('product_variants')
      .select('printful_variant_id')
      .not('printful_variant_id', 'is', null)
      .limit(1)
      .single()

    if (variantRow?.printful_variant_id) {
      const estimate = await printful.estimateOrder([
        { variant_id: Number(variantRow.printful_variant_id), quantity: 1 },
      ])
      const total = estimate?.costs?.total ?? '0'
      return NextResponse.json({
        ok: true,
        message: `Printful connection OK. ${products.length} product(s) in store. Cost estimate for 1 item: $${total} (no order was created).`,
        productCount: products.length,
        estimateTotal: total,
      })
    }

    return NextResponse.json({
      ok: true,
      message: `Printful connection OK. ${products.length} product(s) in store. Link a variant to a Printful variant and re-run to test cost estimate.`,
      productCount: products.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/printful/test-connection]', err)
    return NextResponse.json(
      { ok: false, error: message },
      { status: 200 }
    )
  }
}
