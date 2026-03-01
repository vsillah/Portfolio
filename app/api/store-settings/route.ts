import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** Shape of social_share_discount in store_settings */
export interface SocialShareDiscountSetting {
  type: 'fixed' | 'percentage'
  value: number
}

const DEFAULT_SOCIAL_SHARE_DISCOUNT: SocialShareDiscountSetting = {
  type: 'fixed',
  value: 5,
}

/**
 * GET /api/store-settings
 * Public: returns store settings used by the storefront (e.g. social share reward for prefill message).
 */
export async function GET() {
  try {
    const { data: row, error } = await supabaseAdmin
      .from('store_settings')
      .select('value')
      .eq('key', 'social_share_discount')
      .single()

    if (error || !row?.value) {
      return NextResponse.json({
        social_share_discount: DEFAULT_SOCIAL_SHARE_DISCOUNT,
      })
    }

    const v = row.value as { type?: string; value?: number }
    const social_share_discount: SocialShareDiscountSetting = {
      type: v.type === 'percentage' ? 'percentage' : 'fixed',
      value: typeof v.value === 'number' && v.value >= 0 ? v.value : DEFAULT_SOCIAL_SHARE_DISCOUNT.value,
    }

    return NextResponse.json({ social_share_discount })
  } catch (err) {
    console.error('GET /api/store-settings:', err)
    return NextResponse.json(
      { social_share_discount: DEFAULT_SOCIAL_SHARE_DISCOUNT },
      { status: 200 }
    )
  }
}
