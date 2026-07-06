import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { listSocialContentCalibrationReferences } from '@/lib/social-content-calibration-library'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'linkedin'
    const references = listSocialContentCalibrationReferences({ platform })

    return NextResponse.json({
      references,
      source: 'approved_calibration_library',
      side_effects: {
        provider_generation: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  } catch (error) {
    console.error('[social-content-calibration-library] list failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calibration references' },
      { status: 500 },
    )
  }
}
