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
  const conversion = body.source === 'checkout_conversion'
  const orderId = Number(body.orderId)
  if (typeof body.userId !== 'string' || !uuid.test(body.userId) || typeof body.projectId !== 'string' || !uuid.test(body.projectId) ||
    !['operator_action', 'checkout_conversion'].includes(String(body.source)) ||
    (conversion && (!Number.isSafeInteger(orderId) || orderId <= 0)) ||
    (!conversion && body.orderId != null))
    return NextResponse.json({ error: 'A verified user, project, and conversion source are required.' }, { status: 400 })
  const [user, project] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('id').eq('id', body.userId).maybeSingle(),
    supabaseAdmin.from('client_projects').select('id').eq('id', body.projectId).maybeSingle(),
  ])
  if (user.error || project.error) return NextResponse.json({ error: 'Could not verify membership targets.' }, { status: 503 })
  if (!user.data || !project.data) return NextResponse.json({ error: 'User or project not found.' }, { status: 404 })
  let workshopIntakeId: string | null = null
  if (conversion) {
    const order = await supabaseAdmin.from('orders')
      .select('id,user_id,status,stripe_payment_intent_id,workshop_intake_id')
      .eq('id', orderId).eq('user_id', body.userId).maybeSingle()
    if (order.error) return NextResponse.json({ error: 'Could not verify the paid order.' }, { status: 503 })
    if (!order.data || order.data.status !== 'completed' || !order.data.stripe_payment_intent_id || !order.data.workshop_intake_id)
      return NextResponse.json({ error: 'A paid workshop order with exact intake lineage is required.' }, { status: 409 })
    workshopIntakeId = order.data.workshop_intake_id
  }
  const result = await supabaseAdmin.from('verified_client_project_memberships').insert({
    user_id: body.userId, client_project_id: body.projectId, verification_source: body.source, verified_by: admin.user.id,
    ...(conversion ? { source_order_id: orderId, workshop_intake_id: workshopIntakeId } : {}),
  })
  if (result.error?.code === '23505') {
    const existing = await supabaseAdmin.from('verified_client_project_memberships')
      .select('user_id,client_project_id,verification_source,source_order_id,workshop_intake_id')
      .eq(conversion ? 'source_order_id' : 'user_id', conversion ? orderId : body.userId)
      .eq('client_project_id', body.projectId).maybeSingle()
    if (!existing.error && existing.data?.user_id === body.userId &&
      existing.data.verification_source === body.source &&
      (!conversion || existing.data.workshop_intake_id === workshopIntakeId))
      return NextResponse.json({ linked: true, replay: true }, { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ error: 'This order or project is already linked elsewhere.' }, { status: 409 })
  }
  if (result.error) return NextResponse.json({ error: 'Could not link project.' }, { status: 503 })
  return NextResponse.json({ linked: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
