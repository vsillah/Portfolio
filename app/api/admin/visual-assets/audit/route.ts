import { NextRequest, NextResponse } from 'next/server'
import { auditVisualAssets } from '@/lib/visual-assets'
import { parseJsonBody, requireAdmin } from '../_utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if ('response' in admin) return admin.response

  try {
    const body = await parseJsonBody(request)
    const result = await auditVisualAssets({
      createWorkItem: body.createWorkItem !== false,
      auditDate: typeof body.auditDate === 'string' ? body.auditDate : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
