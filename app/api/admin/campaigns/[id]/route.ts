import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { UpdateCampaignInput } from '@/lib/campaigns';
import { isValidCampaignType, isValidCampaignStatus, validateSlug } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('attraction_campaigns')
      .select(`
        *,
        campaign_eligible_bundles (
          id, bundle_id,
          offer_bundles (id, name, pricing_tier_slug, bundle_price)
        ),
        campaign_criteria_templates (
          id, label_template, description_template, criteria_type,
          tracking_source, tracking_config, threshold_source, threshold_default,
          required, display_order
        )
      `)
      .eq('id', params.id)
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: UpdateCampaignInput = await request.json();

    if (body.slug !== undefined && !validateSlug(body.slug)) {
      return NextResponse.json({ error: 'Invalid slug format' }, { status: 400 });
    }
    if (body.campaign_type && !isValidCampaignType(body.campaign_type)) {
      return NextResponse.json({ error: 'Invalid campaign type' }, { status: 400 });
    }
    if (body.status && !isValidCampaignStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'slug', 'description', 'campaign_type', 'status',
      'starts_at', 'ends_at', 'enrollment_deadline', 'completion_window_days',
      'min_purchase_amount', 'payout_type', 'payout_amount_type',
      'payout_amount_value', 'rollover_bonus_multiplier',
      'hero_image_url', 'promo_copy',
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = (body as Record<string, unknown>)[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('attraction_campaigns')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A campaign with this slug already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { error } = await supabaseAdmin
      .from('attraction_campaigns')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    );
  }
}
