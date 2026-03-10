import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { N8N_BASE_URL } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/[id]/approve
 * Approve content and trigger the publishing workflow (WF-SOC-002)
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

    const { id } = params

    const { data: item, error: fetchError } = await supabaseAdmin
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

    const { data: updated, error: updateError } = await supabaseAdmin
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

    // Trigger WF-SOC-002 publishing workflow
    const webhookUrl = process.env.N8N_SOC002_WEBHOOK_URL
      || `${N8N_BASE_URL}/webhook/social-content-publish`

    let publishTriggered = false
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: updated.id,
          platform: updated.platform,
          post_text: updated.post_text,
          cta_text: updated.cta_text,
          cta_url: updated.cta_url,
          hashtags: updated.hashtags,
          image_url: updated.image_url,
          voiceover_url: updated.voiceover_url,
        }),
      })
      publishTriggered = res.ok
    } catch (err) {
      console.error('Failed to trigger publish workflow:', err)
    }

    return NextResponse.json({
      item: updated,
      publish_triggered: publishTriggered,
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/approve:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
