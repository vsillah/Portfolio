import { NextRequest, NextResponse } from 'next/server'
import { recoverSlackReceipts } from '@/lib/slack-action-receipts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await recoverSlackReceipts()
    return NextResponse.json(result, { status: result.failed ? 503 : 200 })
  } catch { return NextResponse.json({ error: 'Receipt recovery failed' }, { status: 503 }) }
}
