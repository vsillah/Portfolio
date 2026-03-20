import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { N8N_BASE_URL, isN8nOutboundDisabled } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/[id]/regenerate-image
 * Re-generate the framework illustration with an updated prompt
 * Delegates to n8n sub-workflow for actual Gemini API call + storage upload
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
    const body = await request.json()
    const { image_prompt, framework_visual_type } = body

    if (!image_prompt) {
      return NextResponse.json({ error: 'image_prompt is required' }, { status: 400 })
    }

    // Update the prompt in the queue
    const updateFields: Record<string, unknown> = { image_prompt }
    if (framework_visual_type) {
      updateFields.framework_visual_type = framework_visual_type
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update(updateFields)
      .eq('id', id)

    // Trigger image regeneration via n8n
    const webhookUrl = process.env.N8N_SOC001_WEBHOOK_URL
      || `${N8N_BASE_URL}/webhook/social-content-regenerate-image`

    let triggered = false
    if (isN8nOutboundDisabled()) {
      console.log(`[N8N_DISABLED] regenerate-image → ${webhookUrl}`)
    } else {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'regenerate_image',
            content_id: id,
            image_prompt,
            framework_visual_type: framework_visual_type || null,
          }),
        })
        triggered = res.ok
      } catch (err) {
        console.error('Failed to trigger image regeneration:', err)
      }
    }

    return NextResponse.json({ triggered, message: triggered
      ? 'Image regeneration triggered. The new image will appear shortly.'
      : 'Could not trigger image regeneration. Check n8n workflow status.'
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/regenerate-image:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
