import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: video, error } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(video)
  } catch (error: any) {
    console.error('Error fetching video:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch video' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const { id } = params
    const body = await request.json()
    const { title, description, video_url, thumbnail_url, duration, display_order, is_published, file_path, file_type, file_size } = body

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (video_url !== undefined) updateData.video_url = video_url
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url
    if (duration !== undefined) updateData.duration = duration
    if (display_order !== undefined) updateData.display_order = display_order
    if (is_published !== undefined) updateData.is_published = is_published
    if (file_path !== undefined) updateData.file_path = file_path
    if (file_type !== undefined) updateData.file_type = file_type
    if (file_size !== undefined) updateData.file_size = file_size

    const { data, error } = await supabaseAdmin
      .from('videos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating video:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update video' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    const { id } = params

    const { error } = await supabaseAdmin
      .from('videos')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 204 })
  } catch (error: any) {
    console.error('Error deleting video:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete video' },
      { status: 500 }
    )
  }
}
