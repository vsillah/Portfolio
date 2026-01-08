import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: prototypeId } = params

    // Fetch feedback (public for production, restricted for pilot)
    const { data: feedback, error } = await supabaseAdmin
      .from('prototype_feedback')
      .select('id, feedback_text, rating, user_id, created_at')
      .eq('prototype_id', prototypeId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(feedback || [])
  } catch (error: any) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch feedback' },
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

    const { id: prototypeId } = params
    const body = await request.json()
    const { feedback_text, rating } = body

    if (!feedback_text) {
      return NextResponse.json(
        { error: 'Feedback text is required' },
        { status: 400 }
      )
    }

    // Verify user is eligible (pilot or production user)
    const { data: prototype } = await supabaseAdmin
      .from('app_prototypes')
      .select('production_stage')
      .eq('id', prototypeId)
      .single()

    if (!prototype) {
      return NextResponse.json(
        { error: 'Prototype not found' },
        { status: 404 }
      )
    }

    // For production, anyone can submit feedback
    // For pilot, user must be enrolled
    if (prototype.production_stage !== 'Production') {
      const { data: enrollment } = await supabaseAdmin
        .from('prototype_enrollments')
        .select('enrollment_type')
        .eq('user_id', user.id)
        .eq('prototype_id', prototypeId)
        .in('enrollment_type', ['Pilot'])
        .single()

      if (!enrollment) {
        return NextResponse.json(
          { error: 'You must be enrolled in the pilot program to submit feedback' },
          { status: 403 }
        )
      }
    }

    // Create feedback
    const { data, error } = await supabaseAdmin
      .from('prototype_feedback')
      .insert([{
        prototype_id: prototypeId,
        user_id: user.id,
        feedback_text: feedback_text.trim(),
        rating: rating || null,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error submitting feedback:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
