import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/social-content/[id]
 * Get a single social content item with its source meeting record
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params

    const { data, error } = await supabaseAdmin
      .from('social_content_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    let meetingRecord = null
    if (data.meeting_record_id) {
      const { data: meeting } = await supabaseAdmin
        .from('meeting_records')
        .select('id, meeting_type, meeting_date, transcript, structured_notes, key_decisions, attendees')
        .eq('id', data.meeting_record_id)
        .single()
      meetingRecord = meeting
    }

    // Load per-platform publish records
    const { data: publishes } = await supabaseAdmin
      .from('social_content_publishes')
      .select('*')
      .eq('content_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      item: { ...data, meeting_record: meetingRecord, publishes: publishes || [] },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/social-content/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/social-content/[id]
 * Update a social content item (edit text, change status, add notes)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params
    const body = await request.json()

    const allowedFields = [
      'post_text', 'cta_text', 'cta_url', 'hashtags',
      'image_prompt', 'voiceover_text', 'platform',
      'status', 'scheduled_for', 'admin_notes',
      'framework_visual_type', 'target_platforms',
      'video_generation_method', 'youtube_title', 'youtube_description',
    ]

    const sanitized: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in body) sanitized[key] = body[key]
    }

    if (sanitized.status === 'approved' || sanitized.status === 'rejected') {
      sanitized.reviewed_by = authResult.user.id
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('social_content_queue')
      .update(sanitized)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating social content:', error)
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (error) {
    console.error('Error in PUT /api/admin/social-content/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
