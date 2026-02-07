import { NextRequest, NextResponse } from 'next/server'
import { updateProgressUpdateLogStatus } from '@/lib/progress-update-templates'

export const dynamic = 'force-dynamic'

/**
 * POST /api/progress-updates/[id]/delivered
 * Callback endpoint for n8n to confirm delivery of a progress update.
 *
 * Body: {
 *   delivery_status: 'sent' | 'failed',
 *   error_message?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: logId } = await params
    const body = await request.json()

    const { delivery_status, error_message } = body

    if (!delivery_status || !['sent', 'failed'].includes(delivery_status)) {
      return NextResponse.json(
        { error: 'delivery_status must be "sent" or "failed"' },
        { status: 400 }
      )
    }

    const success = await updateProgressUpdateLogStatus(
      logId,
      delivery_status,
      error_message
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update delivery status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      log_id: logId,
      delivery_status,
    })
  } catch (error) {
    console.error(
      'Error in POST /api/progress-updates/[id]/delivered:',
      error
    )
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
