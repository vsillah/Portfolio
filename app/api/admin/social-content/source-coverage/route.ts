import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { collectLiveSocialTopicCoverage } from '@/lib/social-topic-source-coverage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const coverage = await collectLiveSocialTopicCoverage({ persist: false })
    return NextResponse.json({ coverage })
  } catch (error) {
    console.error('[social-topic-source-coverage] read failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to read source coverage',
    }, { status: 500 })
  }
}
