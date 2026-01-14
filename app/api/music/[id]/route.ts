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

    const { data: musicItem, error } = await supabaseAdmin
      .from('music')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Music not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(musicItem)
  } catch (error: any) {
    console.error('Error fetching music:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch music' },
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
    const { title, artist, album, description, spotify_url, apple_music_url, youtube_url, release_date, genre, display_order, is_published, file_path, file_type, file_size } = body

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (artist !== undefined) updateData.artist = artist
    if (album !== undefined) updateData.album = album
    if (description !== undefined) updateData.description = description
    if (spotify_url !== undefined) updateData.spotify_url = spotify_url
    if (apple_music_url !== undefined) updateData.apple_music_url = apple_music_url
    if (youtube_url !== undefined) updateData.youtube_url = youtube_url
    if (release_date !== undefined) updateData.release_date = release_date
    if (genre !== undefined) updateData.genre = genre
    if (display_order !== undefined) updateData.display_order = display_order
    if (is_published !== undefined) updateData.is_published = is_published
    if (file_path !== undefined) updateData.file_path = file_path
    if (file_type !== undefined) updateData.file_type = file_type
    if (file_size !== undefined) updateData.file_size = file_size

    const { data, error } = await supabaseAdmin
      .from('music')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating music:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update music' },
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
      .from('music')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 204 })
  } catch (error: any) {
    console.error('Error deleting music:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete music' },
      { status: 500 }
    )
  }
}
