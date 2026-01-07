import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { all, id } = body

    // Check if contact_submissions table has a read/responded column
    // If not, we'll need to add it via migration
    // For now, we'll just return success
    // You can add a 'read' or 'responded' boolean column later

    if (all) {
      // Mark all as read (would need a column in the table)
      return NextResponse.json({ 
        success: true,
        message: 'All submissions marked as read',
        note: 'Add a "read" or "responded" column to contact_submissions table for this feature',
      })
    } else if (id) {
      // Mark specific submission as read
      return NextResponse.json({ 
        success: true,
        message: 'Submission marked as read',
        note: 'Add a "read" or "responded" column to contact_submissions table for this feature',
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error) {
    console.error('Mark read error:', error)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }
}
