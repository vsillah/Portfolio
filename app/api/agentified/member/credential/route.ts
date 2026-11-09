import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { AGENTIFIED_VERSION, agentifiedLessons } from '@/lib/agentified-workshop'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return fail('Sign in to view your completion credential.', 401)
  const [credential, completion] = await Promise.all([
    supabaseAdmin.from('accelerated_completion_credentials').select('learner_name,completed_at,verification_token,revision').eq('user_id', auth.user.id).eq('content_version', AGENTIFIED_VERSION).maybeSingle(),
    supabaseAdmin.from('accelerated_member_lessons').select('lesson_id').eq('user_id', auth.user.id).eq('content_version', AGENTIFIED_VERSION).not('completed_at', 'is', null),
  ])
  // The existing member dashboard must still load before this staged migration reaches production.
  if (credential.error && ['42P01', 'PGRST205'].includes(credential.error.code)) return NextResponse.json({ available: false, eligible: false, completedCount: 0, credential: null }, { headers })
  if (credential.error || completion.error) return fail('Completion status is temporarily unavailable.', 503)
  const completed = new Set((completion.data ?? []).map((row: { lesson_id: string }) => row.lesson_id))
  return NextResponse.json({ available: true, eligible: agentifiedLessons.every((lesson) => completed.has(lesson.id)), completedCount: completed.size, credential: credential.data }, { headers })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) return fail('Sign in to claim your completion credential.', 401)
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail('Invalid credential request.', 400) }
  const action = body.action
  if (action === 'claim') {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 120) return fail('Enter the name to appear on your credential.', 400)
    const { data, error } = await supabaseAdmin.rpc('accelerated_claim_completion_credential', {
      p_user_id: auth.user.id, p_version: AGENTIFIED_VERSION, p_name: name, p_token: randomBytes(32).toString('hex'),
    })
    if (error) return error.code === 'P0001' ? fail(error.message, 409) : fail('Credential could not be claimed.', 503)
    const row = data?.[0]
    if (!row) return fail('Credential receipt is unavailable.', 503)
    return NextResponse.json({ credential: row }, { status: row.replay ? 200 : 201, headers })
  }
  if (action === 'revoke' || action === 'rotate') {
    if (!Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 1) return fail('Reload the current credential link first.', 400)
    const { data, error } = await supabaseAdmin.rpc('accelerated_change_completion_link', {
      p_user_id: auth.user.id, p_version: AGENTIFIED_VERSION, p_expected_revision: body.expectedRevision,
      p_action: action, p_token: action === 'rotate' ? randomBytes(32).toString('hex') : null,
    })
    if (error) return error.code === 'P0001' ? fail(error.message, 409) : fail('Credential link could not be changed.', 503)
    const row = data?.[0]
    if (!row) return fail('Link change receipt is unavailable.', 503)
    return NextResponse.json({ link: row }, { headers })
  }
  return fail('Invalid credential action.', 400)
}
