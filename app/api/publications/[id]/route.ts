import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: publication, error } = await supabaseAdmin
      .from('publications')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Publication not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(publication)
  } catch (error: any) {
    console.error('Error fetching publication:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch publication' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = params
    const body = await request.json()
    const {
      title, description, publication_url, author, publication_date, publisher,
      display_order, is_published, file_path, file_type, file_size,
      elevenlabs_project_id, elevenlabs_public_user_id, elevenlabs_player_url,
      audiobook_lead_magnet_id,
      audio_preview_url, audio_file_path,
    } = body

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (publication_url !== undefined) updateData.publication_url = publication_url
    if (author !== undefined) updateData.author = author
    if (publication_date !== undefined) updateData.publication_date = publication_date
    if (publisher !== undefined) updateData.publisher = publisher
    if (display_order !== undefined) updateData.display_order = display_order
    if (is_published !== undefined) updateData.is_published = is_published
    if (file_path !== undefined) updateData.file_path = file_path
    if (file_type !== undefined) updateData.file_type = file_type
    if (file_size !== undefined) updateData.file_size = file_size
    if (elevenlabs_project_id !== undefined) updateData.elevenlabs_project_id = elevenlabs_project_id
    if (elevenlabs_public_user_id !== undefined) updateData.elevenlabs_public_user_id = elevenlabs_public_user_id
    if (elevenlabs_player_url !== undefined) updateData.elevenlabs_player_url = elevenlabs_player_url
    if (audiobook_lead_magnet_id !== undefined) updateData.audiobook_lead_magnet_id = audiobook_lead_magnet_id || null
    if (audio_preview_url !== undefined) updateData.audio_preview_url = audio_preview_url || null
    if (audio_file_path !== undefined) updateData.audio_file_path = audio_file_path || null

    const { data, error } = await supabaseAdmin
      .from('publications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating publication:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update publication' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = params

    const { error } = await supabaseAdmin
      .from('publications')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 204 })
  } catch (error: any) {
    console.error('Error deleting publication:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete publication' },
      { status: 500 }
    )
  }
}
