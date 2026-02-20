import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/** Default outcome groups for pricing chart (UX recommendation). Seeded in UI, not in DB migration. */
const DEFAULT_OUTCOME_GROUPS = [
  { slug: 'capture_convert', label: 'Capture & Convert Leads', display_order: 0 },
  { slug: 'save_time_scale', label: 'Save Time & Scale Ops', display_order: 1 },
  { slug: 'strategy_support', label: 'Strategy & Support', display_order: 2 },
  { slug: 'grow_presence', label: 'Grow Your Presence', display_order: 3 },
]

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { count } = await supabaseAdmin
      .from('outcome_groups')
      .select('id', { count: 'exact', head: true })

    if (count != null && count > 0) {
      return NextResponse.json(
        { message: 'Outcome groups already exist; no seed applied.', count },
        { status: 200 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('outcome_groups')
      .insert(DEFAULT_OUTCOME_GROUPS)
      .select()

    if (error) throw error

    return NextResponse.json(
      { message: 'Default outcome groups created.', data: data ?? [] },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('Error seeding outcome groups:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed outcome groups' },
      { status: 500 }
    )
  }
}
