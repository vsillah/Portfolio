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

    const { data: demos, error } = await supabaseAdmin
      .from('prototype_demos')
      .select('*')
      .eq('prototype_id', prototypeId)
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json(demos || [])
  } catch (error: any) {
    console.error('Error fetching demos:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch demos' },
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

    const isUserAdmin = await isAdmin(user.id)
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: prototypeId } = params
    const body = await request.json()
    const {
      title,
      description,
      demo_type,
      demo_url,
      persona_type,
      journey_focus,
      is_primary,
      display_order,
    } = body

    if (!title || !demo_url) {
      return NextResponse.json(
        { error: 'Title and demo URL are required' },
        { status: 400 }
      )
    }

    // If setting as primary, unset other primaries first
    if (is_primary) {
      await supabaseAdmin
        .from('prototype_demos')
        .update({ is_primary: false })
        .eq('prototype_id', prototypeId)
        .eq('is_primary', true)
    }

    // Create demo
    const { data, error } = await supabaseAdmin
      .from('prototype_demos')
      .insert([{
        prototype_id: prototypeId,
        title,
        description: description || null,
        demo_type: demo_type || 'video',
        demo_url,
        persona_type: persona_type || null,
        journey_focus: journey_focus || null,
        is_primary: is_primary || false,
        display_order: display_order || 0,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating demo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create demo' },
      { status: 500 }
    )
  }
}
