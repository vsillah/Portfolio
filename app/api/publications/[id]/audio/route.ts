import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/publications/[id]/audio
 * Streams the publication's self-hosted audio file from Supabase Storage.
 * Proxies the response so the browser gets a stable URL and proper Range support
 * (avoids 400 from loading signed URLs directly in <audio>).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    if (!id) {
      return NextResponse.json({ error: 'Publication ID required' }, { status: 400 })
    }

    const { data: publication, error } = await supabaseAdmin
      .from('publications')
      .select('id, audio_file_path, is_published')
      .eq('id', id)
      .single()

    if (error || !publication) {
      return NextResponse.json({ error: 'Publication not found' }, { status: 404 })
    }

    const path = publication.audio_file_path
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'No audio for this publication' }, { status: 404 })
    }

    // Only allow streaming for published publications (public playback)
    if (!publication.is_published) {
      return NextResponse.json({ error: 'Not available' }, { status: 404 })
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('publications')
      .createSignedUrl(path, 3600)

    if (signError || !signed?.signedUrl) {
      console.error('Publication audio signed URL error:', signError)
      return NextResponse.json({ error: 'Audio unavailable' }, { status: 502 })
    }

    const range = request.headers.get('range')
    const headers: Record<string, string> = {}
    if (range) headers['Range'] = range

    const upstream = await fetch(signed.signedUrl, { headers })
    if (!upstream.ok) {
      console.error('Publication audio upstream error:', upstream.status, await upstream.text())
      return NextResponse.json({ error: 'Audio unavailable' }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg'
    const contentLength = upstream.headers.get('content-length')
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes'
    const contentRange = upstream.headers.get('content-range')

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Cache-Control': 'private, max-age=3600',
    }
    if (contentLength) responseHeaders['Content-Length'] = contentLength
    if (contentRange) responseHeaders['Content-Range'] = contentRange

    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })

    return response
  } catch (err) {
    console.error('Publication audio stream error:', err)
    return NextResponse.json(
      { error: 'Failed to stream audio' },
      { status: 500 }
    )
  }
}
