import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; demoId: string } }
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

    const { id: prototypeId, demoId } = params
    const body = await request.json()

    // If setting as primary, unset other primaries first
    if (body.is_primary) {
      await supabaseAdmin
        .from('prototype_demos')
        .update({ is_primary: false })
        .eq('prototype_id', prototypeId)
        .eq('is_primary', true)
        .neq('id', demoId)
    }

    // Update demo
    const { data, error } = await supabaseAdmin
      .from('prototype_demos')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', demoId)
      .eq('prototype_id', prototypeId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating demo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update demo' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; demoId: string } }
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

    const { id: prototypeId, demoId } = params

    // Check if this is the only demo
    const { data: demos } = await supabaseAdmin
      .from('prototype_demos')
      .select('id')
      .eq('prototype_id', prototypeId)

    if (demos && demos.length === 1) {
      return NextResponse.json(
        { error: 'Cannot delete the only demo for a prototype' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('prototype_demos')
      .delete()
      .eq('id', demoId)
      .eq('prototype_id', prototypeId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting demo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete demo' },
      { status: 500 }
    )
  }
}
