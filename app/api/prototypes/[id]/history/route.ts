import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: prototypeId } = params

    const { data: history, error } = await supabaseAdmin
      .from('prototype_stage_history')
      .select(`
        *,
        changed_by_profile:user_profiles!changed_by(email)
      `)
      .eq('prototype_id', prototypeId)
      .order('changed_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(history || [])
  } catch (error: any) {
    console.error('Error fetching stage history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stage history' },
      { status: 500 }
    )
  }
}
