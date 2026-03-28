import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import type { SocialPlatform } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/[id]/approve
 * Approve content, create per-platform publish records, and trigger immediate publishing
 * if no scheduled_for date is set. For scheduled posts, WF-SOC-003 handles later dispatch.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { id } = params

    const { data: item, error: fetchError } = await admin
      .from('social_content_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    if (item.status === 'published') {
      return NextResponse.json({ error: 'Content is already published' }, { status: 400 })
    }

    // Update status to approved
    const { data: updated, error: updateError } = await admin
      .from('social_content_queue')
      .update({
        status: 'approved',
        reviewed_by: authResult.user.id,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error approving content:', updateError)
      return NextResponse.json({ error: 'Failed to approve content' }, { status: 500 })
    }

    // Create social_content_publishes rows — one per target platform
    const targetPlatforms: SocialPlatform[] = updated.target_platforms?.length
      ? updated.target_platforms
      : ['linkedin']

    const publishRows = targetPlatforms.map((platform: SocialPlatform) => ({
      content_id: id,
      platform,
      status: 'pending' as const,
    }))

    const { error: insertError } = await admin
      .from('social_content_publishes')
      .upsert(publishRows, { onConflict: 'content_id,platform' })

    if (insertError) {
      console.error('Error creating publish records:', insertError)
    }

    // If no scheduled_for → trigger immediate publish via internal API
    let publishTriggered = false
    if (!updated.scheduled_for) {
      try {
        const origin = new URL(request.url).origin
        const publishRes = await fetch(`${origin}/api/admin/social-content/${id}/publish`, {
          method: 'POST',
          headers: {
            Authorization: request.headers.get('authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platforms: targetPlatforms }),
        })
        publishTriggered = publishRes.ok
      } catch (err) {
        console.error('Failed to trigger publish:', err)
      }
    }

    // Load publish records for the response
    const { data: publishes } = await admin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)

    return NextResponse.json({
      item: updated,
      publish_triggered: publishTriggered,
      publishes,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
