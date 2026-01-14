import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user already has a referral code
    const { data: existingReferral } = await supabaseAdmin
      .from('referrals')
      .select('referral_code')
      .eq('referrer_user_id', user.id)
      .limit(1)
      .single()

    if (existingReferral) {
      return NextResponse.json({
        referralCode: existingReferral.referral_code,
      })
    }

    // Generate new referral code
    const referralCode = `REF${user.id.substring(0, 8).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create referral entry
    const { error } = await supabaseAdmin
      .from('referrals')
      .insert({
        referrer_user_id: user.id,
        referral_code: referralCode,
      })

    if (error) throw error

    return NextResponse.json({
      referralCode,
    })
  } catch (error: any) {
    console.error('Error generating referral code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate referral code' },
      { status: 500 }
    )
  }
}
