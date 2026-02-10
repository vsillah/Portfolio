import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  triggerValueEvidenceExtraction,
  triggerSocialListening,
} from '@/lib/n8n'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/trigger
 * Manually trigger value evidence workflows
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { workflow } = body

  if (!workflow || !['internal_extraction', 'social_listening'].includes(workflow)) {
    return NextResponse.json(
      { error: 'workflow must be "internal_extraction" or "social_listening"' },
      { status: 400 }
    )
  }

  try {
    let result: { triggered: boolean; message: string }

    if (workflow === 'internal_extraction') {
      result = await triggerValueEvidenceExtraction()
    } else {
      result = await triggerSocialListening()
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Trigger error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger workflow', details: error.message },
      { status: 500 }
    )
  }
}
