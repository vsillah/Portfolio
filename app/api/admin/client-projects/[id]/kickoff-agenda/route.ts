import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateKickoffAgenda } from '@/lib/kickoff-agenda'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/client-projects/[id]/kickoff-agenda
 * Fetch the kickoff agenda for a project (if one exists).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  const { data: agenda, error } = await supabaseAdmin
    .from('kickoff_agendas')
    .select('*')
    .eq('client_project_id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch agenda' }, { status: 500 })
  }

  return NextResponse.json({ agenda })
}

/**
 * POST /api/admin/client-projects/[id]/kickoff-agenda
 * Generate (or regenerate) a kickoff agenda from the onboarding plan.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  let senderName = 'Your Project Lead'
  try {
    const body = await request.json()
    if (body.sender_name) senderName = body.sender_name
  } catch {
    // No body is fine — use defaults
  }

  const result = await generateKickoffAgenda(id, senderName)
  if (!result) {
    return NextResponse.json(
      { error: 'Failed to generate kickoff agenda. Ensure the project has an onboarding plan.' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    agenda_id: result.agendaId,
    provisioning_items_created: result.provisioningCount,
  })
}

/**
 * PATCH /api/admin/client-projects/[id]/kickoff-agenda
 * Update agenda fields (edit scripts, change status, add notes).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json()

  const allowedFields = [
    'intro_script',
    'problem_statement',
    'timeline_script',
    'availability_script',
    'platform_signup_script',
    'wrapup_script',
    'status',
    'notes',
    'estimated_duration_minutes',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  if (body.status === 'used') {
    updateData.used_at = new Date().toISOString()
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('kickoff_agendas')
    .update(updateData)
    .eq('client_project_id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update agenda' }, { status: 500 })
  }

  return NextResponse.json({ agenda: data })
}
