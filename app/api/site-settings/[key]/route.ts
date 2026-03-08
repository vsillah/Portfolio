import { NextRequest, NextResponse } from 'next/server'
import { getSiteSetting } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ key: string }>
}

/**
 * GET /api/site-settings/:key
 * Public read-only endpoint for a single site setting.
 * Used by n8n workflows (e.g. WF-GDR) to fetch business_owner_email.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { key } = await params

  const allowedKeys = ['business_owner_email']
  if (!allowedKeys.includes(key)) {
    return NextResponse.json({ error: 'Setting not found' }, { status: 404 })
  }

  const value = await getSiteSetting(key)
  if (value === null) {
    return NextResponse.json({ error: 'Setting not found' }, { status: 404 })
  }

  return NextResponse.json({ key, value })
}
