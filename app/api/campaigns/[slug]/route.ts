import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('attraction_campaigns')
      .select(`
        id, name, slug, description, campaign_type, status,
        starts_at, ends_at, enrollment_deadline, completion_window_days,
        payout_type, payout_amount_type, hero_image_url, promo_copy,
        campaign_eligible_bundles (
          bundle_id, override_min_amount,
          offer_bundles (id, name, pricing_tier_slug, bundle_price, tagline, target_audience_display)
        ),
        campaign_criteria_templates (
          id, label_template, description_template, criteria_type, required, display_order
        )
      `)
      .eq('slug', params.slug)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    );
  }
}
