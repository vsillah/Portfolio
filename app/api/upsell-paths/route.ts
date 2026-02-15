// API Route: Public Upsell Path Lookup
// Returns the active upsell path(s) for a given source offer.
// Used by: pricing page, proposals, AI recommendation engine, progress updates.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Fetch upsell path(s) for a given source offer
// Query params:
//   content_type (required) - e.g. 'service', 'product', 'lead_magnet'
//   content_id (required) - ID of the source offer
//   tier_slug (optional) - filter by source tier slug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('content_type');
    const contentId = searchParams.get('content_id');
    const tierSlug = searchParams.get('tier_slug');

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'content_type and content_id are required' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('offer_upsell_paths')
      .select('*')
      .eq('source_content_type', contentType)
      .eq('source_content_id', contentId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (tierSlug) {
      query = query.eq('source_tier_slug', tierSlug);
    }

    const { data: paths, error } = await query;

    if (error) {
      console.error('Error fetching upsell paths for offer:', error);
      return NextResponse.json({ error: 'Failed to fetch upsell paths' }, { status: 500 });
    }

    return NextResponse.json({ paths: paths || [] });
  } catch (error) {
    console.error('Error in public upsell-paths GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
