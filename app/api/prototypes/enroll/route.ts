import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { prototypeId, enrollmentType } = body

    if (!prototypeId || !enrollmentType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['Waitlist', 'Pilot', 'Production-Interest'].includes(enrollmentType)) {
      return NextResponse.json(
        { error: 'Invalid enrollment type' },
        { status: 400 }
      )
    }

    // Check if already enrolled
    const { data: existing } = await supabaseAdmin
      .from('prototype_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('prototype_id', prototypeId)
      .eq('enrollment_type', enrollmentType)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Already enrolled' },
        { status: 400 }
      )
    }

    // Create enrollment
    const { data, error } = await supabaseAdmin
      .from('prototype_enrollments')
      .insert([{
        user_id: user.id,
        prototype_id: prototypeId,
        enrollment_type: enrollmentType,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error enrolling:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enroll' },
      { status: 500 }
    )
  }
}
