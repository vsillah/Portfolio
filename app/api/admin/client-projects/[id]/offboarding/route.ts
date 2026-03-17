import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  initializeOffboarding,
  markOffboardingStep,
  type OffboardingStep,
} from '@/lib/kickoff-agenda'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/client-projects/[id]/offboarding
 * Fetch the offboarding checklist for a project.
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

  const { data, error } = await supabaseAdmin
    .from('offboarding_checklists')
    .select('*')
    .eq('client_project_id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch offboarding checklist' }, { status: 500 })
  }

  return NextResponse.json({ checklist: data })
}

/**
 * POST /api/admin/client-projects/[id]/offboarding
 * Initialize the offboarding checklist for a project.
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
  const checklistId = await initializeOffboarding(id)

  if (!checklistId) {
    return NextResponse.json(
      { error: 'Failed to initialize offboarding' },
      { status: 500 }
    )
  }

  return NextResponse.json({ checklist_id: checklistId })
}

/**
 * PATCH /api/admin/client-projects/[id]/offboarding
 * Mark an offboarding step as complete.
 * Body: { step: OffboardingStep }
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
  const { step } = body

  const validSteps: OffboardingStep[] = [
    'delivery_confirmed',
    'client_confirmed',
    'warranty_activated',
    'access_revoked',
    'slack_archived',
    'final_invoice_sent',
    'completed',
  ]

  if (!step || !validSteps.includes(step)) {
    return NextResponse.json(
      { error: `Invalid step. Must be one of: ${validSteps.join(', ')}` },
      { status: 400 }
    )
  }

  const success = await markOffboardingStep(id, step)

  if (!success) {
    return NextResponse.json({ error: 'Failed to mark step' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
