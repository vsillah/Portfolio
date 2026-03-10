import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { N8N_BASE_URL } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/social-content/[id]/regenerate-audio
 * Re-generate the ElevenLabs voiceover with updated text
 * Delegates to n8n sub-workflow for actual ElevenLabs API call + storage upload
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
    const { voiceover_text } = body

    if (!voiceover_text) {
      return NextResponse.json({ error: 'voiceover_text is required' }, { status: 400 })
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update({ voiceover_text })
      .eq('id', id)

    // Trigger audio regeneration via n8n
    const webhookUrl = process.env.N8N_SOC001_WEBHOOK_URL
      || `${N8N_BASE_URL}/webhook/social-content-regenerate-audio`

    let triggered = false
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate_audio',
          content_id: id,
          voiceover_text,
        }),
      })
      triggered = res.ok
    } catch (err) {
      console.error('Failed to trigger audio regeneration:', err)
    }

    return NextResponse.json({ triggered, message: triggered
      ? 'Audio regeneration triggered. The new voiceover will appear shortly.'
      : 'Could not trigger audio regeneration. Check n8n workflow status.'
    })
  } catch (error) {
    console.error('Error in POST /api/admin/social-content/[id]/regenerate-audio:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
