import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Public endpoint to fetch lead magnet landing page data by slug.
 * Returns only the fields needed for the landing page — no file paths or internal data.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
    }

    const { data: leadMagnet, error } = await supabaseAdmin
      .from('lead_magnets')
      .select('id, title, slug, description, type, download_count, landing_page_data')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !leadMagnet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // If this lead magnet is linked to a publication that has an audiobook, return it for bundle
    let audiobookLeadMagnet: { id: string; slug: string | null; title: string } | null = null
    const { data: publication } = await supabaseAdmin
      .from('publications')
      .select('audiobook_lead_magnet_id')
      .eq('lead_magnet_id', leadMagnet.id)
      .eq('is_published', true)
      .maybeSingle()

    if (publication?.audiobook_lead_magnet_id) {
      const { data: audiobookLm } = await supabaseAdmin
        .from('lead_magnets')
        .select('id, slug, title')
        .eq('id', publication.audiobook_lead_magnet_id)
        .eq('is_active', true)
        .single()
      if (audiobookLm) {
        audiobookLeadMagnet = { id: audiobookLm.id, slug: audiobookLm.slug, title: audiobookLm.title }
      }
    }

    return NextResponse.json({
      ...leadMagnet,
      audiobook_lead_magnet: audiobookLeadMagnet,
    })
  } catch (error) {
    console.error('Ebook landing page API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
