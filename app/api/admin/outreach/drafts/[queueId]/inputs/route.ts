/**
 * GET /api/admin/outreach/drafts/:queueId/inputs
 *
 * Phase 2 transparency endpoint. Returns the structured generation trace that
 * was persisted into outreach_queue.generation_inputs at draft creation time
 * (plus a few sibling columns admins always want to see together: model,
 * prompt summary, status, channel, created_at). Used by the "Why this draft?"
 * popover next to each row in the recent-drafts list.
 *
 * Drafts produced before Phase 2 (or by the deactivated n8n workflow) will
 * have `generation_inputs: null` — the UI should treat that as "trace not
 * recorded" rather than an error.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function GET(
  request: NextRequest,
  { params }: { params: { queueId: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const queueId = params.queueId
  if (!queueId || !UUID_RE.test(queueId)) {
    return NextResponse.json({ error: 'Invalid draft id' }, { status: 400 })
  }

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { data, error } = await sb
    .from('outreach_queue')
    .select(
      'id, channel, status, sequence_step, contact_submission_id, ' +
        'subject, created_at, ' +
        'generation_model, generation_prompt_summary, generation_inputs',
    )
    .eq('id', queueId)
    .maybeSingle()

  if (error) {
    console.error('[drafts/inputs] lookup failed:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    contactSubmissionId: data.contact_submission_id,
    channel: data.channel,
    status: data.status,
    sequenceStep: data.sequence_step,
    subject: data.subject ?? null,
    createdAt: data.created_at,
    generationModel: data.generation_model ?? null,
    generationPromptSummary: data.generation_prompt_summary ?? null,
    generationInputs: data.generation_inputs ?? null,
  })
}
