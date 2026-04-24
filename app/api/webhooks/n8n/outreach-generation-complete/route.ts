import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/n8n/outreach-generation-complete
 *
 * Authoritative ack from WF-CLG-002 (outreach generation) about a run's final
 * outcome. Lets the app mark `last_n8n_outreach_status` as `success` or `failed`
 * without waiting on the 20-minute DB reconcile fallback.
 *
 * Contract with n8n:
 *   - Success path: final HTTP node in the happy path posts `{ status: 'success' }`
 *     after a draft is written (or use success only if the DB insert trigger
 *     is guaranteed; usually success is inferred from the queue row).
 *   - Failure path: dedicated "Error Workflow" (Error Trigger) posts
 *     `{ status: 'failed', error_message }`.
 *   - **Early / alternate branches (IF, Switch) that do NOT insert a row:**
 *     n8n still shows Execution Succeeded, but the app would stay `pending`
 *     forever. Add a manual HTTP node on *every* terminal no-draft branch
 *     that POSTs here with `status: 'failed'` and `error_message` explaining
 *     the skip (e.g. lead did not pass "Already Contacted" gate).
 *
 * We only transition rows that are currently `pending` so we never clobber a
 * manual override (e.g. admin already dismissed the pill).
 *
 * Auth: Bearer N8N_INGEST_SECRET (same secret the other n8n→app webhooks use).
 *
 * Body:
 *   {
 *     contact_submission_id: number | string,
 *     status: 'success' | 'failed',
 *     error_message?: string,
 *     template_key?: string
 *   }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET
  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    contact_submission_id?: number | string
    status?: string
    error_message?: string
    template_key?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawId = body.contact_submission_id
  const contactId = typeof rawId === 'number' ? rawId : parseInt(String(rawId ?? ''), 10)
  if (!Number.isFinite(contactId) || contactId <= 0) {
    return NextResponse.json(
      { error: 'contact_submission_id is required (positive integer)' },
      { status: 400 }
    )
  }

  const status = body.status === 'success' || body.status === 'failed' ? body.status : null
  if (!status) {
    return NextResponse.json(
      { error: "status is required and must be 'success' or 'failed'" },
      { status: 400 }
    )
  }

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  if (status === 'failed' && body.error_message) {
    console.warn('[outreach-generation-complete] n8n reported failure', {
      contactId,
      template_key: body.template_key,
      error_message: body.error_message,
    })
  }

  // Only flip rows currently in `pending`. Don't overwrite a manual `failed`
  // (user hit Cancel) or a `success` already set by the queue-insert trigger.
  const { data, error } = await sb
    .from('contact_submissions')
    .update({ last_n8n_outreach_status: status })
    .eq('id', contactId)
    .eq('last_n8n_outreach_status', 'pending')
    .select('id, last_n8n_outreach_status')

  if (error) {
    console.error('[outreach-generation-complete] update error:', error)
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }

  const updated = Array.isArray(data) && data.length > 0
  return NextResponse.json({
    ok: true,
    contact_submission_id: contactId,
    status,
    updated,
    note: updated
      ? undefined
      : 'Row was not in pending state; no change applied (likely already resolved).',
  })
}
