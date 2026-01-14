import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publishedOnly = searchParams.get('published') !== 'false'

    let query = supabaseAdmin
      .from('videos')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (publishedOnly) {
      query = query.eq('is_published', true)
    }

    const { data: videos, error } = await query

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    return NextResponse.json(videos || [])
  } catch (error: any) {
    console.error('Error fetching videos:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch videos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { title, description, video_url, thumbnail_url, duration, display_order, is_published, file_path, file_type, file_size } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('videos')
      .insert([{
        title,
        description: description || null,
        video_url: video_url || null,
        thumbnail_url: thumbnail_url || null,
        duration: duration || null,
        display_order: display_order || 0,
        is_published: is_published !== undefined ? is_published : true,
        file_path: file_path || null,
        file_type: file_type || null,
        file_size: file_size || null,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating video:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create video' },
      { status: 500 }
    )
  }
}
