import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  generateOutreachDraftInApp,
  isInAppOutreachGenerationEnabled,
  MEETING_SUMMARY_MAX_CHARS,
} from '@/lib/outreach-queue-generator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/leads/:id/generate-in-app
 *
 * Generates a cold-outreach email draft via OpenAI and inserts into outreach_queue.
 * Does not call n8n WF-CLG-002. See docs/admin-sales-lead-pipeline-sop.md for parity notes.
 *
 * Body (optional): { sequence_step?: number, force?: boolean, meeting_summary?: string, skip_meeting_context?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolved = await Promise.resolve(params)
  const contactId = parseInt(resolved.id, 10)
  if (Number.isNaN(contactId) || contactId < 1) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  if (!isInAppOutreachGenerationEnabled()) {
    return NextResponse.json(
      { error: 'This action is temporarily unavailable. Please try again later.' },
      { status: 503 }
    )
  }

  let body: {
    sequence_step?: number
    force?: boolean
    meeting_summary?: string
    skip_meeting_context?: boolean
  } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (body.meeting_summary != null && typeof body.meeting_summary === 'string') {
    if (body.meeting_summary.length > MEETING_SUMMARY_MAX_CHARS) {
      return NextResponse.json(
        { error: `Meeting summary must be at most ${MEETING_SUMMARY_MAX_CHARS} characters.` },
        { status: 400 }
      )
    }
  }

  const sequenceStep =
    typeof body.sequence_step === 'number' && body.sequence_step >= 1 && body.sequence_step <= 6
      ? body.sequence_step
      : 1
  const force = body.force === true

  try {
    const result = await generateOutreachDraftInApp({
      contactId,
      sequenceStep,
      force,
      meetingSummary: body.meeting_summary ?? null,
      includeLatestMeeting: body.skip_meeting_context !== true,
    })

    if (result.outcome === 'skipped') {
      console.info('[generate-in-app] skipped draft_exists', {
        contactId,
        sequenceStep,
        force,
      })
      return NextResponse.json(
        {
          error: 'A draft message already exists for this lead at this sequence step. Use force to create another.',
          outcome: 'skipped',
          reason: 'draft_exists',
        },
        { status: 409 }
      )
    }

    console.info('[generate-in-app] created', {
      contactId,
      sequenceStep,
      force,
      outreach_queue_id: result.id,
    })

    if (supabaseAdmin) {
      const nowIso = new Date().toISOString()
      const { error: n8nStatusErr } = await supabaseAdmin
        .from('contact_submissions')
        .update({
          last_n8n_outreach_triggered_at: nowIso,
          last_n8n_outreach_status: 'success',
          last_n8n_outreach_template_key: 'in_app',
        })
        .eq('id', contactId)
      if (n8nStatusErr) {
        console.warn('[generate-in-app] last_n8n status update', n8nStatusErr.message)
      }
    }

    return NextResponse.json({
      outcome: 'created',
      id: result.id,
      subject: result.subject,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-in-app] error', { contactId, sequenceStep, force, message })

    if (message === 'Lead not found') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    if (message === 'Lead is marked as do-not-contact') {
      return NextResponse.json({ error: 'Lead is marked as do-not-contact' }, { status: 400 })
    }
    if (message === 'Lead has been removed') {
      return NextResponse.json({ error: 'Lead has been removed' }, { status: 400 })
    }
    if (message === 'OPENAI_API_KEY not configured') {
      return NextResponse.json(
        { error: 'Something went wrong. Please try again later.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
