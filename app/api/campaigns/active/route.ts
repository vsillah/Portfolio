import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('attraction_campaigns')
      .select(`
        id, name, slug, description, campaign_type, status,
        starts_at, ends_at, enrollment_deadline, completion_window_days,
        payout_type, payout_amount_type, hero_image_url, promo_copy,
        campaign_eligible_bundles (
          bundle_id,
          offer_bundles (id, name, pricing_tier_slug, bundle_price, tagline)
        ),
        campaign_criteria_templates (
          id, label_template, criteria_type, required, display_order
        )
      `)
      .eq('status', 'active')
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ data: [] });
      throw error;
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: unknown) {
    console.error('Error fetching active campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active campaigns' },
      { status: 500 }
    );
  }
}
