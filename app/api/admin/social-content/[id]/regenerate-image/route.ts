import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { isN8nOutboundDisabled, n8nWebhookUrl } from '@/lib/n8n'

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

    const updateFields: Record<string, unknown> = {
      image_prompt,
      content_format: 'single_image',
      carousel_slides: null,
      carousel_pdf_url: null,
      carousel_slide_urls: null,
    }
    if (framework_visual_type) {
      updateFields.framework_visual_type = framework_visual_type
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update(updateFields)
      .eq('id', id)

    // Trigger image regeneration via n8n (never use N8N_SOC001_WEBHOOK_URL — that is the extract workflow)
    const webhookUrl =
      process.env.N8N_SOC_REGENERATE_IMAGE_WEBHOOK_URL ||
      n8nWebhookUrl('social-content-regenerate-image')

    let triggered = false
    let n8nImageUrl: string | null = null
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
        try {
          const bodyText = await res.clone().text()
          const parsed = JSON.parse(bodyText)
          if (parsed.image_url) n8nImageUrl = parsed.image_url
        } catch {
          /* ignore parse errors */
        }
        triggered = res.ok
      } catch (err) {
        console.error('Failed to trigger image regeneration:', err)
      }
    }

    return NextResponse.json({
      triggered,
      image_url: n8nImageUrl,
      message: triggered
        ? 'Image regeneration triggered. The new image will appear shortly.'
        : 'Could not trigger image regeneration. Check n8n workflow status.',
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/regenerate-image:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
