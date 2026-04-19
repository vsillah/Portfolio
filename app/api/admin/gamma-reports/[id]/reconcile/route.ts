import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getGenerationStatus } from '@/lib/gamma-client'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/gamma-reports/:id/reconcile
 *
 * Re-check Gamma for the stored `gamma_generation_id` and patch the row.
 *
 * Use case: our poll in `runGammaGeneration` times out at 5 min (10 min for
 * background auto-summary), but Gamma keeps rendering after we disconnect.
 * If a row is marked `failed` with a timeout error and the generation
 * actually succeeded on Gamma's side, this endpoint flips it back to
 * `completed` with the live `gamma_url` — no regeneration, no Gamma credits.
 *
 * Also handy for rows stuck on `generating` if the function invocation was
 * killed mid-poll.
 *
 * Behaviour:
 * - Gamma says `completed` → row `status = 'completed'`, `gamma_url` set.
 * - Gamma says `failed`    → row `status = 'failed'`, `error_message` updated.
 * - Gamma says `pending`   → row unchanged, 202.
 * - No `gamma_generation_id` on row → 400 (nothing to reconcile).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const reportId = params.id

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('gamma_reports')
    .select('id, status, gamma_generation_id, gamma_url, error_message')
    .eq('id', reportId)
    .single()

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Gamma report not found' }, { status: 404 })
  }

  if (!row.gamma_generation_id) {
    return NextResponse.json(
      { error: 'Row has no gamma_generation_id; nothing to reconcile' },
      { status: 400 }
    )
  }

  if (row.status === 'completed' && row.gamma_url) {
    return NextResponse.json({
      reportId,
      status: 'completed',
      gammaUrl: row.gamma_url,
      action: 'noop',
    })
  }

  let status
  try {
    status = await getGenerationStatus(row.gamma_generation_id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to query Gamma'
    console.error(`[gamma-reconcile] ${reportId} status check failed:`, msg)
    return NextResponse.json(
      { error: 'Failed to query Gamma for generation status', details: msg },
      { status: 502 }
    )
  }

  if (status.status === 'completed') {
    const { error: updateErr } = await supabaseAdmin
      .from('gamma_reports')
      .update({
        status: 'completed',
        gamma_url: status.gammaUrl ?? null,
        error_message: null,
      })
      .eq('id', reportId)

    if (updateErr) {
      // 23505 = partial unique index clash (another completed row exists for same audit)
      if (updateErr.code === '23505') {
        return NextResponse.json(
          {
            error:
              'Another completed audit_summary already exists for this audit; this row would duplicate it',
            code: updateErr.code,
          },
          { status: 409 }
        )
      }
      console.error(`[gamma-reconcile] ${reportId} update failed:`, updateErr)
      return NextResponse.json(
        { error: 'Failed to update gamma_reports row', details: updateErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      reportId,
      status: 'completed',
      gammaUrl: status.gammaUrl ?? null,
      action: 'recovered',
      credits: status.credits,
    })
  }

  if (status.status === 'failed') {
    const errMsg = status.error?.message ?? 'Gamma reported generation failed'
    await supabaseAdmin
      .from('gamma_reports')
      .update({ status: 'failed', error_message: errMsg })
      .eq('id', reportId)

    return NextResponse.json({
      reportId,
      status: 'failed',
      error: errMsg,
      action: 'marked_failed',
    })
  }

  return NextResponse.json(
    {
      reportId,
      status: 'pending',
      action: 'still_generating',
      message: 'Gamma is still rendering; retry reconcile in a minute or two.',
    },
    { status: 202 }
  )
}
