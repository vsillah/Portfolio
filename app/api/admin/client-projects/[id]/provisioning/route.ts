import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  getProvisioningItems,
  updateProvisioningItemStatus,
  fireProvisioningReminder,
} from '@/lib/kickoff-agenda'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/client-projects/[id]/provisioning
 * List all provisioning items for a project.
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
  const items = await getProvisioningItems(id)

  return NextResponse.json({ items })
}

/**
 * POST /api/admin/client-projects/[id]/provisioning
 * Send a provisioning reminder via n8n (Slack or email).
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
  const result = await fireProvisioningReminder(id)

  if (!result.triggered) {
    return NextResponse.json(
      { error: result.message || 'Failed to send reminder' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    pending_count: result.pendingCount,
    message: `Reminder sent for ${result.pendingCount} pending items`,
  })
}

/**
 * PATCH /api/admin/client-projects/[id]/provisioning
 * Update a single provisioning item's status.
 * Body: { item_id, status, completed_by?, blocker_note? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  await params

  const body = await request.json()
  const { item_id, status, completed_by, blocker_note } = body

  if (!item_id || !status) {
    return NextResponse.json(
      { error: 'item_id and status are required' },
      { status: 400 }
    )
  }

  const validStatuses = ['pending', 'in_progress', 'complete', 'blocked', 'skipped']
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const success = await updateProvisioningItemStatus(
    item_id,
    status,
    completed_by,
    blocker_note
  )

  if (!success) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
