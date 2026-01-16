import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: prototypeId } = params

    const { data: prototype, error } = await supabaseAdmin
      .from('app_prototypes')
      .select(`
        *,
        demos:prototype_demos(*),
        stage_history:prototype_stage_history(*)
      `)
      .eq('id', prototypeId)
      .single()

    if (error) throw error

    if (!prototype) {
      return NextResponse.json(
        { error: 'Prototype not found' },
        { status: 404 }
      )
    }

    // Sort demos and history
    const sortedDemos = (prototype.demos || []).sort((a: any, b: any) => 
      a.display_order - b.display_order
    )
    
    const sortedHistory = (prototype.stage_history || []).sort((a: any, b: any) => 
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
    )

    return NextResponse.json({
      ...prototype,
      demos: sortedDemos,
      stage_history: sortedHistory,
    })
  } catch (error: any) {
    console.error('Error fetching prototype:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch prototype' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the user with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: prototypeId } = params
    const body = await request.json()

    // Update prototype
    const { data, error } = await supabaseAdmin
      .from('app_prototypes')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prototypeId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating prototype:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update prototype' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify the user with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id: prototypeId } = params

    const { error } = await supabaseAdmin
      .from('app_prototypes')
      .delete()
      .eq('id', prototypeId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting prototype:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete prototype' },
      { status: 500 }
    )
  }
}
