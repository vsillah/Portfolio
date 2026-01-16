import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publishedOnly = searchParams.get('published') !== 'false'

    let query = supabaseAdmin
      .from('music')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (publishedOnly) {
      query = query.eq('is_published', true)
    }

    const { data: music, error } = await query

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    // Fetch linked products for music entries
    const musicIds = (music || []).map(m => m.id)
    let linkedProducts: Record<number, { id: number; price: number | null }> = {}
    
    if (musicIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, price, music_id')
        .in('music_id', musicIds)
        .eq('is_active', true)
      
      if (products) {
        products.forEach(p => {
          if (p.music_id) {
            linkedProducts[p.music_id] = { id: p.id, price: p.price }
          }
        })
      }
    }

    // Attach linked_product to each music entry
    const musicWithProducts = (music || []).map(m => ({
      ...m,
      linked_product: linkedProducts[m.id] || null
    }))

    return NextResponse.json(musicWithProducts)
  } catch (error: any) {
    console.error('Error fetching music:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch music' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user } = authResult

    const body = await request.json()
    const { title, artist, album, description, spotify_url, apple_music_url, youtube_url, release_date, genre, display_order, is_published, file_path, file_type, file_size } = body

    if (!title || !artist) {
      return NextResponse.json(
        { error: 'Title and artist are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('music')
      .insert([{
        title,
        artist,
        album: album || null,
        description: description || null,
        spotify_url: spotify_url || null,
        apple_music_url: apple_music_url || null,
        youtube_url: youtube_url || null,
        release_date: release_date || null,
        genre: genre || null,
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
    console.error('Error creating music:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create music' },
      { status: 500 }
    )
  }
}
