import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-update-drafts/[id]/delivered
 *
 * Callback endpoint for n8n to confirm that a client-update email
 * was actually delivered. Updates the draft status to 'sent' with
 * delivery metadata.
 *
 * Auth: Uses N8N_INGEST_SECRET header for webhook authentication
 * (same pattern as other n8n callback endpoints).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify n8n webhook secret
    const ingestSecret = process.env.N8N_INGEST_SECRET
    if (ingestSecret) {
      const authHeader = request.headers.get('x-ingest-secret') || ''
      if (authHeader !== ingestSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { id: draftId } = await params
    const body = await request.json().catch(() => ({}))
    const channel = body.channel || 'email'

    // Conditional update: only mark as sent if still in 'draft' status
    // This prevents double-send race conditions
    const { data: draft, error } = await supabaseAdmin
      .from('client_update_drafts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_via: channel,
      })
      .eq('id', draftId)
      .eq('status', 'draft') // Only update if still a draft (prevents double-send)
      .select('id, status')
      .single()

    if (error || !draft) {
      // Could be already sent (race) or not found
      return NextResponse.json(
        { acknowledged: true, already_sent: true },
        { status: 200 }
      )
    }

    return NextResponse.json({ acknowledged: true, draft_id: draft.id })
  } catch (error) {
    console.error('[Draft delivered callback] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
