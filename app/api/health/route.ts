import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { describeN8nRuntimeFlags } from '@/lib/n8n-runtime-flags'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Lightweight health check — no auth required.
 * Returns { ok, timestamp, db } where db indicates Supabase connectivity.
 */
export async function GET() {
  let dbOk = false

  try {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('site_settings')
        .select('id')
        .limit(1)
        .maybeSingle()
      dbOk = !error
    }
  } catch {
    dbOk = false
  }

  const status = dbOk ? 200 : 503
  const n8nFlags = describeN8nRuntimeFlags()

  return NextResponse.json(
    {
      ok: dbOk,
      timestamp: new Date().toISOString(),
      db: dbOk ? 'connected' : 'unreachable',
      deploymentTier: n8nFlags.tier,
      n8n: {
        mockEnabled: n8nFlags.mockN8n.effective,
        outboundDisabled: n8nFlags.disableOutbound.effective,
      },
    },
    { status }
  )
}
