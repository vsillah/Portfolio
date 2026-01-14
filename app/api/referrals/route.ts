import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Get user's referrals
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { data: referrals, error } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('referrer_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ referrals: referrals || [] })
  } catch (error: any) {
    console.error('Error fetching referrals:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch referrals' },
      { status: 500 }
    )
  }
}

// Create referral or validate referral code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, referralCode, orderId } = body

    if (action === 'validate') {
      // Validate referral code
      if (!referralCode) {
        return NextResponse.json(
          { error: 'Referral code is required' },
          { status: 400 }
        )
      }

      const { data: referral, error } = await supabaseAdmin
        .from('referrals')
        .select('referrer_user_id, referral_code')
        .eq('referral_code', referralCode)
        .single()

      if (error || !referral) {
        return NextResponse.json(
          { error: 'Invalid referral code' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        valid: true,
        referrerUserId: referral.referrer_user_id,
      })
    } else if (action === 'apply') {
      // Apply referral to order
      const user = await getCurrentUser()
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      if (!referralCode || !orderId) {
        return NextResponse.json(
          { error: 'Referral code and order ID are required' },
          { status: 400 }
        )
      }

      // Find referral
      const { data: referral, error: refError } = await supabaseAdmin
        .from('referrals')
        .select('id, referrer_user_id')
        .eq('referral_code', referralCode)
        .single()

      if (refError || !referral) {
        return NextResponse.json(
          { error: 'Invalid referral code' },
          { status: 404 }
        )
      }

      // Don't allow self-referral
      if (referral.referrer_user_id === user.id) {
        return NextResponse.json(
          { error: 'Cannot use your own referral code' },
          { status: 400 }
        )
      }

      // Update referral with order
      const discountAmount = 10 // $10 discount for referrer
      const { error: updateError } = await supabaseAdmin
        .from('referrals')
        .update({
          order_id: parseInt(orderId),
          discount_applied: discountAmount,
        })
        .eq('id', referral.id)

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        discountAmount,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error processing referral:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process referral' },
      { status: 500 }
    )
  }
}
