import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeAttribution, scoreTrace, TRACE_CONSENT_VERSION, TRACE_SOURCE } from '@/lib/decision-traceability'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  if (body.website) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  if (body.consent !== true || body.consentVersion !== TRACE_CONSENT_VERSION) return NextResponse.json({ error: 'Review and select the email consent checkbox.' }, { status: 400 })
  const score = scoreTrace(body.answers)
  const attribution = normalizeAttribution(body.attribution)
  if (!score || !attribution || typeof body.submissionKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submissionKey)) {
    return NextResponse.json({ error: 'Complete the scorecard and try again.' }, { status: 400 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'We cannot take your follow-up request right now. Your score and worksheet are still available. Please try later.' }, { status: 503 })

  let error: { code?: string } | null
  try {
    const result = await supabaseAdmin.from('decision_traceability_leads').insert({
      campaign: TRACE_SOURCE,
      email,
      score: score.total,
      weakest_dimension: score.weakest,
      consent_version: TRACE_CONSENT_VERSION,
      source_path: '/decision-traceability-scorecard',
      ...attribution,
      submission_key: body.submissionKey,
    })
    error = result.error
  } catch {
    return NextResponse.json({ error: 'We cannot take your follow-up request right now. Your score and worksheet are still available. Please try later.' }, { status: 503 })
  }
  if (error?.code === '23505') return NextResponse.json({ status: 'duplicate', message: 'We already received a request for this email.' }, { status: 200 })
  if (error) return NextResponse.json({ error: 'We cannot take your follow-up request right now. Your score and worksheet are still available. Please try later.' }, { status: 503 })
  return NextResponse.json({ status: 'saved' }, { status: 201 })
}
