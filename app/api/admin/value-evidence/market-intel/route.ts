import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/market-intel
 * List market intelligence records, optionally filtered
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const isProcessed = searchParams.get('is_processed')
  const industry = searchParams.get('industry')
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 500)
  const offset = Number(searchParams.get('offset')) || 0

  let query = supabaseAdmin
    .from('market_intelligence')
    .select('*', { count: 'exact' })
    .order('scraped_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (platform) query = query.eq('source_platform', platform)
  if (isProcessed !== null && isProcessed !== undefined && isProcessed !== '') {
    if (isProcessed === 'true') query = query.eq('is_processed', true)
    else if (isProcessed === 'false') query = query.eq('is_processed', false)
  }
  if (industry) query = query.eq('industry_detected', industry)

  const [{ data, error, count }, { data: platformRows }] = await Promise.all([
    query,
    supabaseAdmin
      .from('market_intelligence')
      .select('source_platform')
      .order('source_platform')
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const platforms = [...new Set((platformRows || []).map(r => r.source_platform))].sort()

  return NextResponse.json({
    items: data || [],
    platforms,
    total: count ?? 0,
    limit,
    offset,
  })
}
