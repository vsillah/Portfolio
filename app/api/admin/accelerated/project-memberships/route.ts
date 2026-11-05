import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request)
  if (isAuthError(admin)) return NextResponse.json({ error: admin.error }, { status: admin.status })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid membership request.' }, { status: 400 }) }
  if (typeof body.userId !== 'string' || !uuid.test(body.userId) || typeof body.projectId !== 'string' || !uuid.test(body.projectId) || body.source !== 'operator_action') return NextResponse.json({ error: 'A verified user, project, and operator action are required.' }, { status: 400 })
  const [user, project] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('id').eq('id', body.userId).maybeSingle(),
    supabaseAdmin.from('client_projects').select('id').eq('id', body.projectId).maybeSingle(),
  ])
  if (user.error || project.error) return NextResponse.json({ error: 'Could not verify membership targets.' }, { status: 503 })
  if (!user.data || !project.data) return NextResponse.json({ error: 'User or project not found.' }, { status: 404 })
  const result = await supabaseAdmin.from('verified_client_project_memberships').insert({ user_id: body.userId, client_project_id: body.projectId, verification_source: body.source, verified_by: admin.user.id })
  if (result.error?.code === '23505') return NextResponse.json({ linked: true, replay: true }, { headers: { 'Cache-Control': 'no-store' } })
  if (result.error) return NextResponse.json({ error: 'Could not link project.' }, { status: 503 })
  return NextResponse.json({ linked: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
