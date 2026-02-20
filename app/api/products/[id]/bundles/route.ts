/**
 * Public API: Bundles that contain a given product
 * Returns bundles (pricing tiers) where this product appears, for "Available in packages" links
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { expandBundleItems } from '@/lib/bundle-expand'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id } = await Promise.resolve(params)

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Fetch active bundles that appear on pricing page
    const { data: bundles, error } = await supabaseAdmin
      .from('offer_bundles')
      .select('id, name, pricing_tier_slug, pricing_page_segments')
      .eq('is_active', true)
      .neq('bundle_type', 'custom')

    if (error) {
      console.error('Error fetching bundles:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bundles' },
        { status: 500 }
      )
    }

    const result: Array<{ bundleId: string; name: string; slug: string; segment: string; pricingUrl: string }> = []

    for (const bundle of bundles || []) {
      const items = await expandBundleItems(bundle.id)
      const containsProduct = items.some(
        (item) => item.content_type === 'product' && String(item.content_id) === String(id)
      )
      if (!containsProduct) continue

      const slug = bundle.pricing_tier_slug || bundle.id
      const segments = (bundle.pricing_page_segments as string[]) || ['smb']

      for (const segment of segments) {
        const pricingUrl = `/pricing?segment=${segment}#${slug}`
        result.push({
          bundleId: bundle.id,
          name: bundle.name,
          slug,
          segment,
          pricingUrl,
        })
      }
    }

    return NextResponse.json({ bundles: result })
  } catch (error: unknown) {
    console.error('Error in products bundles route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch bundles' },
      { status: 500 }
    )
  }
}
