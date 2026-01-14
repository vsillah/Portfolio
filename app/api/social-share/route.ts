import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, platform, shareUrl } = body

    if (!orderId || !platform) {
      return NextResponse.json(
        { error: 'Order ID and platform are required' },
        { status: 400 }
      )
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify order belongs to user
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order || order.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Order not found or unauthorized' },
        { status: 404 }
      )
    }

    // Check if already shared on this platform
    const { data: existingShare } = await supabaseAdmin
      .from('social_shares')
      .select('id')
      .eq('order_id', orderId)
      .eq('platform', platform)
      .eq('user_id', user.id)
      .single()

    if (existingShare) {
      return NextResponse.json({
        success: true,
        alreadyShared: true,
        discountEarned: 0,
      })
    }

    // Discount earned per share (configurable)
    const discountEarned = 5 // $5 or 5% - adjust as needed

    // Record share
    const { data: share, error: shareError } = await supabaseAdmin
      .from('social_shares')
      .insert({
        user_id: user.id,
        order_id: orderId,
        platform,
        share_url: shareUrl,
        discount_earned: discountEarned,
      })
      .select()
      .single()

    if (shareError) throw shareError

    return NextResponse.json({
      success: true,
      share,
      discountEarned,
    })
  } catch (error: any) {
    console.error('Error recording social share:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record share' },
      { status: 500 }
    )
  }
}
