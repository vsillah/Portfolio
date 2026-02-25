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

    const { data, error } = await supabaseAdmin
      .from('lead_magnets')
      .select('id, title, slug, description, type, download_count, landing_page_data')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Ebook landing page API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
