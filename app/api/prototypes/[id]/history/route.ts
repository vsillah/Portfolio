import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userIsAdmin = await isAdmin(user.id)
    if (!userIsAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: prototypeId } = params
    const body = await request.json()
    const { old_stage, new_stage, change_reason } = body

    if (!new_stage) {
      return NextResponse.json(
        { error: 'New stage is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('prototype_stage_history')
      .insert([{
        prototype_id: prototypeId,
        old_stage: old_stage || null,
        new_stage,
        changed_by: user.id,
        change_reason: change_reason || null,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating stage history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create stage history' },
      { status: 500 }
    )
  }
}
