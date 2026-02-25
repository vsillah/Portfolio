import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/lead-magnets/nurture-stats
 * Returns aggregate nurture email stats per lead magnet (admin only).
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_nurture_stats_by_lead_magnet')

    if (error) {
      // If RPC doesn't exist yet, fall back to a direct query
      const { data: fallback, error: fallbackError } = await supabaseAdmin
        .from('lead_magnet_nurture_emails')
        .select('lead_magnet_id, email_number, user_id')

      if (fallbackError) {
        return NextResponse.json([], { status: 200 })
      }

      const stats: Record<string, { lead_magnet_id: string; total_sent: number; unique_users: number; max_email: number }> = {}
      for (const row of fallback || []) {
        const id = row.lead_magnet_id
        if (!stats[id]) {
          stats[id] = { lead_magnet_id: id, total_sent: 0, unique_users: 0, max_email: 0 }
        }
        stats[id].total_sent++
        if (row.email_number > stats[id].max_email) {
          stats[id].max_email = row.email_number
        }
      }

      const userSets: Record<string, Set<string>> = {}
      for (const row of fallback || []) {
        const id = row.lead_magnet_id
        if (!userSets[id]) userSets[id] = new Set()
        userSets[id].add(row.user_id)
      }
      for (const id of Object.keys(stats)) {
        stats[id].unique_users = userSets[id]?.size ?? 0
      }

      return NextResponse.json(Object.values(stats))
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Nurture stats error:', error)
    return NextResponse.json([], { status: 200 })
  }
}
