import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
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

    // Unset all other primaries
    await supabaseAdmin
      .from('prototype_demos')
      .update({ is_primary: false })
      .eq('prototype_id', prototypeId)
      .eq('is_primary', true)

    // Set this demo as primary
    const { data, error } = await supabaseAdmin
      .from('prototype_demos')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', demoId)
      .eq('prototype_id', prototypeId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error setting primary demo:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set primary demo' },
      { status: 500 }
    )
  }
}
